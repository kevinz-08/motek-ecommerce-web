import {
  Body, Controller, Headers, HttpCode, Inject, Logger, NotFoundException, Post, UnauthorizedException,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { ConfirmPayment, IOrderRepository, PaymentStatus } from '@motek/domain'
import { ORDER_REPOSITORY } from '../infrastructure/injection-tokens'
import { MercadoPagoService } from '../infrastructure/services/MercadoPagoService'
import { ResendEmailService } from '../infrastructure/services/ResendEmailService'
import { PrismaService } from '../infrastructure/database/prisma.service'
import { Public } from '../auth/decorators/public.decorator'
import { EmailQueueService } from '../infrastructure/services/EmailQueueService'
import { VendeloOrderQueueService } from '../infrastructure/services/VendeloOrderQueueService'
import { MpPreferenceDto } from './dto/mp-preference.dto'

@ApiTags('payments')
@ApiBearerAuth('access-token')
@Controller('payments/mercadopago')
export class MercadoPagoController {
  private readonly logger = new Logger(MercadoPagoController.name)

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: IOrderRepository,
    private readonly mpService: MercadoPagoService,
    private readonly emailService: ResendEmailService,
    private readonly emailQueue: EmailQueueService,
    private readonly vendeloOrderQueue: VendeloOrderQueueService,
    private readonly prisma: PrismaService,
  ) {}

  /** Crea una preferencia de pago en Mercado Pago y retorna el init_point */
  @Post('create-preference')
  @HttpCode(200)
  @ApiOperation({ summary: 'Crear preferencia de pago en Mercado Pago' })
  async createPreference(@Body() dto: MpPreferenceDto) {
    const order = await this.orderRepo.findById(dto.orderId)
    if (!order) throw new NotFoundException('Pedido no encontrado')
    return this.mpService.createTransaction(order)
  }

  /**
   * Recibe notificaciones IPN de Mercado Pago.
   * Siempre responde 200 salvo firma inválida (401).
   */
  @Post('webhook')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook IPN de Mercado Pago' })
  async webhook(@Body() payload: unknown, @Headers() rawHeaders: Record<string, string | string[] | undefined>) {
    if (!this.mpService.validateWebhook(payload, this.toHeaders(rawHeaders))) {
      throw new UnauthorizedException('Firma de webhook inválida')
    }

    const event = payload as {
      type?: string
      data?: { id?: string }
      external_reference?: string
    }

    if (event.type !== 'payment') {
      return { received: true, processed: false }
    }

    const externalId = event.data?.id
    if (!externalId) {
      return { received: true, error: 'missing_payment_id' }
    }

    let paymentStatus: PaymentStatus
    try {
      paymentStatus = await this.mpService.getTransactionStatus(externalId)
    } catch (e) {
      this.logger.error('[MP webhook] Error consultando estado de pago:', e)
      return { received: true, error: 'payment_status_error' }
    }

    const parts = (event.external_reference ?? '').split('-')
    if (parts[0] !== 'ORDER' || !parts[1]) {
      this.logger.warn(`[MP webhook] external_reference inválida: "${event.external_reference}"`)
      return { received: true, error: 'invalid_reference' }
    }
    const orderId = parts[1]

    const confirmPayment = new ConfirmPayment(this.orderRepo)
    const result = await confirmPayment.execute({ orderId, externalId, status: paymentStatus })

    if (!result.ok) {
      this.logger.error(`[MP webhook] ConfirmPayment error pedido=${orderId}: ${result.error.message}`)
      return { received: true, error: result.error.code }
    }

    if (paymentStatus === 'APPROVED' && result.value.stateChanged) {
      const order = await this.orderRepo.findById(orderId)
      if (order) {
        // contactEmail está siempre presente (pedidos de usuario y de invitado),
        // así que no hace falta join a User — que además no existe para invitados.
        await this.emailQueue.enqueue(order.contactEmail, orderId)
        // Retiro en tienda: el cliente lo recoge en persona, nunca se despacha
        // por Vendelo — no encolar o un mensajero saldría a entregar en falso.
        if (order.deliveryMethod !== 'STORE_PICKUP') {
          await this.vendeloOrderQueue.enqueue(orderId)
        }
      }
    }

    return { received: true, stateChanged: result.value.stateChanged }
  }

  private toHeaders(raw: Record<string, string | string[] | undefined>): Headers {
    return {
      get: (name: string) => {
        const v = raw[name.toLowerCase()]
        return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
      },
    } as unknown as Headers
  }
}
