import { Injectable, Logger } from '@nestjs/common'
import {
  Order,
  IVendeloShippingPort,
  ShipmentExceptionDetail,
  ExceptionResolution,
  ShipmentStatus,
  TrackingStatus,
  VendeloOrderNotFoundError,
  VendeloOrderSnapshot,
  VendeloQuoteInput,
  VendeloQuoteResult,
  getDepartmentName,
} from '@motek/domain'
import { VendeloHttpClient } from './VendeloHttpClient'
import type {
  ApiCity,
  ApiCreateOrderIn,
  ApiCreateOrderOut,
  ApiGenerateLabelsResult,
  ApiLabelFormat,
  ApiLabelOutput,
  ApiOrder,
  ApiOrderQuotationIn,
  ApiOrderQuotationOut,
  ApiOrderShipment,
  ApiPaginated,
  ApiPickup,
  ApiReturnMessage,
  ApiWalletBalance,
} from './vendelo-api.types'

export type VendeloAuthInfo = ApiReturnMessage
export type VendelloCityItem = ApiCity
export type VendeloCreateOrderResponse = ApiCreateOrderOut
export type LabelFormat = ApiLabelFormat
export type LabelOutput = ApiLabelOutput
export type GenerateLabelsResponse = ApiGenerateLabelsResult

interface PaginatedExceptionsResponse extends ApiPaginated<ShipmentExceptionDetail> {}

export interface GetExceptionsParams {
  page_token?: string
  page_size?: number
  status?: string
  created_min?: string
  created_max?: string
}

/** Peso/dimensiones por defecto cuando el producto no los tiene cargados. */
function defaultPackage() {
  return {
    weightKg: parseFloat(process.env['VENDELO_DEFAULT_WEIGHT_KG'] ?? '1'),
    heightCm: parseInt(process.env['VENDELO_DEFAULT_HEIGHT_CM'] ?? '25', 10),
    widthCm: parseInt(process.env['VENDELO_DEFAULT_WIDTH_CM'] ?? '25', 10),
    lengthCm: parseInt(process.env['VENDELO_DEFAULT_LENGTH_CM'] ?? '10', 10),
  }
}

function storePickupLocation() {
  return {
    cityCode: process.env['VENDELO_STORE_CITY_CODE'] ?? '05001000',
    subdivisionCode: process.env['VENDELO_STORE_SUBDIVISION_CODE'] ?? '02',
  }
}

/** Centavos COP (convención del dominio) → pesos COP (convención de Venndelo). */
const toPesos = (cents: number) => cents / 100

/** IDs por request en la consulta por lote: ~50 UUIDs mantienen la URL en ~2 KB. */
const BATCH_CHUNK_SIZE = 50

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : new Date(ms)
}

/**
 * Un pedido puede tener el envío saliente y, si hubo devolución, uno de
 * retorno. El seguimiento que ve el cliente es el saliente.
 */
export function pickOutboundShipment(shipments: ApiOrderShipment[] | undefined): ApiOrderShipment | undefined {
  if (!shipments?.length) return undefined
  return shipments.find((s) => s.type === 'OUTBOUND') ?? shipments[0]
}

/** ApiOrder (spec de Venndelo) → snapshot de dominio usado por el polling. */
export function toOrderSnapshot(raw: ApiOrder): VendeloOrderSnapshot {
  const shipment = pickOutboundShipment(raw.shipments)
  return {
    id: raw.id,
    externalOrderId: raw.external_order_id || null,
    // ApiOrderStatus y ShipmentStatus comparten los mismos 8 valores
    status: raw.status as ShipmentStatus,
    trackingNumber: shipment?.tracking_number || null,
    carrier: shipment?.carrier_name || shipment?.carrier_code || null,
    trackingStatus: (shipment?.tracking_status as TrackingStatus | undefined) ?? null,
    deliveryAttempts: typeof shipment?.delivery_attempts === 'number' ? shipment.delivery_attempts : null,
    deliveredAt: parseDate(shipment?.delivery_date),
    trackingUpdatedAt: parseDate(shipment?.tracking_date),
  }
}

@Injectable()
export class VendeloService implements IVendeloShippingPort {
  private readonly logger = new Logger(VendeloService.name)

  constructor(private readonly http: VendeloHttpClient) {}

  /** Modo de autenticación activo (apikey | oauth) — para el health check admin. */
  getAuthMode() {
    return this.http.getAuthMode()
  }

