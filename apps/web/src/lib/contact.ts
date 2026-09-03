export const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''

const DEFAULT_MESSAGE = 'Hola Motek,\nEstoy interesado en algo para mi moto'

export const WHATSAPP_URL = (message?: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message ?? DEFAULT_MESSAGE)}`

/** Dirección física de la tienda — usada en el checkout para retiro en tienda y en el Footer. */
export const STORE_ADDRESS = 'Boulevard Santander #23-31, Bucaramanga, Santander'
export const STORE_CITY = 'Bucaramanga'
export const STORE_COUNTRY = 'Colombia'

/** Número de contacto — mostrado en Footer/contacto. Formato E.164 para el link `tel:`. */
export const STORE_PHONE_DISPLAY = '+57 316 759 3670'
export const STORE_PHONE_TEL = '+573167593670'

export const STORE_EMAIL = 'motekstore@gmail.com'

/** Embed de Google Maps sin necesidad de API key (modo `output=embed`). */
export const STORE_MAP_EMBED_URL =
  `https://www.google.com/maps?q=${encodeURIComponent(STORE_ADDRESS)}&output=embed`

/** Link "abrir en Google Maps" (no embed) — usado en Footer/contacto. */
export const STORE_MAP_URL =
  `https://maps.google.com/?q=${encodeURIComponent(STORE_ADDRESS)}`
