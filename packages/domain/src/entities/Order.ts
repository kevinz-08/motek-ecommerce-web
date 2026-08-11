/**
 * Ciclo de vida de un pedido:
 *
 *   PENDING  →  PAID      (webhook confirma pago aprobado)
 *   PENDING  →  CANCELLED (webhook informa pago rechazado, o admin cancela)
 *   PAID     →  SHIPPED   (admin marca como despachado)
 *   SHIPPED  →  DELIVERED (admin marca como entregado)
 *
 *   Un pedido PENDING puede quedar huérfano si el cliente no completa el pago.
 */
export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

/**
 * Pasarela de pago seleccionada en el checkout.
 * WOMPI es la principal (siempre disponible).
 * MERCADO_PAGO es el respaldo (se activa/desactiva desde Settings en el panel admin).
 * COD ("Cash On Delivery") no es una pasarela — el pedido se confirma sin paso de
 * autorización online y el cliente paga en efectivo al repartidor de Vendelo.
 */
export type PaymentProvider = 'WOMPI' | 'MERCADO_PAGO' | 'COD'

/**
 * Método de entrega elegido en el checkout.
 *   HOME_DELIVERY — envío a domicilio vía Vendelo (comportamiento histórico).
 *   STORE_PICKUP  — el cliente retira en la tienda física; el flete siempre es $0
 *                   y el pedido nunca se encola en Vendelo (ver VendeloOrderQueueService).
 */
export type DeliveryMethod = 'HOME_DELIVERY' | 'STORE_PICKUP'

/**
 * Estados de pago según la nomenclatura oficial de Wompi.
 * Mercado Pago tiene su propia nomenclatura pero MercadoPagoService la mapea a estos valores.
 *
 *   PENDING  → El cliente no ha completado el pago aún
 *   APPROVED → Pago exitoso. El pedido pasa a PAID y se descuenta el stock.
 *   DECLINED → La transacción fue rechazada (fondos insuficientes, etc.)
 *   VOIDED   → La transacción fue anulada o reembolsada
 *   ERROR    → Error técnico en la pasarela
 */
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'

/**
 * Dirección de envío capturada en el checkout.
 * Se almacena como JSON en el campo Order.shippingAddress de PostgreSQL.
 * Al leerla, se castea de JsonValue a esta interfaz.
 */
export interface ShippingAddress {
  /** Nombre completo del destinatario */
  fullName: string
  /** Dirección completa. Ej: "Calle 45 # 23-10, Apto 302" */
  address: string
  /** Ciudad. Ej: "Medellín" */
  city: string
  /** Departamento. Ej: "Antioquia" */
  department?: string
  /** Teléfono de contacto para el mensajero */
  phone: string
  /** Código DIVIPOLA de 8 dígitos requerido por Vendelo. Ej: "05001000" para Medellín. */
  cityCode?: string
  /** Código de subdivisión dentro de la ciudad requerido por Vendelo. Ej: "02" */
  subdivisionCode?: string
  /** Código postal (opcional — no todas las ciudades colombianas lo usan) */
  postalCode?: string
  /** Instrucciones adicionales para el mensajero */
  notes?: string
}

/**
 * Línea de un pedido que vincula el pedido con un producto.
 * El precio se captura en el momento de la compra para preservar el histórico:
 * si el precio del producto cambia después, el pedido conserva el precio original.
 */
export interface OrderItem {
  /** ID único del ítem */
  id: string
  /** ID del pedido al que pertenece */
  orderId: string
  /** ID del producto comprado */
  productId: string
  /** Cantidad de unidades del producto en este ítem */
  quantity: number
  /**
   * Precio unitario al momento de la compra, en centavos COP.
   * Capturado por CreateOrder para preservar el histórico de precios.
   */
  priceAtPurchase: number
  /**
   * Datos del producto al momento de leer el pedido — opcional, solo presente
   * cuando el caller hizo include de la relación product. Usado por VendeloService
   * para reportar nombre/SKU reales en vez del productId (cuid) en line_items.
   */
  productSnapshot?: {
    sku: string
    name: string
    /** Peso/dimensiones reales embalados. null si el admin no los cargó —
     *  VendeloService cae a los defaults VENDELO_DEFAULT_* en ese caso. */
    weightKg?: number | null
    heightCm?: number | null
    widthCm?: number | null
    lengthCm?: number | null
  }
}

