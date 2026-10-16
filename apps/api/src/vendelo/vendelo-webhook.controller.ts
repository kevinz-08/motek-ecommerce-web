import {
  Body, Controller, HttpCode, Inject, Logger, Post, UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import {
  SyncShipmentStatus,
  IOrderRepository,
  IShipmentRepository,
} from '@motek/domain'
import { Public } from '../auth/decorators/public.decorator'
import { ORDER_REPOSITORY, SHIPMENT_REPOSITORY } from '../infrastructure/injection-tokens'
import { VendeloWebhookGuard } from './guards/vendelo-webhook.guard'
import { describeShape, parseVendeloWebhook } from './webhook/vendelo-webhook-payload'

@ApiTags('vendelo / webhooks')
@Controller('vendelo')
export class VendeloWebhookController {
  private readonly logger = new Logger(VendeloWebhookController.name)
  /**
   * Eventos cuya estructura ya se registró en logs en esta instancia. El
   * contrato del sobre del webhook no está documentado por Venndelo: el primer
   * evento de cada tipo deja su forma (sin valores) para poder fijarlo.
   */
  private readonly shapesLogged = new Set<string>()

  constructor(
    @Inject(ORDER_REPOSITORY)    private readonly orderRepo: IOrderRepository,
    @Inject(SHIPMENT_REPOSITORY) private readonly shipmentRepo: IShipmentRepository,
  ) {}

  /**
   * Recibe eventos del Chatbot Connection de Vendelo.
   * - Seguridad: VendeloWebhookGuard valida el secreto compartido en `metadata`.
   * - Siempre responde 200 para evitar reintentos masivos de Vendelo.
   * - El payload se normaliza con `parseVendeloWebhook` (tolerante a variantes
   *   de forma — ver ese módulo).
   * - SyncShipmentStatus garantiza idempotencia con atomic WHERE y nunca
   *   retrocede el estado, así que eventos duplicados o desordenados son inocuos.
   */
  @Post('webhook')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @UseGuards(VendeloWebhookGuard)
  @ApiOperation({ summary: 'Webhook del Chatbot Connection de Vendelo (eventos de envío)' })
  async webhook(@Body() payload: unknown) {
    const parsed = parseVendeloWebhook(payload)

    this.logShapeOnce(parsed.rawEvent ?? '(sin evento)', payload)

    if (!parsed.rawEvent) {
      this.logger.warn(`[VendeloWebhook] Payload sin evento — shape=${describeShape(payload).join(' ')}`)
      return { received: true, processed: false, reason: 'missing_event' }
    }
    if (!parsed.event) {
      this.logger.warn(`[VendeloWebhook] Evento desconocido "${parsed.rawEvent}" — se ignora`)
      return { received: true, processed: false, reason: 'unknown_event' }
    }

    const hasTrackingDetails = Boolean(
      parsed.trackingNumber || parsed.trackingStatus || parsed.deliveryAttempts !== null,
    )
    if (!parsed.targetStatus && !hasTrackingDetails) {
      // Evento conocido sin impacto en el envío (ej. ORDER_CREATED, ORDER_CONFIRMATION_REQUESTED)
      return { received: true, processed: false, reason: 'event_not_tracked' }
    }

    const orderId = parsed.externalOrderId
      ?? (parsed.vendeloOrderId ? await this.orderRepo.findIdByVendeloOrderId(parsed.vendeloOrderId) : null)
    if (!orderId) {
      this.logger.warn(
        `[VendeloWebhook] Evento ${parsed.event} sin pedido resoluble — shape=${describeShape(payload).join(' ')}`,
      )
      return { received: true, processed: false, reason: 'missing_order_id' }
    }

    // Sin estado nuevo (ej. SHIPMENT_STATUS_UPDATED con devolución en curso):
    // se reafirma el estado actual para registrar solo el detalle de seguimiento.
    const currentStatus = parsed.targetStatus
      ?? (await this.shipmentRepo.findByOrderId(orderId))?.status
    if (!currentStatus) {
      return { received: true, processed: false, reason: 'no_status_change' }
    }

    const result = await new SyncShipmentStatus(this.shipmentRepo, this.orderRepo).execute({
      orderId,
      vendelo_status: currentStatus,
      trackingNumber: parsed.trackingNumber ?? undefined,
      carrier: parsed.carrier ?? undefined,
      trackingStatus: parsed.trackingStatus ?? undefined,
      deliveryAttempts: parsed.deliveryAttempts ?? undefined,
      deliveredAt: parsed.deliveredAt ?? undefined,
      trackingUpdatedAt: parsed.trackingUpdatedAt ?? undefined,
    })

    if (!result.ok) {
      this.logger.error(
        `[VendeloWebhook] SyncShipmentStatus error orderId=${orderId} event=${parsed.event}: ${result.error.code}`,
      )
      return { received: true, processed: false, error: result.error.code }
    }

    const changed = result.value.updated || result.value.detailsUpdated

    // userId null = pedido de invitado: no hay historial cacheado por usuario que
    // invalidar (el comprador consulta por trackingToken, sin caché de sesión).
    if (changed && result.value.userId) {
      this.revalidateOrdersCache(result.value.userId).catch((e) =>
        this.logger.warn(`[VendeloWebhook] No se pudo invalidar caché de pedidos: ${e}`),
      )
    }

    this.logger.log(
      `[VendeloWebhook] orderId=${orderId} userId=${result.value.userId ?? 'guest'} event=${parsed.event} `
      + `updated=${result.value.updated} detailsUpdated=${result.value.detailsUpdated} status=${result.value.newStatus}`,
    )
    return {
      received: true,
      processed: true,
      updated: result.value.updated,
      detailsUpdated: result.value.detailsUpdated,
    }
  }

  /** Registra la estructura (sin valores) del primer evento de cada tipo. */
  private logShapeOnce(eventKey: string, payload: unknown): void {
    if (this.shapesLogged.has(eventKey)) return
    this.shapesLogged.add(eventKey)
    this.logger.log(`[VendeloWebhook] Estructura del evento ${eventKey}: ${describeShape(payload).join(' ')}`)
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
