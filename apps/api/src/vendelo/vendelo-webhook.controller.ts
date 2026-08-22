import {
  Body, Controller, HttpCode, Inject, Logger, Post, UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import {
  SyncShipmentStatus,
  IOrderRepository,
  IShipmentRepository,
  ShipmentStatus,
} from '@motek/domain'
import { Public } from '../auth/decorators/public.decorator'
import { ORDER_REPOSITORY, SHIPMENT_REPOSITORY } from '../infrastructure/injection-tokens'
import { VendeloWebhookGuard } from './guards/vendelo-webhook.guard'

/** Eventos del Chatbot Connection de Vendelo que impactan el estado del envío. */
type VendeloWebhookEvent =
  | 'ORDER_CREATED'
  | 'ORDER_CANCELLED'
  | 'ORDER_CONFIRMATION_REQUESTED'
  | 'ORDER_PREPARED'
  | 'ORDER_READY_FOR_PICKUP'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'SHIPMENT_EXCEPTION_CREATED'
  | 'SHIPMENT_STATUS_UPDATED'

interface VendeloWebhookPayload {
  event?: VendeloWebhookEvent
  data?: {
    order_id?: string
    external_order_id?: string
    status?: string
    shipments?: Array<{
      tracking_number?: string
      carrier?: string
      status?: string
    }>
  }
}

/** Mapa de evento Vendelo → ShipmentStatus de dominio */
const EVENT_TO_STATUS: Partial<Record<VendeloWebhookEvent, ShipmentStatus>> = {
  ORDER_PREPARED:          'PREPARING',
  ORDER_READY_FOR_PICKUP:  'READY',
  ORDER_SHIPPED:           'SHIPPED',
  ORDER_DELIVERED:         'DELIVERED',
  ORDER_CANCELLED:         'CANCELLED',
  SHIPMENT_EXCEPTION_CREATED: 'INCIDENT',
}

@ApiTags('vendelo / webhooks')
@Controller('vendelo')
export class VendeloWebhookController {
  private readonly logger = new Logger(VendeloWebhookController.name)

  constructor(
    @Inject(ORDER_REPOSITORY)    private readonly orderRepo: IOrderRepository,
    @Inject(SHIPMENT_REPOSITORY) private readonly shipmentRepo: IShipmentRepository,
  ) {}

  /**
   * Recibe eventos del Chatbot Connection de Vendelo.
   * - Seguridad: VendeloWebhookGuard verifica HMAC-SHA256 antes de llegar aquí.
   * - Siempre responde 200 para evitar reintentos masivos de Vendelo.
   * - SyncShipmentStatus garantiza idempotencia con atomic WHERE.
   */
  @Post('webhook')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @UseGuards(VendeloWebhookGuard)
  @ApiOperation({ summary: 'Webhook del Chatbot Connection de Vendelo (eventos de envío)' })
  async webhook(@Body() payload: VendeloWebhookPayload) {
    const event = payload.event
    if (!event) {
      return { received: true, processed: false, reason: 'missing_event' }
    }

    const targetStatus = EVENT_TO_STATUS[event]
    if (!targetStatus) {
      // Evento conocido pero sin impacto en estado (ej. ORDER_CREATED, ORDER_CONFIRMATION_REQUESTED)
      return { received: true, processed: false, reason: 'event_not_tracked' }
    }

    const orderId = payload.data?.external_order_id
    if (!orderId) {
      this.logger.warn(`[VendeloWebhook] Evento ${event} sin external_order_id`)
      return { received: true, processed: false, reason: 'missing_order_id' }
    }

    const shipment = payload.data?.shipments?.[0]

    const useCase = new SyncShipmentStatus(this.shipmentRepo, this.orderRepo)
    const result = await useCase.execute({
      orderId,
      vendelo_status: targetStatus,
      trackingNumber: shipment?.tracking_number,
      carrier: shipment?.carrier,
    })

    if (!result.ok) {
      this.logger.error(
        `[VendeloWebhook] SyncShipmentStatus error orderId=${orderId} event=${event}: ${result.error.code}`,
      )
      return { received: true, processed: false, error: result.error.code }
    }

    if (result.value.updated) {
      this.revalidateOrdersCache(result.value.userId).catch((e) =>
        this.logger.warn(`[VendeloWebhook] No se pudo invalidar caché de pedidos: ${e}`),
      )
    }

    this.logger.log(
      `[VendeloWebhook] orderId=${orderId} userId=${result.value.userId} event=${event} updated=${result.value.updated} status=${result.value.newStatus}`,
    )
    return { received: true, processed: true, updated: result.value.updated }
  }

  /**
   * Invalida la caché del historial de pedidos en Next.js.
   * Usa el tag per-usuario para invalidar solo al cliente afectado — evita
   * que un webhook de Vendelo descarte la caché de todos los usuarios.
   * El tag global 'orders' se mantiene para invalidaciones masivas del admin.
   */
  private async revalidateOrdersCache(userId: string): Promise<void> {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'
    const secret = process.env['INTERNAL_API_SECRET'] ?? ''
    await fetch(`${frontendUrl}/api/internal/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ tags: [`orders:${userId}`] }),
      signal: AbortSignal.timeout(5000),
    })
  }
}
