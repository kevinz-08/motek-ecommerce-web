// ── Requests ─────────────────────────────────────────────────────────────────

export interface WompiIntegrityRequest {
  orderId: string
  /** Monto total en centavos COP */
  amountInCents: number
  /** Default: 'COP' */
  currency?: string
}

export interface MpPreferenceRequest {
  orderId: string
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface WompiIntegrityResponse {
  reference: string
  integritySignature: string
  publicKey: string
  amountInCents: number
  currency: string
}

/** Respuesta de POST /payments/mercadopago/create-preference */
export interface MpPreferenceResponse {
  /** URL de redirección al checkout de Mercado Pago */
  init_point: string
}

/** Respuesta genérica de webhooks */
export interface WebhookAckResponse {
  received: true
  processed?: boolean
  stateChanged?: boolean
  error?: string
}
