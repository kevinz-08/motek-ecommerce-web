/**
 * Contrato HTTP de la API de Venndelo — transcrito del spec OpenAPI
 * (`https://api.venndelo.com/v1/admin/openapi-json`, ver API_VENDELO_DOCUMENTACION.md).
 *
 * Solo los esquemas que usa Motek. Montos en **pesos COP** (no centavos): la
 * conversión ↔ centavos ocurre en VendeloService, nunca fuera de él.
 * Los nombres de campo siguen el spec (snake_case) a propósito.
 */

export type ApiPaymentMethodCode = 'COD' | 'EXTERNAL_PAYMENT'
export type ApiLineItemType = 'STANDARD' | 'VIRTUAL'

export interface ApiPaginated<T> {
  curr_page_token: string
  /** Cadena vacía = última página. No usar page_item_count para detectar el fin. */
  next_page_token: string
  page_item_count: number
  items: T[]
}

// ── Pedidos ───────────────────────────────────────────────────────────────────

export interface ApiPickupInfo {
  contact_name: string
  contact_phone: string
  address_1: string
  city_code: string
  subdivision_code: string
  country_code: string
  postal_code: string
}

export interface ApiBillingInfo {
  first_name: string
  last_name: string
  email: string
  phone: string
  /** CC | PE | CE | NIT */
  identification_type: string
  identification: string
}

export interface ApiShippingInfo {
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address_1: string
  city_code: string
  city_name: string
  subdivision_code: string
  subdivision_name: string
  country_code: string
  postal_code: string
}

export interface ApiCreateOrderLineItem {
  type: ApiLineItemType
  variation_id?: number
  sku?: string
  name: string
  unit_price: number
  supplier_price?: number
  free_shipping?: boolean
  height: number
  width: number
  length: number
  dimensions_unit: 'CM'
  weight: number
  weight_unit: 'KG'
  quantity: number
}

export interface ApiCreateOrderDiscount {
  type: 'GLOBAL'
  amount: number
}

export interface ApiCreateOrderIn {
  pickup_info: ApiPickupInfo
  billing_info: ApiBillingInfo
  shipping_info: ApiShippingInfo
  line_items: ApiCreateOrderLineItem[]
  payment_method_code: ApiPaymentMethodCode
  external_order_id: string
  confirmation_status?: 'PENDING' | 'CONFIRMED'
  discounts: ApiCreateOrderDiscount[]
  buyer_note?: string
  staff_note?: string
}

export type ApiOrderStatus =
  | 'PENDING' | 'READY' | 'PREPARING' | 'SHIPPED'
  | 'INCIDENT' | 'DELIVERED' | 'RETURNED' | 'CANCELLED'

export type ApiTrackingStatus =
  | 'IN-ORIGIN' | 'IN-DESTINATION' | 'OUT-FOR-DELIVERY' | 'DELIVERED' | 'RETURN'
  | 'TRANSIT' | 'PENDING' | 'READY' | 'INCIDENT' | 'UNKNOWN' | 'AT-COLLECTION-POINT'

export interface ApiOrderShipment {
  tracking_number: string
  carrier_code: string
  carrier_name: string
  /** OUTBOUND = hacia el destinatario; RETURN = devolución hacia el origen */
  type: 'OUTBOUND' | 'RETURN'
  tracking_status: ApiTrackingStatus
  tracking_date: string | null
  delivery_date: string | null
  quoted_shipping_cost: number
  payment_url: string | null
  delivery_attempts: number
}

/** Subconjunto de ApiOrder que Motek consume. */
export interface ApiOrder {
  id: string
  pin: string
  status: ApiOrderStatus
  external_order_id: string
  shipments: ApiOrderShipment[]
  [key: string]: unknown
}

export interface ApiCreateOrderOut {
  items: ApiOrder[]
}

export interface ApiOrderQuotationLocation {
  city_code: string
  subdivision_code: string
  country_code: string
  postal_code: string
}

export interface ApiOrderQuotationLineItem {
  type?: ApiLineItemType
  variation_id?: number
  sku: string
  name: string
  unit_price: number
  free_shipping: boolean | null
  height: number | null
  width: number | null
  length: number | null
  dimensions_unit: 'CM'
  weight: number | null
  weight_unit: 'KG'
  quantity: number
}

export interface ApiOrderQuotationIn {
  pickup_info: ApiOrderQuotationLocation
  shipping_info: ApiOrderQuotationLocation
  line_items: ApiOrderQuotationLineItem[]
  payment_method_code: ApiPaymentMethodCode
}

export interface ApiOrderQuotationOut {
  assumed_shipping_total: number
  quoted_shipping_total: number
}

// ── Envíos ────────────────────────────────────────────────────────────────────

export type ApiLabelFormat = 'LETTER_2PP' | 'LABEL_10x10' | 'LABEL_10x15'
export type ApiLabelOutput = 'URL' | 'BASE64'

/** Etiquetas listas. `data` = URL o PDF en base64 según `output`. */
export interface ApiGenerateLabelsOut {
  status: 'SUCCESS'
  order_ids: string[]
  output: ApiLabelOutput
  data: string
}

/** Etiquetas aún en generación (create-shipments es asíncrono) o con error. */
export interface ApiGenerateLabelsStatusOut {
  status: 'PROCESSING' | 'ERROR'
  items_processed: number
  items_count: number
  items: Array<{
    order_id: string
    status: 'SUCCESS' | 'ERROR' | 'PROCESSING'
    errors: Array<{ code: string; message: string }>
  }>
}

export type ApiGenerateLabelsResult = ApiGenerateLabelsOut | ApiGenerateLabelsStatusOut

export interface ApiPickup {
  order_ids: string[]
  pickup_location_id: string
  address: string
}

// ── Cuenta y región ───────────────────────────────────────────────────────────

export interface ApiWalletBalance {
  balance: number
  detail: Array<{ description: string; amount: number }>
}

export interface ApiCity {
  country_code: string
  code: string
  name: string
  subdivision_code: string
  subdivision_name: string
  service_status: 'ACTIVE' | 'SUSPENDED'
  service_unavailable_message: string
}

export interface ApiReturnMessage {
  message: string
}