/**
 * Registro del pago asociado a un pedido (relación 1:1 con Order).
 * Se crea con status PENDING al mismo tiempo que el pedido.
 * El status y externalId se actualizan cuando llega el webhook de la pasarela.
 */
export interface Payment {
  /** ID único del pago */
  id: string
  /** ID del pedido asociado */
  orderId: string
  /** Pasarela que procesó el pago */
  provider: PaymentProvider
  /**
   * ID de la transacción en Wompi o Mercado Pago.
   * null hasta que la pasarela confirma el pago via webhook.
   * Ej Wompi: "24898-1706022601-41414"
   * Ej MP:    "1234567890"
   */
  externalId: string | null
  /** Estado del pago — se actualiza via webhook */
  status: PaymentStatus
  /** Monto del pago en centavos COP */
  amount: number
  /** Fecha de creación del registro de pago */
  createdAt: Date
}

/**
 * Entidad principal de pedido.
 * Se crea con status PENDING cuando el cliente confirma el checkout.
 * El status cambia a PAID cuando llega el webhook de la pasarela confirmando el pago.
 */
/**
 * Tipos de documento de identificación aceptados en Colombia.
 *   CC         — Cédula de Ciudadanía (compradores nacionales)
 *   CE         — Cédula de Extranjería (residentes extranjeros)
 *   NIT        — Número de Identificación Tributaria (personas jurídicas / B2B)
 *   PASAPORTE  — pasaporte para turistas o casos puntuales
 */
export type BuyerIdType = 'CC' | 'CE' | 'NIT' | 'PASAPORTE'

/**
 * Identificación tributaria/legal del comprador. Persiste en columnas separadas
 * de Order (no dentro de shippingAddress) porque:
 *   - El destinatario del envío y el comprador no siempre son la misma persona.
 *   - Se usa para emitir el comprobante de venta y como identificación válida
 *     en el pedido a Vendelo (reemplaza el hack histórico de usar el teléfono).
 *   - El admin lo necesita en columnas indexables para reportes/declaraciones.
 */
export interface BuyerInfo {
  idType: BuyerIdType
  idNumber: string
  /** Razón social — solo aplica cuando idType === 'NIT' (compras B2B). */
  businessName?: string
}

export interface Order {
  /** ID único del pedido (cuid) */
  id: string
  /** ID del usuario que realizó el pedido */
  userId: string
  /** Estado actual del ciclo de vida del pedido */
  status: OrderStatus
  /**
   * Total cobrado/adeudado en centavos COP: suma de priceAtPurchase × quantity de
   * cada ítem, más `shippingTotal` cuando el flete se cobró en línea. Para COD o
   * cuando el flete no se cobra en línea, es solo el subtotal de productos.
   */
  total: number
  /**
   * Componente de flete en centavos COP incluido en `total`. 0 = el negocio absorbió
   * el flete (pedido COD, toggle SHIPPING_ONLINE_ENABLED desactivado, o falla al
   * cotizar — ver CreateOrder.execute()).
   */
  shippingTotal: number
  /** Dirección de envío serializada como JSON en la base de datos */
  shippingAddress: ShippingAddress
  /** Método de entrega elegido en el checkout. Determina si se cobra/cotiza flete y si se encola a Vendelo. */
  deliveryMethod: DeliveryMethod
  /** Identificación tributaria del comprador (para comprobante y Vendelo) */
  buyer: BuyerInfo
  /** Pasarela de pago seleccionada en el checkout */
  paymentProvider: PaymentProvider
  /** Fecha de creación del pedido */
  createdAt: Date
  /** Ítems del pedido. Opcional — depende de si el query los incluye (include: { items: true }) */
  items?: OrderItem[]
  /** Pago asociado. Opcional — depende de si el query lo incluye (include: { payment: true }) */
  payment?: Payment
}
