import { Injectable, Logger } from '@nestjs/common'
import {
  Order,
  IVendeloShippingPort,
  ShipmentExceptionDetail,
  ExceptionResolution,
  ShipmentStatus,
  VendeloOrderNotFoundError,
  VendeloOrderSnapshot,
  VendeloQuoteInput,
  VendeloQuoteResult,
} from '@motek/domain'
import { VendeloHttpClient } from './VendeloHttpClient'

export interface VendeloAuthInfo {
  message: string
}

export interface VendelloCityItem {
  code: string
  name: string
  subdivision_code: string
  country_code: string
}

interface PaginatedResponse<T> {
  curr_page_token: string
  next_page_token: string
  page_item_count: number
  items: T[]
}

interface VendeloCreateOrderBody {
  pickup_info: {
    contact_name: string
    contact_phone: string
    address_1: string
    city_code: string
    subdivision_code: string
    country_code: string
    postal_code: string
  }
  billing_info: {
    first_name: string
    last_name: string
    email: string
    phone: string
    identification_type: string
    identification: string
  }
  shipping_info: {
    first_name: string
    last_name: string
    address_1: string
    city_code: string
    subdivision_code: string
    country_code: string
    postal_code: string
    phone: string
  }
  line_items: Array<{
    type: 'STANDARD'
    name: string
    sku: string
    quantity: number
    unit_price: number
    weight: number
    weight_unit: 'kg'
    height: number
    width: number
    length: number
    dimensions_unit: 'cm'
  }>
  payment_method_code: 'COD' | 'EXTERNAL_PAYMENT'
  external_order_id: string
  confirmation_status: 'CONFIRMED'
  // Siempre [] por ahora — ver comentario en createOrder() sobre por qué no
  // usamos este campo para el modo híbrido (schema no confirmado por Vendelo).
  discounts: []
}

export interface VendeloCreateOrderResponse {
  items: Array<{ id: string; [key: string]: unknown }>
}

interface VendeloQuotationBody {
  pickup_info: { city_code: string; subdivision_code: string; country_code: string; postal_code: string }
  shipping_info: { city_code: string; subdivision_code: string; country_code: string; postal_code: string }
  line_items: Array<{
    weight: number
    weight_unit: 'kg'
    height: number
    width: number
    length: number
    dimensions_unit: 'cm'
    quantity: number
  }>
  payment_method_code: 'COD' | 'EXTERNAL_PAYMENT'
}

interface VendeloQuotationResponse {
  assumed_shipping_total: number
  quoted_shipping_total: number
}

export type LabelFormat = 'LETTER_2PP' | 'LABEL_10x10' | 'LABEL_10x15'
export type LabelOutput = 'URL' | 'BASE64'

export interface GenerateLabelsResponse {
  status: 'SUCCESS' | string
  order_ids: string[]
  output: LabelOutput
  data: string
}

interface PaginatedExceptionsResponse {
  curr_page_token: string
  next_page_token: string
  page_item_count: number
  items: ShipmentExceptionDetail[]
}

export interface GetExceptionsParams {
  page_token?: string
  page_size?: number
  status?: string
  created_min?: string
  created_max?: string
}

@Injectable()
export class VendeloService implements IVendeloShippingPort {
  private readonly logger = new Logger(VendeloService.name)

  constructor(private readonly http: VendeloHttpClient) {}

  async checkAuth(): Promise<VendeloAuthInfo> {
    this.logger.log('Verificando autenticación con Vendelo API')
    return this.http.get<VendeloAuthInfo>('/v1/admin/check-auth')
  }

