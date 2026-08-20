import { Injectable, Logger } from '@nestjs/common'
import { createHash, timingSafeEqual } from 'crypto'
import { IPaymentService, PaymentResult, AppError } from '@motek/domain'
import { Order, PaymentStatus } from '@motek/domain'

interface WompiWebhookEvent {
  event: string
  data: {
    transaction: {
      id: string
      reference: string
      status: string
      amount_in_cents: number
      currency: string
    }
  }
  sent_at: string
  timestamp: number
  signature: {
    checksum: string
    properties: string[]
  }
}

interface WompiTransaction {
  data: {
    id: string
    status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
    amount_in_cents: number
    reference: string
  }
}

const WOMPI_BASE_URLS = {
  sandbox: 'https://sandbox.wompi.co/v1',
  production: 'https://production.wompi.co/v1',
} as const

const WEBHOOK_MAX_AGE_SECONDS = 600

@Injectable()
export class WompiService implements IPaymentService {
  private readonly logger = new Logger(WompiService.name)
  private readonly baseUrl: string
  private readonly publicKey: string
  private readonly privateKey: string
  private readonly integritySecret: string
  private readonly eventsSecret: string

  constructor() {
    const env = (process.env['WOMPI_ENV'] ?? 'sandbox') as 'sandbox' | 'production'
    this.baseUrl = WOMPI_BASE_URLS[env]
    this.publicKey = process.env['WOMPI_PUBLIC_KEY'] ?? ''
    this.privateKey = process.env['WOMPI_PRIVATE_KEY'] ?? ''
    this.integritySecret = process.env['WOMPI_INTEGRITY_SECRET'] ?? ''
    this.eventsSecret = process.env['WOMPI_EVENTS_SECRET'] ?? ''
  }

  async createTransaction(order: Order): Promise<PaymentResult> {
    const reference = `ORDER-${order.id}-${Date.now()}`
    const currency = 'COP'
    const amountInCents = order.total

    const integritySignature = WompiService.computeIntegritySignature(
      reference,
      amountInCents,
      currency,
      this.integritySecret,
    )

    return { externalId: null, reference, integritySignature, publicKey: this.publicKey, amountInCents, currency }
  }

  async getTransactionStatus(externalId: string): Promise<PaymentStatus> {
    const response = await fetch(`${this.baseUrl}/transactions/${externalId}`, {
      headers: { Authorization: `Bearer ${this.privateKey}` },
    })

    if (!response.ok) {
      throw new AppError('INTERNAL_ERROR', `Wompi API respondió con ${response.status} al consultar transacción ${externalId}`)
    }

    const data = (await response.json()) as WompiTransaction
    const statusMap: Record<string, PaymentStatus> = {
      PENDING: 'PENDING', APPROVED: 'APPROVED', DECLINED: 'DECLINED', VOIDED: 'VOIDED', ERROR: 'ERROR',
    }
    return statusMap[data.data.status] ?? 'ERROR'
  }

  validateWebhook(payload: unknown, _headers: Headers): boolean {
    if (!this.eventsSecret) {
      this.logger.error('WOMPI_EVENTS_SECRET no está configurado — webhook no se puede validar')
      return false
    }

    try {
      const event = payload as WompiWebhookEvent
      const { signature, timestamp, data } = event

      if (!signature?.checksum || !Array.isArray(signature?.properties) || !timestamp || !data) {
        this.logger.warn('Webhook rechazado: estructura inválida')
        return false
      }

      const nowSeconds = Math.floor(Date.now() / 1000)
      const ageSeconds = Math.abs(nowSeconds - Number(timestamp))
      if (!Number.isFinite(ageSeconds) || ageSeconds > WEBHOOK_MAX_AGE_SECONDS) {
        this.logger.warn(`Webhook rechazado: timestamp fuera de ventana (${ageSeconds}s)`)
        return false
      }

      const propertyValues = signature.properties.map((prop) => {
        const parts = prop.split('.')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let value: any = data
        for (const part of parts) { value = value?.[part] }
        return value == null ? '' : String(value)
      })

      const stringToHash = `${propertyValues.join('')}${timestamp}${this.eventsSecret}`
      const expectedChecksum = createHash('sha256').update(stringToHash).digest('hex')

      const provided = String(signature.checksum)
      if (provided.length !== expectedChecksum.length) {
        this.logger.warn('Webhook rechazado: checksum con longitud inesperada')
        return false
      }

      const match = timingSafeEqual(
        Buffer.from(provided, 'utf8'),
        Buffer.from(expectedChecksum, 'utf8'),
      )
      if (!match) this.logger.warn('Webhook rechazado: checksum no coincide')
      return match
    } catch (e) {
      this.logger.warn(`Webhook rechazado: excepción al validar firma — ${e}`)
      return false
    }
  }

  static computeIntegritySignature(
    reference: string,
    amountInCents: number,
    currency: string,
    integritySecret: string,
  ): string {
    return createHash('sha256')
      .update(`${reference}${amountInCents}${currency}${integritySecret}`)
      .digest('hex')
  }

  static computeEventChecksum(propertyValues: string[], timestamp: number, eventsSecret: string): string {
    return createHash('sha256')
      .update(`${propertyValues.join('')}${timestamp}${eventsSecret}`)
      .digest('hex')
  }
}
