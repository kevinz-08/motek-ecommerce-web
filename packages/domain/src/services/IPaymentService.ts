import { Order } from '@/domain/entities/Order'
import { PaymentStatus } from '@/domain/entities/Order'

/** Resultado de iniciar una transacción en la pasarela */
export interface PaymentResult {
  /** ID externo de la transacción en la pasarela */
  externalId: string | null
  /** Referencia única enviada a la pasarela */
  reference: string
  /** URL de redirección (solo para flujos redirect como PSE) */
  redirectUrl?: string
  /** Firma de integridad para el Widget de Wompi */
  integritySignature?: string
  /** Llave pública del comercio */
  publicKey?: string
  /** Monto en centavos COP */
  amountInCents: number
  /** Moneda — siempre "COP" */
  currency: string
}

/**
 * Abstracción de pasarela de pago.
 * WompiService y MercadoPagoService implementan esta interfaz.
 * Los use cases dependen de esta abstracción, nunca de las implementaciones concretas.
 */
export interface IPaymentService {
  /**
   * Prepara los datos para iniciar una transacción.
   * Para Wompi retorna los parámetros del Widget.
   * Para Mercado Pago crea una preference y retorna la URL.
   */
  createTransaction(order: Order): Promise<PaymentResult>

  /** Consulta el estado actual de una transacción por su ID externo */
  getTransactionStatus(externalId: string): Promise<PaymentStatus>

  /**
   * Valida que un webhook sea auténtico.
   * Verifica la firma criptográfica antes de procesar el evento.
   * Retorna false si la firma no es válida — el webhook debe ser rechazado con 401.
   */
  validateWebhook(payload: unknown, headers: Headers): boolean
}
