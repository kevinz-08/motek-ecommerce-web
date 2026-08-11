import type { PaymentProvider } from './product.types'

// ── Enums ─────────────────────────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
export type PaymentStatus = 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING'

// ── Requests ─────────────────────────────────────────────────────────────────

export interface ShippingAddress {
  fullName: string
  address: string
  city: string
  department: string
  phone: string
  postalCode?: string
  notes?: string
}

export interface OrderItemRequest {
  productId: string
  /** Mínimo 1 */
  quantity: number
}

export interface CreateOrderRequest {
  items: OrderItemRequest[]
  shippingAddress: ShippingAddress
  paymentProvider: PaymentProvider
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface OrderItemResponse {
  id: string
  orderId: string
  productId: string
  quantity: number
  /** Precio al momento de la compra en centavos COP */
  priceAtPurchase: number
}

export interface OrderResponse {
  id: string
  userId: string
  status: OrderStatus
  /** Total cobrado en centavos COP (incluye envío cuando se cobró en línea) */
  total: number
  /** Componente de envío en centavos COP incluido en `total`. 0 si el negocio absorbió el flete. */
  shippingTotal: number
  shippingAddress: ShippingAddress
  paymentProvider: PaymentProvider
  items: OrderItemResponse[]
  createdAt: string
  updatedAt?: string
}

/** Datos de pago retornados junto con la orden creada */
export interface PaymentInitResponse {
  externalId: string | null
  reference: string
  redirectUrl?: string
  integritySignature?: string
  publicKey?: string
  /** Monto en centavos COP */
  amountInCents: number
  currency: string
}

/** Respuesta de POST /orders. `payment` es null para pedidos COD — no hay transacción de pasarela. */
export interface CreateOrderResponse {
  order: OrderResponse
  payment: PaymentInitResponse | null
}

/** Respuesta de PATCH /orders/:id/status */
export interface UpdateOrderStatusResponse {
  success: true
  status: OrderStatus
}