  async getCitiesPage(pageToken = '', pageSize = 500): Promise<PaginatedResponse<VendelloCityItem>> {
    const params = new URLSearchParams({ page_size: String(pageSize) })
    if (pageToken) params.set('page_token', pageToken)
    return this.http.get<PaginatedResponse<VendelloCityItem>>(`/v1/admin/region/cities?${params}`)
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

    const pickupName = process.env['VENDELO_STORE_NAME'] ?? 'Motek Store'
    const pickupPhone = process.env['VENDELO_STORE_PHONE'] ?? '3000000000'
    const pickupAddress = process.env['VENDELO_STORE_ADDRESS'] ?? 'Dirección de la tienda'
    const pickupCityCode = process.env['VENDELO_STORE_CITY_CODE'] ?? '05001000'
    const pickupSubdivision = process.env['VENDELO_STORE_SUBDIVISION_CODE'] ?? '02'

    const defaultWeightKg = parseFloat(process.env['VENDELO_DEFAULT_WEIGHT_KG'] ?? '1')
    const defaultHeight = parseInt(process.env['VENDELO_DEFAULT_HEIGHT_CM'] ?? '25', 10)
    const defaultWidth = parseInt(process.env['VENDELO_DEFAULT_WIDTH_CM'] ?? '25', 10)
    const defaultLength = parseInt(process.env['VENDELO_DEFAULT_LENGTH_CM'] ?? '10', 10)

    const body: VendeloCreateOrderBody = {
      pickup_info: {
        contact_name: pickupName,
        contact_phone: pickupPhone,
        address_1: pickupAddress,
        city_code: pickupCityCode,
        subdivision_code: pickupSubdivision,
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
        address_1: addr.address,
        city_code: addr.cityCode ?? pickupCityCode,
        subdivision_code: addr.subdivisionCode ?? pickupSubdivision,
        country_code: 'CO',
        postal_code: addr.postalCode ?? '',
        phone: addr.phone,
      },
      line_items: (order.items ?? []).map((item) => ({
        type: 'STANDARD' as const,
        name: item.productSnapshot?.name ?? `Producto ${item.productId}`,
        sku: item.productSnapshot?.sku ?? item.productId,
        quantity: item.quantity,
        // Siempre el precio real — probado en producción que Vendelo rechaza
        // (500 "invalid values") un pedido payment_method_code:'COD' con
        // unit_price:0.
        unit_price: item.priceAtPurchase / 100,
        // Peso/dimensiones reales del producto si el admin los cargó — si no,
        // caemos al default genérico (ver comentario en class doc: causa de
        // discrepancia entre el flete cotizado y el flete real cobrado por Vendelo).
        weight: item.productSnapshot?.weightKg ?? defaultWeightKg,
        weight_unit: 'kg' as const,
        height: item.productSnapshot?.heightCm ?? defaultHeight,
        width: item.productSnapshot?.widthCm ?? defaultWidth,
        length: item.productSnapshot?.lengthCm ?? defaultLength,
        dimensions_unit: 'cm' as const,
      })),
      // El flete de pedidos no-COD siempre se paga desde la billetera del negocio
      // ante Vendelo (EXTERNAL_PAYMENT) — ese costo se recupera del cliente sumándolo
      // al cobro de Wompi/MercadoPago en CreateOrder.execute() (ver Order.shippingTotal),
      // no acá. Este servicio no necesita saber si el flete se cobró en línea o no.
      payment_method_code: order.paymentProvider === 'COD' ? 'COD' : 'EXTERNAL_PAYMENT',
      external_order_id: order.id,
      confirmation_status: 'CONFIRMED',
      discounts: [],
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
    const pickupCityCode = process.env['VENDELO_STORE_CITY_CODE'] ?? '05001000'
    const pickupSubdivision = process.env['VENDELO_STORE_SUBDIVISION_CODE'] ?? '02'

    const defaultWeightKg = parseFloat(process.env['VENDELO_DEFAULT_WEIGHT_KG'] ?? '1')
    const defaultHeight = parseInt(process.env['VENDELO_DEFAULT_HEIGHT_CM'] ?? '25', 10)
    const defaultWidth = parseInt(process.env['VENDELO_DEFAULT_WIDTH_CM'] ?? '25', 10)
    const defaultLength = parseInt(process.env['VENDELO_DEFAULT_LENGTH_CM'] ?? '10', 10)

    const body: VendeloQuotationBody = {
      pickup_info: {
        city_code: pickupCityCode,
        subdivision_code: pickupSubdivision,
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
        // Mismo criterio que createOrder(): peso/dimensiones reales del producto si
        // existen, si no el default genérico configurado por env var.
        weight: item.weightKg ?? defaultWeightKg,
        weight_unit: 'kg' as const,
        height: item.heightCm ?? defaultHeight,
        width: item.widthCm ?? defaultWidth,
        length: item.lengthCm ?? defaultLength,
        dimensions_unit: 'cm' as const,
        quantity: item.quantity,
      })),
      payment_method_code: input.paymentMethod,
    }

