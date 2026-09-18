/**
 * Identidad del comprador en el momento del checkout.
 *
 * Es un union discriminado a propósito, no un `userId?: string`. Las reglas de
 * negocio que dependen de la identidad (COD, cupones restringidos, reputación de
 * envío) tienen que ramificar de forma exhaustiva; con un campo opcional el
 * compilador no obliga a considerar el caso invitado y las reglas se olvidan
 * silenciosamente en el siguiente use case que se escriba.
 *
 *   'user'  → sesión autenticada. La propiedad del email está probada (registro
 *             con OTP o OAuth de Google), así que se puede confiar en el historial
 *             asociado a esa identidad.
 *   'guest'  → compra sin cuenta. El email es texto de un formulario: NO prueba
 *             identidad. Cualquiera puede escribir el correo de otra persona.
 */
export type OrderCustomer =
  | {
      kind: 'user'
      userId: string
      /** Email de la cuenta — se copia a Order.contactEmail. */
      email: string
    }
  | {
      kind: 'guest'
      email: string
      name: string
      phone?: string
      /** Consentimiento de marketing, separado del de T&C (Ley 1581/2012). */
      marketingConsent?: boolean
    }

/**
 * Comprador sin cuenta persistido en la BD. Nunca puede iniciar sesión: existe
 * solo para dar un dueño a los pedidos de invitado y conservar sus datos de
 * contacto y consentimientos.
 */
export interface GuestCustomer {
  id: string
  email: string
  name: string | null
  phone: string | null
  marketingConsent: boolean
  createdAt: Date
}

/**
 * Motivos por los que una operación exige cuenta. Se usan como `details` del
 * AppError('UNAUTHORIZED') para que el frontend pueda mostrar el CTA correcto
 * ("Inicia sesión para pagar contra entrega" vs "…para usar este cupón") sin
 * parsear el mensaje.
 */
export type AccountRequiredReason = 'COD_PAYMENT' | 'RESTRICTED_COUPON'
