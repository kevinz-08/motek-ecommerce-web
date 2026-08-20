import { Injectable } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'crypto'
import { MercadoPagoConfig, Preference, Payment as MPPayment } from 'mercadopago'
import { IPaymentService, PaymentResult } from '@motek/domain'
import { Order, PaymentStatus } from '@motek/domain'

@Injectable()
export class MercadoPagoService implements IPaymentService {
  private readonly client: MercadoPagoConfig
  private readonly webhookSecret: string

  constructor() {
    this.client = new MercadoPagoConfig({ accessToken: process.env['MP_ACCESS_TOKEN'] ?? '' })
    this.webhookSecret = process.env['MP_WEBHOOK_SECRET'] ?? ''
  }

  async createTransaction(order: Order): Promise<PaymentResult> {
    if (!order.items || order.items.length === 0) throw new Error('El pedido no tiene ítems')

    const preference = new Preference(this.client)
    const reference = `ORDER-${order.id}-${Date.now()}`
    const apiUrl = process.env['API_URL'] ?? process.env['NEXTAUTH_URL'] ?? 'http://localhost:3001'

    const response = await preference.create({
      body: {
        external_reference: reference,
        items: order.items.map((item) => ({
          id: item.productId,
          title: `Producto ${item.productId}`,
          quantity: item.quantity,
          unit_price: item.priceAtPurchase / 100,
          currency_id: 'COP',
        })),
        back_urls: {
          success: `${process.env['FRONTEND_URL'] ?? 'http://localhost:3000'}/checkout/success`,
          failure: `${process.env['FRONTEND_URL'] ?? 'http://localhost:3000'}/checkout/failure`,
          pending: `${process.env['FRONTEND_URL'] ?? 'http://localhost:3000'}/checkout/pending`,
        },
        notification_url: `${apiUrl}/payments/mercadopago/webhook`,
        statement_descriptor: 'MOTEK STORE',
      },
    })

    return {
      externalId: response.id ?? null,
      reference,
      redirectUrl: response.init_point ?? undefined,
      amountInCents: order.total,
      currency: 'COP',
    }
  }

  async getTransactionStatus(externalId: string): Promise<PaymentStatus> {
    const payment = new MPPayment(this.client)
    const response = await payment.get({ id: externalId })

    const statusMap: Record<string, PaymentStatus> = {
      pending: 'PENDING', approved: 'APPROVED', authorized: 'APPROVED',
      in_process: 'PENDING', in_mediation: 'PENDING',
      rejected: 'DECLINED', cancelled: 'VOIDED', refunded: 'VOIDED', charged_back: 'VOIDED',
    }

    return statusMap[response.status ?? 'error'] ?? 'ERROR'
  }

  validateWebhook(payload: unknown, headers: Headers): boolean {
    try {
      const xSignature = headers.get('x-signature')
      const xRequestId = headers.get('x-request-id')
      if (!xSignature || !xRequestId) return false

      const parts = Object.fromEntries(
        xSignature.split(',').map((part) => {
          const [key, value] = part.trim().split('=')
          return [key ?? '', value ?? '']
        }),
      )

      const ts = parts['ts']
      const v1 = parts['v1']
      if (!ts || !v1) return false

      // Protección anti-replay: ventana de 10 minutos (600 segundos)
      const tsNum = parseInt(ts, 10)
      if (isNaN(tsNum)) return false
      const nowSec = Math.floor(Date.now() / 1000)
      if (Math.abs(nowSec - tsNum) > 600) return false

      const body = payload as { data?: { id?: string } }
      const dataId = body?.data?.id ?? ''
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

      const expected = Buffer.from(
        createHmac('sha256', this.webhookSecret).update(manifest).digest('hex'),
      )
      const received = Buffer.from(v1)
      if (expected.length !== received.length) return false
      return timingSafeEqual(expected, received)
    } catch {
      return false
    }
  }
}
