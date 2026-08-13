import { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import { IShipmentRepository } from '@/domain/repositories/IShipmentRepository'
import { ShipmentStatus, SHIPMENT_STATUS_RANK } from '@/domain/entities/Shipment'
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
}

export interface SyncShipmentStatusOutput {
  /** true si este webhook aplicó el cambio de estado. false si era un duplicado. */
  updated: boolean
  newStatus: ShipmentStatus
  /** ID del usuario propietario del pedido — para invalidación de caché por usuario */
  userId: string
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
      return ok({ updated: false, newStatus: currentStatus, userId: order.userId })
    }

    // Si no existe registro de envío aún, crearlo primero (upsert inicial)
    if (!existing) {
      await this.shipmentRepo.upsert(input.orderId, {
        status: input.vendelo_status,
        trackingNumber: input.trackingNumber ?? null,
        carrier: input.carrier ?? null,
      })
      await this.syncOrderStatus(input.orderId, input.vendelo_status)
      await this.maybeRestock(input.orderId, currentStatus, input.vendelo_status)
      return ok({ updated: true, newStatus: input.vendelo_status, userId: order.userId })
    }

    // Idempotencia nivel 2: atomic WHERE en BD (protege race conditions entre workers)
    const result = await this.shipmentRepo.atomicUpdateStatus(
      input.orderId,
      currentStatus,
      input.vendelo_status,
      {
        trackingNumber: input.trackingNumber ?? null,
        carrier: input.carrier ?? null,
      },
    )

    if (!result.applied) {
      return ok({ updated: false, newStatus: currentStatus, userId: order.userId })
    }

    await this.syncOrderStatus(input.orderId, input.vendelo_status)
    await this.maybeRestock(input.orderId, currentStatus, input.vendelo_status)
    return ok({ updated: true, newStatus: input.vendelo_status, userId: order.userId })
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
