import {
  Body, Controller, Headers, HttpCode, Inject, Logger, Post, UnauthorizedException,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { ConfirmPayment, IOrderRepository, PaymentStatus } from '@motek/domain'
import { ORDER_REPOSITORY } from '../infrastructure/injection-tokens'
import { WompiService } from '../infrastructure/services/WompiService'
import { ResendEmailService } from '../infrastructure/services/ResendEmailService'
import { PrismaService } from '../infrastructure/database/prisma.service'
import { Public } from '../auth/decorators/public.decorator'
import { EmailQueueService } from '../infrastructure/services/EmailQueueService'
import { VendeloOrderQueueService } from '../infrastructure/services/VendeloOrderQueueService'

@ApiTags('payments')
@Controller('payments/wompi')
export class WompiController {
  private readonly logger = new Logger(WompiController.name)

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: IOrderRepository,
    private readonly wompiService: WompiService,
    private readonly emailService: ResendEmailService,
    private readonly emailQueue: EmailQueueService,
    private readonly vendeloOrderQueue: VendeloOrderQueueService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Recibe eventos de pago de Wompi.
   * Siempre responde 200 para evitar reintentos masivos salvo firma inválida (401).
   */
  @Post('webhook')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook de eventos de pago Wompi' })
  async webhook(@Body() payload: unknown, @Headers() rawHeaders: Record<string, string | string[] | undefined>) {
    if (!this.wompiService.validateWebhook(payload, this.toHeaders(rawHeaders))) {
      throw new UnauthorizedException('Firma de webhook inválida')
    }

    const event = payload as {
      event?: string
      data?: {
        transaction?: {
          id?: string
          reference?: string
          status?: string
          amount_in_cents?: number
        }
      }
    }

    if (!event.event?.startsWith('transaction.')) {
      return { received: true, processed: false }
    }

    const tx = event.data?.transaction
    if (!tx?.id || !tx.reference || !tx.status) {
      this.logger.warn('[Wompi webhook] Evento sin campos requeridos')
      return { received: true, error: 'missing_transaction_fields' }
    }

    const refMatch = tx.reference.match(/^ORDER-(.+)-(\d+)$/)
    if (!refMatch?.[1]) {
      this.logger.warn(`[Wompi webhook] Referencia inválida: "${tx.reference}"`)
      return { received: true, error: 'invalid_reference' }
    }
    const orderId = refMatch[1]

    const statusMap: Record<string, PaymentStatus> = {
      APPROVED: 'APPROVED', DECLINED: 'DECLINED',
      VOIDED: 'VOIDED', ERROR: 'ERROR', PENDING: 'PENDING',
    }
    const paymentStatus: PaymentStatus = statusMap[tx.status] ?? 'ERROR'

    const confirmPayment = new ConfirmPayment(this.orderRepo)
    const result = await confirmPayment.execute({
      orderId,
      externalId: tx.id,
      status: paymentStatus,
      amountInCents: tx.amount_in_cents,
    })

    if (!result.ok) {
      this.logger.error(`[Wompi webhook] ConfirmPayment error pedido=${orderId}: ${result.error.code}`)
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

    this.logger.log(
      `[Wompi webhook] pedido=${orderId} status=${paymentStatus} stateChanged=${result.value.stateChanged}`,
    )
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
