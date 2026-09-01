import { createHmac } from 'crypto'
import { MercadoPagoConfig, Preference, Payment as MPPayment } from 'mercadopago'
import { IPaymentService, PaymentResult } from '@motek/domain'
import { Order, PaymentStatus } from '@motek/domain'

/**
 * Implementación de Mercado Pago como pasarela de respaldo.
 * Solo se activa si Settings.MERCADOPAGO_ENABLED = 'true' en el panel admin.
 *
 * @see https://www.mercadopago.com.co/developers/es/docs
 */
export class MercadoPagoService implements IPaymentService {
  private readonly client: MercadoPagoConfig
  private readonly webhookSecret: string

  constructor() {
    this.client = new MercadoPagoConfig({
      accessToken: process.env['MP_ACCESS_TOKEN'] ?? '',
    })
    this.webhookSecret = process.env['MP_WEBHOOK_SECRET'] ?? ''
  }

  /**
   * Crea una preference en Mercado Pago y retorna la URL de pago.
   * El cliente es redirigido a la URL de Mercado Pago para completar el pago.
   */
  async createTransaction(order: Order): Promise<PaymentResult> {
    if (!order.items || order.items.length === 0) {
      throw new Error('El pedido no tiene ítems')
    }

    const preference = new Preference(this.client)
    const reference = `ORDER-${order.id}-${Date.now()}`

    const response = await preference.create({
      body: {
        external_reference: reference,
        items: order.items.map((item) => ({
          id: item.productId,
          title: `Producto ${item.productId}`,
          quantity: item.quantity,
          unit_price: item.priceAtPurchase / 100, // MP usa pesos, no centavos
          currency_id: 'COP',
        })),
        back_urls: {
          success: `${process.env['NEXTAUTH_URL']}/checkout/success`,
          failure: `${process.env['NEXTAUTH_URL']}/checkout/failure`,
          pending: `${process.env['NEXTAUTH_URL']}/checkout/pending`,
        },
        notification_url: `${process.env['NEXTAUTH_URL']}/api/payments/mercadopago/webhook`,
        statement_descriptor: 'Motek Store',
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

  /** Consulta el estado de un pago en Mercado Pago y mapea a PaymentStatus */
  async getTransactionStatus(externalId: string): Promise<PaymentStatus> {
    const payment = new MPPayment(this.client)
    const response = await payment.get({ id: externalId })

    const statusMap: Record<string, PaymentStatus> = {
      pending: 'PENDING',
      approved: 'APPROVED',
      authorized: 'APPROVED',
      in_process: 'PENDING',
      in_mediation: 'PENDING',
      rejected: 'DECLINED',
      cancelled: 'VOIDED',
      refunded: 'VOIDED',
      charged_back: 'VOIDED',
    }

    const mpStatus = response.status ?? 'error'
    return statusMap[mpStatus] ?? 'ERROR'
  }

  /**
   * Valida la firma del webhook de Mercado Pago.
   * Verifica el header x-signature contra el webhook secret.
   */
  validateWebhook(payload: unknown, headers: Headers): boolean {
    try {
      const xSignature = headers.get('x-signature')
      const xRequestId = headers.get('x-request-id')

      if (!xSignature || !xRequestId) return false

      // Extraer ts y v1 del header x-signature
      const parts = Object.fromEntries(
        xSignature.split(',').map((part) => {
          const [key, value] = part.trim().split('=')
          return [key ?? '', value ?? '']
        }),
      )

      const ts = parts['ts']
      const v1 = parts['v1']
      if (!ts || !v1) return false

      // Obtener el data.id del payload
      const body = payload as { data?: { id?: string } }
      const dataId = body?.data?.id ?? ''

      // Construir el manifest: id:[data.id];request-id:[x-request-id];ts:[ts];
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(manifest)
        .digest('hex')

      return expectedSignature === v1
    } catch {
      return false
    }
  }
}
