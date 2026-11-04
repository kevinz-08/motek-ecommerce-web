import { Injectable, Inject, Logger } from '@nestjs/common'
import {
  IOrderRepository,
  IShipmentRepository,
  IVendeloShippingPort,
  ShipmentExceptionDetail,
} from '@motek/domain'
import {
  VendeloService,
  GenerateLabelsResponse,
  GetExceptionsParams,
  LabelFormat,
  LabelOutput,
} from '../../infrastructure/services/VendeloService'
import {
  VendeloOrderQueueService,
  MAX_ATTEMPTS as MAX_QUEUE_ATTEMPTS,
} from '../../infrastructure/services/VendeloOrderQueueService'
import type { ApiPickup } from '../../infrastructure/services/vendelo-api.types'
import { ORDER_REPOSITORY, SHIPMENT_REPOSITORY, VENDELO_SHIPPING_PORT } from '../../infrastructure/injection-tokens'

/**
 * Estado consolidado del despacho de un pedido para el apartado "Guía Vendelo"
 * del admin: reúne Order.vendeloOrderId, VendeloOrderQueue y Shipment.
 */
export interface ShippingStatusView {
  orderId: string
  deliveryMethod: 'HOME_DELIVERY' | 'STORE_PICKUP'
  orderStatus: string
  vendeloOrderId: string | null
  queue: {
    status: string
    attempts: number
    maxAttempts: number
    lastError: string | null
    nextRetry: string
  } | null
  shipment: {
    status: string
    trackingNumber: string | null
    carrier: string | null
    labelUrl: string | null
    updatedAt: string
  } | null
  /** Se calcula acá (no en el cliente) para que la máquina de estados viva en un solo lugar. */
  actions: {
    canRequeue: boolean
    canCreateShipment: boolean
    canGenerateLabel: boolean
  }
}

/**
 * Servicio de aplicación NestJS para operaciones logísticas admin que no tienen
 * reglas de negocio propias — solo resolución de IDs internos → Vendelo y delegación.
 *
 * Operaciones con lógica de dominio (CreateShipments, ResolveShipmentException)
 * se implementan como use cases en packages/domain y son invocadas directamente
 * desde el controller.
 */
@Injectable()
export class ShippingAdminService {
  private readonly logger = new Logger(ShippingAdminService.name)

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: IOrderRepository,
    @Inject(SHIPMENT_REPOSITORY) private readonly shipmentRepo: IShipmentRepository,
    @Inject(VENDELO_SHIPPING_PORT) private readonly shippingPort: IVendeloShippingPort,
    private readonly vendeloService: VendeloService,
    private readonly orderQueue: VendeloOrderQueueService,
  ) {}

  /** Estado consolidado del despacho de un pedido. null si el pedido no existe. */
  async getShippingStatus(orderId: string): Promise<ShippingStatusView | null> {
    const order = await this.orderRepo.findById(orderId)
    if (!order) return null

    const [[vendeloRow], shipment, queue] = await Promise.all([
      this.orderRepo.findVendeloOrderIdsBatch([orderId]),
      this.shipmentRepo.findByOrderId(orderId),
      this.orderQueue.findByOrderId(orderId),
    ])

    const vendeloOrderId = vendeloRow?.vendeloOrderId ?? null
    const isPickup = order.deliveryMethod === 'STORE_PICKUP'
    const cancelled = order.status === 'CANCELLED'
    const queueInFlight = queue?.status === 'PENDING' || queue?.status === 'PROCESSING'

    return {
      orderId,
      deliveryMethod: order.deliveryMethod,
      orderStatus: order.status,
      vendeloOrderId,
      queue: queue
        ? {
            status: queue.status,
            attempts: queue.attempts,
            maxAttempts: MAX_QUEUE_ATTEMPTS,
            lastError: queue.lastError,
            nextRetry: queue.nextRetry.toISOString(),
          }
        : null,
      shipment: shipment
        ? {
            status: shipment.status,
            trackingNumber: shipment.trackingNumber,
            carrier: shipment.carrier,
            labelUrl: shipment.labelUrl,
            updatedAt: shipment.updatedAt.toISOString(),
          }
        : null,
      actions: {
        canRequeue: !isPickup && !cancelled && !vendeloOrderId && !queueInFlight,
        canCreateShipment: !isPickup && !cancelled && !!vendeloOrderId && !shipment,
        canGenerateLabel: !isPickup && !cancelled && !!vendeloOrderId,
      },
    }
  }

  /**
   * Genera etiquetas PDF/URL para los pedidos indicados.
   * Resuelve vendeloOrderIds en lote y omite pedidos sin asignación.
   * Si output=BASE64, el caller debe convertir `data` a buffer y servir como PDF.
   */
  async generateLabels(
    orderIds: string[],
    format: LabelFormat,
    output: LabelOutput = 'URL',
  ): Promise<GenerateLabelsResponse & { skipped: string[] }> {
    // `status` distingue etiquetas listas (SUCCESS) de generación en curso
    // (PROCESSING) o fallida (ERROR) — ver VendeloService.generateLabels.
    const rows = await this.orderRepo.findVendeloOrderIdsBatch(orderIds)

    const vendeloIds: string[] = []
    const skipped: string[] = []
    for (const row of rows) {
      if (row.vendeloOrderId) vendeloIds.push(row.vendeloOrderId)
      else skipped.push(row.id)
    }

    if (!vendeloIds.length) {
      this.logger.warn(`generateLabels: ningún pedido tiene vendeloOrderId — skipped=${skipped.join(',')}`)
      return { status: 'SUCCESS', order_ids: [], output, data: '', skipped }
    }

    const result = await this.vendeloService.generateLabels(vendeloIds, format, output)
    return { ...result, skipped }
  }

  /**
   * Lista novedades de envío paginadas desde Vendelo.
   * No requiere resolución de IDs internos — el admin trabaja con IDs de Vendelo.
   */
  async getExceptions(params: GetExceptionsParams = {}) {
    return this.vendeloService.getExceptions(params)
  }

  /** Detalle de una novedad incluyendo possible_replies. */
  async getException(id: string): Promise<ShipmentExceptionDetail> {
    return this.shippingPort.getException(id)
  }

  /**
   * Solicita recolección de paquetes para los pedidos indicados.
   * Resuelve vendeloOrderIds en lote.
   */
  async requestPickup(
    orderIds: string[],
  ): Promise<{ pickups: ApiPickup[]; skipped: string[] }> {
    const rows = await this.orderRepo.findVendeloOrderIdsBatch(orderIds)

    const vendeloIds: string[] = []
    const skipped: string[] = []
    for (const row of rows) {
      if (row.vendeloOrderId) vendeloIds.push(row.vendeloOrderId)
      else skipped.push(row.id)
    }

    if (!vendeloIds.length) {
      this.logger.warn(`requestPickup: ningún pedido tiene vendeloOrderId — skipped=${skipped.join(',')}`)
      return { pickups: [], skipped }
    }

    const result = await this.vendeloService.requestPickup(vendeloIds)
    return { ...result, skipped }
  }
}
