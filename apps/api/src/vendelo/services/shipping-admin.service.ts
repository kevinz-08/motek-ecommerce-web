import { Injectable, Inject, Logger } from '@nestjs/common'
import {
  IOrderRepository,
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
import { ORDER_REPOSITORY, VENDELO_SHIPPING_PORT } from '../../infrastructure/injection-tokens'

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
    @Inject(VENDELO_SHIPPING_PORT) private readonly shippingPort: IVendeloShippingPort,
    private readonly vendeloService: VendeloService,
  ) {}

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
  ): Promise<{ pickups: unknown[]; skipped: string[] }> {
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