  async checkAuth(): Promise<VendeloAuthInfo> {
    this.logger.log('Verificando autenticación con Vendelo API')
    return this.http.get<VendeloAuthInfo>('/v1/admin/check-auth')
  }

  async getCitiesPage(pageToken = '', pageSize = 500): Promise<ApiPaginated<VendelloCityItem>> {
    const params = new URLSearchParams({ page_size: String(pageSize) })
    if (pageToken) params.set('page_token', pageToken)
    return this.http.get<ApiPaginated<VendelloCityItem>>(`/v1/admin/region/cities?${params}`)
  }

  async getAllCities(): Promise<VendelloCityItem[]> {
    const cities: VendelloCityItem[] = []
    let pageToken = ''

    do {
      const page = await this.getCitiesPage(pageToken)
      cities.push(...page.items)
      pageToken = page.next_page_token
      this.logger.log(`Ciudades cargadas: ${cities.length} (next_page_token: "${pageToken || 'fin'}")`)
    } while (pageToken !== '')

    return cities
  }

  async createOrder(order: Order, userEmail: string): Promise<VendeloCreateOrderResponse> {
    const addr = order.shippingAddress

    const nameParts = addr.fullName.trim().split(/\s+/)
    const firstName = nameParts[0] ?? addr.fullName
    const lastName = nameParts.slice(1).join(' ') || firstName

    const pickup = storePickupLocation()
    const defaults = defaultPackage()

    const shippingSubdivision = addr.subdivisionCode ?? pickup.subdivisionCode

    const body: ApiCreateOrderIn = {
      pickup_info: {
        contact_name: process.env['VENDELO_STORE_NAME'] ?? 'Motek Store',
        contact_phone: process.env['VENDELO_STORE_PHONE'] ?? '3000000000',
        address_1: process.env['VENDELO_STORE_ADDRESS'] ?? 'Dirección de la tienda',
        city_code: pickup.cityCode,
        subdivision_code: pickup.subdivisionCode,
        country_code: 'CO',
        postal_code: '',
      },
      billing_info: {
        first_name: firstName,
        last_name: lastName,
        email: userEmail,
        phone: addr.phone,
        // Antes usábamos `phone` como hack porque no recolectábamos cédula.
        // Ahora viene del checkout (Order.buyer) — identificación real del comprador
        // que Vendelo necesita para emitir su guía y facilitar disputas.
        // PASAPORTE se mapea a CC porque la API de Vendelo no expone PASAPORTE
        // como tipo válido; el número se conserva igual.
        identification_type: order.buyer.idType === 'PASAPORTE' ? 'CC' : order.buyer.idType,
        identification: order.buyer.idNumber,
      },
      shipping_info: {
        first_name: firstName,
        last_name: lastName,
        email: userEmail,
        phone: addr.phone,
        address_1: addr.address,
        city_code: addr.cityCode ?? pickup.cityCode,
        city_name: addr.city,
        subdivision_code: shippingSubdivision,
        // El checkout guarda el departamento como texto libre opcional; si no
        // vino, se deriva del código DIVIPOLA (campo requerido por el spec).
        subdivision_name: addr.department?.trim() || getDepartmentName(shippingSubdivision),
        country_code: 'CO',
        postal_code: addr.postalCode ?? '',
      },
      line_items: (order.items ?? []).map((item) => ({
        type: 'STANDARD' as const,
        name: item.productSnapshot?.name ?? `Producto ${item.productId}`,
        sku: item.productSnapshot?.sku ?? item.productId,
        quantity: item.quantity,
        // Siempre el precio real — probado en producción que Vendelo rechaza
        // (500 "invalid values") un pedido payment_method_code:'COD' con
        // unit_price:0.
        unit_price: toPesos(item.priceAtPurchase),
        // Peso/dimensiones reales del producto si el admin los cargó — si no,
        // caemos al default genérico (causa de discrepancia entre el flete
        // cotizado y el flete real cobrado por Vendelo).
        weight: item.productSnapshot?.weightKg ?? defaults.weightKg,
        weight_unit: 'KG' as const,
        height: item.productSnapshot?.heightCm ?? defaults.heightCm,
        width: item.productSnapshot?.widthCm ?? defaults.widthCm,
        length: item.productSnapshot?.lengthCm ?? defaults.lengthCm,
        dimensions_unit: 'CM' as const,
      })),
      // El flete de pedidos no-COD siempre se paga desde la billetera del negocio
      // ante Vendelo (EXTERNAL_PAYMENT) — ese costo se recupera del cliente sumándolo
      // al cobro de Wompi/MercadoPago en CreateOrder.execute() (ver Order.shippingTotal),
      // no acá. Este servicio no necesita saber si el flete se cobró en línea o no.
      payment_method_code: order.paymentProvider === 'COD' ? 'COD' : 'EXTERNAL_PAYMENT',
      external_order_id: order.id,
      confirmation_status: 'CONFIRMED',
      // Siempre [] por ahora — el modo híbrido no usa descuentos de Vendelo.
      discounts: [],
      // Instrucciones del cliente para el mensajero (ShippingAddress.notes)
      ...(addr.notes?.trim() && { buyer_note: addr.notes.trim() }),
    }

    this.logger.log(`Creando orden Vendelo para pedido interno ${order.id}`)
    // retryOn5xx: false — en un 5xx no sabemos si Vendelo ya creó la orden
    // (no trata external_order_id como key única). Reintentar reintenta el lado
    // del cliente, no la queue, que ya tiene su propio guard de idempotencia.
    return this.http.post<VendeloCreateOrderResponse>('/v1/admin/orders', body, { retryOn5xx: false })
  }