    this.logger.log(`Cotizando envío Vendelo hacia ${input.shippingCityCode}`)
    const res = await this.http.post<VendeloQuotationResponse>('/v1/admin/orders/quotation', body)

    // Vendelo responde en pesos COP (igual que unit_price en createOrder, que se
    // divide /100 antes de enviarse) — multiplicamos x100 para devolver centavos,
    // la convención de precios de todo el dominio (ver CLAUDE.md — Price Convention).
    return {
      quotedShippingTotal: res.quoted_shipping_total * 100,
      assumedShippingTotal: res.assumed_shipping_total * 100,
    }
  }

  // ── IVendeloShippingPort ────────────────────────────────────────────────────

  async createShipments(vendeloOrderIds: string[]): Promise<{ message: string }> {
    this.logger.log(`Creando envíos Vendelo para ${vendeloOrderIds.length} órdenes`)
    return this.http.post<{ message: string }>('/v1/admin/shipping/create-shipments', {
      order_ids: vendeloOrderIds,
    })
  }

  async getException(id: string): Promise<ShipmentExceptionDetail> {
    return this.http.get<ShipmentExceptionDetail>(`/v1/admin/shipping/exceptions/${encodeURIComponent(id)}`)
  }

  async resolveException(id: string, resolution: ExceptionResolution): Promise<{ message: string }> {
    this.logger.log(`Resolviendo novedad Vendelo id=${id}`)
    return this.http.post<{ message: string }>(
      `/v1/admin/shipping/exceptions/${encodeURIComponent(id)}/resolve`,
      resolution,
    )
  }

  async getOrder(vendeloOrderId: string): Promise<VendeloOrderSnapshot> {
    try {
      const raw = await this.http.get<{
        id: string
        status: string
        shipments?: Array<{ tracking_number?: string | null; carrier?: string | null; status?: string }>
      }>(`/v1/admin/orders/${encodeURIComponent(vendeloOrderId)}`)
      const firstShipment = raw.shipments?.[0]
      return {
        id: raw.id,
        status: raw.status as ShipmentStatus,
        trackingNumber: firstShipment?.tracking_number ?? null,
        carrier: firstShipment?.carrier ?? null,
      }
    } catch (e) {
      // El HttpClient lanza `Vendelo API 404: ...` cuando la orden no existe.
      // Lo convertimos a un error de dominio tipado para que el caller lo maneje.
      if (e instanceof Error && /Vendelo API 404/.test(e.message)) {
        throw new VendeloOrderNotFoundError(vendeloOrderId)
      }
      throw e
    }
  }

  // ── Métodos de administración sin lógica de dominio ───────────────────────

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

  async requestPickup(vendeloOrderIds: string[]): Promise<{ pickups: unknown[] }> {
    this.logger.log(`Solicitando recolección para ${vendeloOrderIds.length} órdenes`)
    return this.http.post<{ pickups: unknown[] }>('/v1/admin/shipping/request-pickup', {
      order_ids: vendeloOrderIds,
    })
  }

  async getWalletBalance(): Promise<{ balance: number; currency: string }> {
    // Path oficial per API_VENDELO_DOCUMENTACION.md línea 71.
    // No es `/v1/admin/wallet/balance` (eso devuelve 404).
    return this.http.get<{ balance: number; currency: string }>('/v1/admin/wallet/get-wallet-balance')
  }
}
