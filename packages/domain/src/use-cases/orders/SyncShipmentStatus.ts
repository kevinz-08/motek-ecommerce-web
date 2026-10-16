import { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import { IShipmentRepository } from '@/domain/repositories/IShipmentRepository'
import {
  Shipment,
  ShipmentStatus,
  ShipmentTrackingDetails,
  SHIPMENT_STATUS_RANK,
  TrackingStatus,
} from '@/domain/entities/Shipment'
import { OrderStatus } from '@/domain/entities/Order'
import { Result, ok, err, AppError } from '@/domain/shared/Result'

export interface SyncShipmentStatusInput {
  /** Nuestro ID interno del pedido (external_order_id enviado a Vendelo en Fase 2). */
  orderId: string
  /** Nuevo status del envío según el evento del Chatbot Connection de Vendelo. */
  vendelo_status: ShipmentStatus
  /** Número de tracking asignado por el transportador. Disponible desde ORDER_SHIPPED. */
  trackingNumber?: string
  /** Nombre del transportador (ej. "COORDINADORA"). */
  carrier?: string
  /** Estado fino de la transportadora (ApiOrderShipment.tracking_status). */
  trackingStatus?: TrackingStatus
  /** Intentos de entrega realizados por la transportadora. */
  deliveryAttempts?: number
  /** Fecha de entrega al destinatario. */
  deliveredAt?: Date
  /** Fecha de la última actualización del seguimiento según la transportadora. */
  trackingUpdatedAt?: Date
}

export interface SyncShipmentStatusOutput {
  /** true si este webhook aplicó el cambio de estado. false si era un duplicado. */
  updated: boolean
  newStatus: ShipmentStatus
  /**
   * ID del usuario propietario del pedido — para invalidación de caché por usuario.
   * `null` en pedidos de invitado: no hay caché por usuario que invalidar, el
   * comprador consulta su pedido por trackingToken (página sin caché de sesión).
   */
  userId: string | null
  /**
   * true si se actualizó el detalle de seguimiento (guía, intentos de entrega,
   * estado fino) aunque el status no haya cambiado.
   */
  detailsUpdated: boolean
}

/**
 * Use case: Sincronizar el estado de un envío a partir de un webhook de Vendelo.
 *
 * Garantías:
 *   - **Progresión unidireccional**: si el status entrante tiene rank ≤ al actual,
 *     retorna ok({ updated: false }) inmediatamente sin tocar la BD.
 *   - **Idempotencia atómica**: la actualización usa WHERE status = currentStatus.
 *     Dos webhooks concurrentes con el mismo evento no aplican el cambio dos veces.
 *   - **Transición de Order.status**: cuando el envío llega a SHIPPED, DELIVERED
 *     o CANCELLED, actualiza también el estado del pedido padre.
 *   - **Detalle de seguimiento**: guía, transportadora, intentos de entrega y
 *     estado fino se actualizan aunque el status no avance (ej. un segundo
 *     intento de entrega mientras sigue en INCIDENT). Un campo ausente en el
 *     evento NUNCA borra lo guardado: un ORDER_DELIVERED sin datos de envío no
 *     debe eliminar la guía que llegó con ORDER_SHIPPED.
 *
 * El use case no conoce NestJS, Prisma ni HTTP. Solo habla con IShipmentRepository
 * e IOrderRepository.
 */
export class SyncShipmentStatus {
  constructor(
    private readonly shipmentRepo: IShipmentRepository,
    private readonly orderRepo: IOrderRepository,
  ) {}

  async execute(input: SyncShipmentStatusInput): Promise<Result<SyncShipmentStatusOutput>> {
    const order = await this.orderRepo.findById(input.orderId)
    if (!order) {
      return err(new AppError('NOT_FOUND', `Pedido "${input.orderId}" no encontrado`))
    }

    const existing = await this.shipmentRepo.findByOrderId(input.orderId)
    const currentStatus: ShipmentStatus = existing?.status ?? 'PENDING'

    // Idempotencia nivel 1: rank check en memoria (rápido, sin query)
    const incomingRank = SHIPMENT_STATUS_RANK[input.vendelo_status]
    const currentRank = SHIPMENT_STATUS_RANK[currentStatus]

    // CANCELLED es terminal especial (rank -1): siempre se acepta independiente del estado actual
    const isCancelled = input.vendelo_status === 'CANCELLED'
    const isForward = incomingRank > currentRank

    if (!isCancelled && !isForward) {
      const detailsUpdated = existing ? await this.syncDetails(existing, this.trackingDetails(input)) : false
      return ok({ updated: false, newStatus: currentStatus, userId: order.userId, detailsUpdated })
    }

    // Si no existe registro de envío aún, crearlo primero (upsert inicial)
    if (!existing) {
      await this.shipmentRepo.upsert(input.orderId, {
        status: input.vendelo_status,
        trackingNumber: input.trackingNumber ?? null,
        carrier: input.carrier ?? null,
      })
      // Registro recién creado: el resto del detalle se escribe tal cual
      const { trackingNumber: _t, carrier: _c, ...rest } = this.trackingDetails(input)
      const detailsUpdated = Object.keys(rest).length > 0
      if (detailsUpdated) await this.shipmentRepo.updateTrackingDetails(input.orderId, rest)
      await this.syncOrderStatus(input.orderId, input.vendelo_status)
      await this.maybeRestock(input.orderId, currentStatus, input.vendelo_status)
      return ok({ updated: true, newStatus: input.vendelo_status, userId: order.userId, detailsUpdated })
    }

    // Idempotencia nivel 2: atomic WHERE en BD (protege race conditions entre workers).
    // undefined = no tocar: un evento sin datos de envío no borra la guía guardada.
    const result = await this.shipmentRepo.atomicUpdateStatus(
      input.orderId,
      currentStatus,
      input.vendelo_status,
      {
        trackingNumber: input.trackingNumber,
        carrier: input.carrier,
      },
    )

    if (!result.applied) {
      return ok({ updated: false, newStatus: currentStatus, userId: order.userId, detailsUpdated: false })
    }

    // Guía y transportadora ya se escribieron en atomicUpdateStatus
    const { trackingNumber: _t, carrier: _c, ...rest } = this.trackingDetails(input)
    const detailsUpdated = await this.syncDetails(existing, rest)
    await this.syncOrderStatus(input.orderId, input.vendelo_status)
    await this.maybeRestock(input.orderId, currentStatus, input.vendelo_status)
    return ok({ updated: true, newStatus: input.vendelo_status, userId: order.userId, detailsUpdated })
  }

  /** Detalle de seguimiento presente en el evento (omite los campos ausentes). */
  private trackingDetails(input: SyncShipmentStatusInput): ShipmentTrackingDetails {
    const details: ShipmentTrackingDetails = {}
    if (input.trackingNumber) details.trackingNumber = input.trackingNumber
    if (input.carrier) details.carrier = input.carrier
    if (input.trackingStatus) details.trackingStatus = input.trackingStatus
    if (input.deliveryAttempts !== undefined) details.deliveryAttempts = input.deliveryAttempts
    if (input.deliveredAt) details.deliveredAt = input.deliveredAt
    if (input.trackingUpdatedAt) details.trackingUpdatedAt = input.trackingUpdatedAt
    return details
  }

  /**
   * Escribe solo los campos que cambiaron respecto a lo guardado — el polling
   * repite el mismo snapshot cada ciclo y no debe generar escrituras vacías.
   */
  private async syncDetails(current: Shipment, details: ShipmentTrackingDetails): Promise<boolean> {
    const changed: ShipmentTrackingDetails = {}
    const sameDate = (a: Date | null | undefined, b: Date | null | undefined) =>
      (a?.getTime() ?? null) === (b?.getTime() ?? null)

    if (details.trackingNumber !== undefined && details.trackingNumber !== current.trackingNumber) {
      changed.trackingNumber = details.trackingNumber
    }
    if (details.carrier !== undefined && details.carrier !== current.carrier) {
      changed.carrier = details.carrier
    }
    if (details.trackingStatus !== undefined && details.trackingStatus !== current.trackingStatus) {
      changed.trackingStatus = details.trackingStatus
    }
    if (details.deliveryAttempts !== undefined && details.deliveryAttempts !== current.deliveryAttempts) {
      changed.deliveryAttempts = details.deliveryAttempts
    }
    if (details.deliveredAt !== undefined && !sameDate(details.deliveredAt, current.deliveredAt)) {
      changed.deliveredAt = details.deliveredAt
    }
    if (details.trackingUpdatedAt !== undefined && !sameDate(details.trackingUpdatedAt, current.trackingUpdatedAt)) {
      changed.trackingUpdatedAt = details.trackingUpdatedAt
    }

    if (Object.keys(changed).length === 0) return false
    await this.shipmentRepo.updateTrackingDetails(current.orderId, changed)
    return true
  }

  /**
   * Restaura el stock cuando un envío se rechaza en la puerta. Solo dispara en
   * la transición de entrada a un estado "de devolución" (`RETURNED`/`CANCELLED`)
   * — si el estado previo ya era uno de esos, no se repite (evita doble restock
   * si, por ejemplo, CANCELLED es seguido por un evento RETURNED tardío).
   */
  private async maybeRestock(
    orderId: string,
    previousStatus: ShipmentStatus,
    newStatus: ShipmentStatus,
  ): Promise<void> {
    const isRestoreStatus = (s: ShipmentStatus) => s === 'RETURNED' || s === 'CANCELLED'
    if (isRestoreStatus(newStatus) && !isRestoreStatus(previousStatus)) {
      await this.orderRepo.restockItems(orderId)
    }
  }

  /**
   * Actualiza Order.status cuando el envío llega a un estado que tiene representación
   * en el enum OrderStatus del dominio.
   *
   * Estados intermedios (PREPARING, READY, INCIDENT) no sincronizan Order.status
   * intencionalmente: OrderStatus no tiene esos valores y añadirlos requeriría una
   * migración de schema. El cliente ve "Pago confirmado" (PAID) mientras el pedido
   * se prepara, lo cual es correcto. Si se necesita visibilidad de estados intermedios
   * en el frontend, la página de pedidos debe incluir shipment.status en su query.
   */
  private async syncOrderStatus(orderId: string, shipmentStatus: ShipmentStatus): Promise<void> {
    const orderStatusMap: Partial<Record<ShipmentStatus, OrderStatus>> = {
      SHIPPED:   'SHIPPED',
      DELIVERED: 'DELIVERED',
      RETURNED:  'CANCELLED', // Devolución = cancelación desde la perspectiva del pedido
      CANCELLED: 'CANCELLED',
    }
    const targetOrderStatus = orderStatusMap[shipmentStatus]
    if (targetOrderStatus) {
      await this.orderRepo.updateStatus(orderId, targetOrderStatus)
    }
  }
}