  /**
   * Cotiza el costo de envío sin crear el pedido — usado por QuoteShipping
   * para informar al cliente antes de pagar. A diferencia de createOrder, esta
   * llamada es idempotente (no tiene efectos secundarios en Vendelo), así que
   * mantiene el retryOn5xx por defecto del HttpClient.
   */
  async quoteOrder(input: VendeloQuoteInput): Promise<VendeloQuoteResult> {
    const pickup = storePickupLocation()
    const defaults = defaultPackage()

    const body: ApiOrderQuotationIn = {
      pickup_info: {
        city_code: pickup.cityCode,
        subdivision_code: pickup.subdivisionCode,
        country_code: 'CO',
        postal_code: '',
      },
      shipping_info: {
        city_code: input.shippingCityCode,
        subdivision_code: input.shippingSubdivisionCode,
        country_code: 'CO',
        postal_code: '',
      },
      line_items: input.items.map((item) => ({
        type: 'STANDARD' as const,
        sku: item.sku ?? item.productId,
        name: item.name ?? `Producto ${item.productId}`,
        unit_price: toPesos(item.unitPrice ?? 0),
        free_shipping: false,
        // Mismo criterio que createOrder(): peso/dimensiones reales del producto si
        // existen, si no el default genérico configurado por env var.
        weight: item.weightKg ?? defaults.weightKg,
        weight_unit: 'KG' as const,
        height: item.heightCm ?? defaults.heightCm,
        width: item.widthCm ?? defaults.widthCm,
        length: item.lengthCm ?? defaults.lengthCm,
        dimensions_unit: 'CM' as const,
        quantity: item.quantity,
      })),
      payment_method_code: input.paymentMethod,
    }

    this.logger.log(`Cotizando envío Vendelo hacia ${input.shippingCityCode}`)
    const res = await this.http.post<ApiOrderQuotationOut>('/v1/admin/orders/quotation', body)

    // Vendelo responde en pesos COP — multiplicamos x100 para devolver centavos,
    // la convención de precios de todo el dominio (ver CLAUDE.md — Price Convention).
    return {
      quotedShippingTotal: res.quoted_shipping_total * 100,
      assumedShippingTotal: res.assumed_shipping_total * 100,
    }
  }

  // ── IVendeloShippingPort ────────────────────────────────────────────────────

  async createShipments(vendeloOrderIds: string[]): Promise<{ message: string }> {
    this.logger.log(`Creando envíos Vendelo para ${vendeloOrderIds.length} órdenes`)
    return this.http.post<ApiReturnMessage>('/v1/admin/shipping/create-shipments', {
      order_ids: vendeloOrderIds,
    })
  }

  async getException(id: string): Promise<ShipmentExceptionDetail> {
    return this.http.get<ShipmentExceptionDetail>(`/v1/admin/shipping/exceptions/${encodeURIComponent(id)}`)
  }

  async resolveException(id: string, resolution: ExceptionResolution): Promise<{ message: string }> {
    this.logger.log(`Resolviendo novedad Vendelo id=${id}`)
    return this.http.post<ApiReturnMessage>(
      `/v1/admin/shipping/exceptions/${encodeURIComponent(id)}/resolve`,
      resolution,
    )
  }

  async getOrder(vendeloOrderId: string): Promise<VendeloOrderSnapshot> {
    try {
      const raw = await this.http.get<ApiOrder>(`/v1/admin/orders/${encodeURIComponent(vendeloOrderId)}`)
      return toOrderSnapshot(raw)
    } catch (e) {
      // El HttpClient lanza `Vendelo API 404: ...` cuando la orden no existe.
      // Lo convertimos a un error de dominio tipado para que el caller lo maneje.
      if (e instanceof Error && /Vendelo API 404/.test(e.message)) {
        throw new VendeloOrderNotFoundError(vendeloOrderId)
      }
      throw e
    }
  }

  /**
   * Lee varios pedidos con `GET /v1/admin/orders?filter[id][$in]=...` (filtros
   * dinámicos del spec). Solo devuelve los pedidos pedidos: si Vendelo ignorara
   * el filtro y respondiera otros, se descartan aquí.
   */
  async getOrdersBatch(vendeloOrderIds: string[]): Promise<VendeloOrderSnapshot[]> {
    const wanted = new Set(vendeloOrderIds)
    const snapshots: VendeloOrderSnapshot[] = []

    for (let i = 0; i < vendeloOrderIds.length; i += BATCH_CHUNK_SIZE) {
      const chunk = vendeloOrderIds.slice(i, i + BATCH_CHUNK_SIZE)
      let pageToken = ''
      do {
        const qs = new URLSearchParams({ page_size: '500', 'filter[id][$in]': chunk.join(',') })
        if (pageToken) qs.set('page_token', pageToken)
        const page = await this.http.get<ApiPaginated<ApiOrder>>(`/v1/admin/orders?${qs}`)
        for (const raw of page.items ?? []) {
          if (wanted.has(raw.id)) snapshots.push(toOrderSnapshot(raw))
        }
        pageToken = page.next_page_token ?? ''
      } while (pageToken)
    }

    return snapshots
  }

  /** Anula el pedido en Vendelo. Irreversible. */
  async cancelOrder(vendeloOrderId: string): Promise<{ message: string }> {
    this.logger.log(`Anulando orden Vendelo ${vendeloOrderId}`)
    return this.http.post<ApiReturnMessage>(`/v1/admin/orders/${encodeURIComponent(vendeloOrderId)}/cancel`, {})
  }

  // ── Métodos de administración sin lógica de dominio ───────────────────────

  /**
   * Genera etiquetas. Puede responder `PROCESSING` en lugar del PDF si Vendelo
   * aún está creando los envíos (create-shipments es asíncrono) — el caller
   * debe distinguir ambos casos por `status`.
   */
  async generateLabels(
    vendeloOrderIds: string[],
    format: LabelFormat,
    output: LabelOutput = 'URL',
  ): Promise<GenerateLabelsResponse> {
    this.logger.log(`Generando etiquetas (format=${format}, output=${output}) para ${vendeloOrderIds.length} órdenes`)
    return this.http.post<GenerateLabelsResponse>('/v1/admin/shipping/generate-labels', {
      output,
      format,
      order_ids: vendeloOrderIds,
    })
  }

  async getExceptions(params: GetExceptionsParams = {}): Promise<PaginatedExceptionsResponse> {
    const qs = new URLSearchParams()
    if (params.page_token)  qs.set('page_token',  params.page_token)
    if (params.page_size)   qs.set('page_size',   String(params.page_size))
    if (params.status)      qs.set('status',       params.status)
    if (params.created_min) qs.set('created_min',  params.created_min)
    if (params.created_max) qs.set('created_max',  params.created_max)
    return this.http.get<PaginatedExceptionsResponse>(`/v1/admin/shipping/exceptions?${qs}`)
  }

  async requestPickup(vendeloOrderIds: string[]): Promise<{ pickups: ApiPickup[] }> {
    this.logger.log(`Solicitando recolección para ${vendeloOrderIds.length} órdenes`)
    return this.http.post<{ pickups: ApiPickup[] }>('/v1/admin/shipping/request-pickup', {
      order_ids: vendeloOrderIds,
    })
  }

  /** Saldo de la billetera en pesos COP (la API no devuelve moneda: siempre COP). */
  async getWalletBalance(): Promise<ApiWalletBalance> {
    return this.http.get<ApiWalletBalance>('/v1/admin/wallet/get-wallet-balance')
  }
}
