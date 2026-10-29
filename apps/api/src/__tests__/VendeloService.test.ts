import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VendeloService } from '../infrastructure/services/VendeloService'
import type { VendeloHttpClient } from '../infrastructure/services/VendeloHttpClient'
import { VendeloOrderNotFoundError, type VendeloQuoteInput, type Order } from '@motek/domain'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_INPUT: VendeloQuoteInput = {
  shippingCityCode: '11001000',
  shippingSubdivisionCode: '11',
  items: [{ productId: 'prod-1', quantity: 2 }],
  paymentMethod: 'EXTERNAL_PAYMENT',
}

function makeHttpClientMock(response: unknown) {
  return { post: vi.fn().mockResolvedValue(response) } as unknown as VendeloHttpClient
}

function makeOrder(overrides?: Partial<Order>): Order {
  return {
    id: 'order-1',
    userId: 'user-1',
    guestId: null,
    contactEmail: 'cliente@motek.test',
    trackingToken: 'tok-test-order-1',
    status: 'PENDING',
    total: 5000000,
    shippingAddress: {
      fullName: 'Carlos Pérez',
      address: 'Calle 123 #45-67',
      city: 'Bogotá',
      phone: '3001234567',
      cityCode: '11001000',
      subdivisionCode: '11',
    },
    buyer: { idType: 'CC', idNumber: '1000123456' },
    paymentProvider: 'WOMPI',
    deliveryMethod: 'HOME_DELIVERY',
    shippingTotal: 0,
    createdAt: new Date('2025-01-01'),
    items: [{
      id: 'item-1', orderId: 'order-1', productId: 'prod-1', quantity: 2, priceAtPurchase: 2500000,
      productSnapshot: { sku: 'SKU-1', name: 'Bujía NGK' },
    }],
    ...overrides,
  }
}

describe('VendeloService — quoteOrder', () => {
  beforeEach(() => {
    process.env['VENDELO_STORE_CITY_CODE'] = '05001000'
    process.env['VENDELO_STORE_SUBDIVISION_CODE'] = '02'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env['VENDELO_STORE_CITY_CODE']
    delete process.env['VENDELO_STORE_SUBDIVISION_CODE']
  })

  it('convierte la respuesta de Vendelo (pesos) a centavos COP', async () => {
    const http = makeHttpClientMock({ assumed_shipping_total: 0, quoted_shipping_total: 9000 })
    const service = new VendeloService(http)

    const result = await service.quoteOrder(BASE_INPUT)

    expect(result).toEqual({ quotedShippingTotal: 900000, assumedShippingTotal: 0 })
  })

  it('llama al endpoint de cotización con pickup_info, shipping_info y line_items correctos', async () => {
    const http = makeHttpClientMock({ assumed_shipping_total: 0, quoted_shipping_total: 9000 })
    const service = new VendeloService(http)

    await service.quoteOrder(BASE_INPUT)

    expect(http.post).toHaveBeenCalledWith(
      '/v1/admin/orders/quotation',
      expect.objectContaining({
        pickup_info: expect.objectContaining({ city_code: '05001000', subdivision_code: '02' }),
        shipping_info: expect.objectContaining({ city_code: '11001000', subdivision_code: '11' }),
        line_items: [expect.objectContaining({ quantity: 2, weight_unit: 'KG', dimensions_unit: 'CM' })],
        payment_method_code: 'EXTERNAL_PAYMENT',
      }),
    )
  })

  it('no pasa retryOn5xx:false — la cotización es idempotente y mantiene el retry por defecto', async () => {
    const http = makeHttpClientMock({ assumed_shipping_total: 0, quoted_shipping_total: 9000 })
    const service = new VendeloService(http)

    await service.quoteOrder(BASE_INPUT)

    expect(http.post).toHaveBeenCalledWith('/v1/admin/orders/quotation', expect.anything())
    expect((http.post as ReturnType<typeof vi.fn>).mock.calls[0]).toHaveLength(2)
  })

  it('propaga el error si Vendelo falla (lo maneja el use case, no el service)', async () => {
    const http = { post: vi.fn().mockRejectedValue(new Error('Vendelo API 503: timeout')) } as unknown as VendeloHttpClient
    const service = new VendeloService(http)

    await expect(service.quoteOrder(BASE_INPUT)).rejects.toThrow('Vendelo API 503')
  })

  it('usa el peso/dimensiones default (1kg, 25x25x10cm) cuando no hay env vars ni datos reales del ítem', async () => {
    delete process.env['VENDELO_DEFAULT_WEIGHT_KG']
    delete process.env['VENDELO_DEFAULT_HEIGHT_CM']
    delete process.env['VENDELO_DEFAULT_WIDTH_CM']
    delete process.env['VENDELO_DEFAULT_LENGTH_CM']
    const http = makeHttpClientMock({ assumed_shipping_total: 0, quoted_shipping_total: 9000 })
    const service = new VendeloService(http)

    await service.quoteOrder(BASE_INPUT)

    expect(http.post).toHaveBeenCalledWith(
      '/v1/admin/orders/quotation',
      expect.objectContaining({
        line_items: [expect.objectContaining({ weight: 1, height: 25, width: 25, length: 10 })],
      }),
    )
  })

  it('respeta el default configurado por env var cuando está seteado', async () => {
    process.env['VENDELO_DEFAULT_WEIGHT_KG'] = '2'
    process.env['VENDELO_DEFAULT_HEIGHT_CM'] = '30'
    process.env['VENDELO_DEFAULT_WIDTH_CM'] = '30'
    process.env['VENDELO_DEFAULT_LENGTH_CM'] = '15'
    const http = makeHttpClientMock({ assumed_shipping_total: 0, quoted_shipping_total: 9000 })
    const service = new VendeloService(http)

    await service.quoteOrder(BASE_INPUT)

    expect(http.post).toHaveBeenCalledWith(
      '/v1/admin/orders/quotation',
      expect.objectContaining({
        line_items: [expect.objectContaining({ weight: 2, height: 30, width: 30, length: 15 })],
      }),
    )
    delete process.env['VENDELO_DEFAULT_WEIGHT_KG']
    delete process.env['VENDELO_DEFAULT_HEIGHT_CM']
    delete process.env['VENDELO_DEFAULT_WIDTH_CM']
    delete process.env['VENDELO_DEFAULT_LENGTH_CM']
  })

  it('usa el peso/dimensiones reales del producto cuando el ítem los trae, ignorando el default', async () => {
    const http = makeHttpClientMock({ assumed_shipping_total: 0, quoted_shipping_total: 9000 })
    const service = new VendeloService(http)

    const input: VendeloQuoteInput = {
      ...BASE_INPUT,
      items: [{ productId: 'prod-1', quantity: 2, weightKg: 3.2, heightCm: 20, widthCm: 15, lengthCm: 30 }],
    }
    await service.quoteOrder(input)

    expect(http.post).toHaveBeenCalledWith(
      '/v1/admin/orders/quotation',
      expect.objectContaining({
        line_items: [expect.objectContaining({ weight: 3.2, height: 20, width: 15, length: 30 })],
      }),
    )
  })
})

describe('VendeloService — createOrder', () => {
  beforeEach(() => {
    process.env['VENDELO_STORE_CITY_CODE'] = '05001000'
    process.env['VENDELO_STORE_SUBDIVISION_CODE'] = '02'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env['VENDELO_STORE_CITY_CODE']
    delete process.env['VENDELO_STORE_SUBDIVISION_CODE']
  })

  it('pago 100% online (WOMPI): EXTERNAL_PAYMENT con el precio real del producto', async () => {
    const http = makeHttpClientMock({ items: [{ id: 'vendelo-1' }] })
    const service = new VendeloService(http)

    await service.createOrder(makeOrder({ paymentProvider: 'WOMPI' }), 'cliente@test.com')

    expect(http.post).toHaveBeenCalledWith(
      '/v1/admin/orders',
      expect.objectContaining({
        payment_method_code: 'EXTERNAL_PAYMENT',
        line_items: [expect.objectContaining({ unit_price: 25000 })], // 2500000 centavos / 100
      }),
      expect.anything(),
    )
  })

  it('COD total: payment_method_code COD con el precio real del producto (recauda todo)', async () => {
    const http = makeHttpClientMock({ items: [{ id: 'vendelo-1' }] })
    const service = new VendeloService(http)

    await service.createOrder(makeOrder({ paymentProvider: 'COD' }), 'cliente@test.com')

    expect(http.post).toHaveBeenCalledWith(
      '/v1/admin/orders',
      expect.objectContaining({
        payment_method_code: 'COD',
        line_items: [expect.objectContaining({ unit_price: 25000 })],
      }),
      expect.anything(),
    )
  })

  it('payment_method_code no depende de shippingTotal — el flete cobrado en línea no cambia cómo se le habla a Vendelo', async () => {
    const http = makeHttpClientMock({ items: [{ id: 'vendelo-1' }] })
    const service = new VendeloService(http)

    await service.createOrder(makeOrder({ paymentProvider: 'WOMPI', shippingTotal: 0 }), 'cliente@test.com')
    await service.createOrder(makeOrder({ paymentProvider: 'WOMPI', shippingTotal: 9000, total: 259000 }), 'cliente@test.com')

    for (const call of (http.post as ReturnType<typeof vi.fn>).mock.calls) {
      expect((call[1] as { payment_method_code: string }).payment_method_code).toBe('EXTERNAL_PAYMENT')
    }
  })

  it('discounts siempre vacío, sin importar el modo', async () => {
    const http = makeHttpClientMock({ items: [{ id: 'vendelo-1' }] })
    const service = new VendeloService(http)

    await service.createOrder(makeOrder({ paymentProvider: 'COD' }), 'cliente@test.com')
    await service.createOrder(makeOrder({ paymentProvider: 'WOMPI' }), 'cliente@test.com')

    for (const call of (http.post as ReturnType<typeof vi.fn>).mock.calls) {
      expect((call[1] as { discounts: unknown[] }).discounts).toEqual([])
    }
  })
})

// ── Conformidad con el spec OpenAPI de Venndelo ───────────────────────────────

function sentBody<T>(http: VendeloHttpClient, call = 0): T {
  return (http.post as ReturnType<typeof vi.fn>).mock.calls[call][1] as T
}

describe('VendeloService — conformidad con el spec', () => {
  beforeEach(() => {
    process.env['VENDELO_STORE_CITY_CODE'] = '68001000'
    process.env['VENDELO_STORE_SUBDIVISION_CODE'] = '68'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env['VENDELO_STORE_CITY_CODE']
    delete process.env['VENDELO_STORE_SUBDIVISION_CODE']
  })

  it('createOrder: unidades en mayúsculas (enums KG/CM del spec)', async () => {
    const http = makeHttpClientMock({ items: [{ id: 'vendelo-1' }] })
    await new VendeloService(http).createOrder(makeOrder(), 'cliente@test.com')

    const body = sentBody<{ line_items: Array<{ weight_unit: string; dimensions_unit: string }> }>(http)
    expect(body.line_items[0]).toMatchObject({ weight_unit: 'KG', dimensions_unit: 'CM' })
  })

  it('createOrder y quoteOrder envían ítems VIRTUAL sin variation_id (STANDARD exige un producto creado en Venndelo → 422)', async () => {
    const http = makeHttpClientMock({ items: [{ id: 'vendelo-1' }] })
    const service = new VendeloService(http)
    await service.createOrder(makeOrder(), 'cliente@test.com')
    await service.quoteOrder(BASE_INPUT)

    for (const call of (http.post as ReturnType<typeof vi.fn>).mock.calls) {
      const items = (call[1] as { line_items: Array<Record<string, unknown>> }).line_items
      for (const item of items) {
        expect(item['type']).toBe('VIRTUAL')
        expect(item).not.toHaveProperty('variation_id')
      }
    }
  })

  it('createOrder: shipping_info incluye email, city_name y subdivision_name (requeridos por el spec)', async () => {
    const http = makeHttpClientMock({ items: [{ id: 'vendelo-1' }] })
    await new VendeloService(http).createOrder(makeOrder(), 'cliente@test.com')

    expect(sentBody<{ shipping_info: unknown }>(http).shipping_info).toMatchObject({
      email: 'cliente@test.com',
      city_name: 'Bogotá',
      city_code: '11001000',
      subdivision_code: '11',
      // Sin `department` en la dirección → se deriva del código DIVIPOLA
      subdivision_name: 'Bogotá D.C.',
    })
  })

  it('createOrder: usa el departamento que escribió el cliente si viene en la dirección', async () => {
    const http = makeHttpClientMock({ items: [{ id: 'vendelo-1' }] })
    const order = makeOrder()
    order.shippingAddress = { ...order.shippingAddress, department: 'Cundinamarca' }

    await new VendeloService(http).createOrder(order, 'cliente@test.com')

    expect(sentBody<{ shipping_info: { subdivision_name: string } }>(http).shipping_info.subdivision_name)
      .toBe('Cundinamarca')
  })

  it('createOrder: las notas de entrega viajan como buyer_note y se omiten si están vacías', async () => {
    const http = makeHttpClientMock({ items: [{ id: 'vendelo-1' }] })
    const service = new VendeloService(http)
    const withNotes = makeOrder()
    withNotes.shippingAddress = { ...withNotes.shippingAddress, notes: '  Dejar en portería  ' }

    await service.createOrder(withNotes, 'cliente@test.com')
    await service.createOrder(makeOrder(), 'cliente@test.com')

    expect(sentBody<{ buyer_note?: string }>(http, 0).buyer_note).toBe('Dejar en portería')
    expect(sentBody<object>(http, 1)).not.toHaveProperty('buyer_note')
  })

  it('quoteOrder: line_items incluye sku, name, unit_price (pesos) y free_shipping requeridos por el spec', async () => {
    const http = makeHttpClientMock({ assumed_shipping_total: 0, quoted_shipping_total: 9000 })
    await new VendeloService(http).quoteOrder({
      ...BASE_INPUT,
      items: [{ productId: 'prod-1', quantity: 2, sku: 'BAT-12V', name: 'Batería 12V', unitPrice: 5000000 }],
    })

    expect(sentBody<{ line_items: unknown[] }>(http).line_items[0]).toMatchObject({
      type: 'VIRTUAL',
      sku: 'BAT-12V',
      name: 'Batería 12V',
      unit_price: 50000,
      free_shipping: false,
      quantity: 2,
    })
  })

  it('quoteOrder: sin datos del producto cae a valores seguros en vez de omitir campos requeridos', async () => {
    const http = makeHttpClientMock({ assumed_shipping_total: 0, quoted_shipping_total: 9000 })
    await new VendeloService(http).quoteOrder(BASE_INPUT)

    expect(sentBody<{ line_items: unknown[] }>(http).line_items[0]).toMatchObject({
      sku: 'prod-1',
      name: 'Producto prod-1',
      unit_price: 0,
    })
  })
})

describe('VendeloService — getOrder', () => {
  afterEach(() => { vi.restoreAllMocks() })

  function makeGetMock(response: unknown) {
    return { get: vi.fn().mockResolvedValue(response) } as unknown as VendeloHttpClient
  }

  const shipment = (overrides: Record<string, unknown>) => ({
    tracking_number: '98765432100',
    carrier_code: 'COORDINADORA',
    carrier_name: 'Coordinadora',
    type: 'OUTBOUND',
    tracking_status: 'TRANSIT',
    tracking_date: null,
    delivery_date: null,
    quoted_shipping_cost: 15000,
    payment_url: null,
    delivery_attempts: 0,
    ...overrides,
  })

  it('lee carrier_name del envío (el spec no tiene campo `carrier`)', async () => {
    const http = makeGetMock({ id: 'v-1', status: 'SHIPPED', shipments: [shipment({})] })

    await expect(new VendeloService(http).getOrder('v-1')).resolves.toMatchObject({
      id: 'v-1',
      status: 'SHIPPED',
      trackingNumber: '98765432100',
      carrier: 'Coordinadora',
      trackingStatus: 'TRANSIT',
      deliveryAttempts: 0,
    })
  })

  it('prefiere el envío OUTBOUND aunque el de devolución venga primero', async () => {
    const http = makeGetMock({
      id: 'v-1',
      status: 'RETURNED',
      shipments: [
        shipment({ type: 'RETURN', tracking_number: 'RET-1' }),
        shipment({ type: 'OUTBOUND', tracking_number: 'OUT-1' }),
      ],
    })

    const snapshot = await new VendeloService(http).getOrder('v-1')
    expect(snapshot.trackingNumber).toBe('OUT-1')
  })

  it('sin envíos aún devuelve tracking y carrier null', async () => {
    const http = makeGetMock({ id: 'v-1', status: 'PENDING', shipments: [] })

    await expect(new VendeloService(http).getOrder('v-1')).resolves.toMatchObject({
      trackingNumber: null,
      carrier: null,
    })
  })

  it('un 404 de Vendelo se convierte en VendeloOrderNotFoundError', async () => {
    const http = { get: vi.fn().mockRejectedValue(new Error('Vendelo API 404: not found')) } as unknown as VendeloHttpClient

    await expect(new VendeloService(http).getOrder('v-x')).rejects.toBeInstanceOf(VendeloOrderNotFoundError)
  })
})

describe('VendeloService — getOrdersBatch y cancelOrder', () => {
  afterEach(() => { vi.restoreAllMocks() })

  const apiOrder = (id: string, extra: Record<string, unknown> = {}) => ({
    id, status: 'SHIPPED', external_order_id: `ext-${id}`, shipments: [], ...extra,
  })

  it('usa filter[id][$in] y devuelve solo los pedidos pedidos', async () => {
    const get = vi.fn().mockResolvedValue({
      curr_page_token: '', next_page_token: '', page_item_count: 3,
      // `x` no fue pedido: si Vendelo ignorara el filtro, se descarta
      items: [apiOrder('a'), apiOrder('b'), apiOrder('x')],
    })
    const http = { get } as unknown as VendeloHttpClient

    const result = await new VendeloService(http).getOrdersBatch(['a', 'b'])

    expect(result.map((r) => r.id)).toEqual(['a', 'b'])
    expect(result[0]?.externalOrderId).toBe('ext-a')
    const url = new URL(`https://x${get.mock.calls[0][0] as string}`)
    expect(url.pathname).toBe('/v1/admin/orders')
    expect(url.searchParams.get('filter[id][$in]')).toBe('a,b')
  })

  it('divide en bloques de 50 IDs y sigue la paginación', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `id-${i}`)
    const get = vi.fn()
      .mockResolvedValueOnce({ next_page_token: 'p2', items: ids.slice(0, 25).map((id) => apiOrder(id)) })
      .mockResolvedValueOnce({ next_page_token: '', items: ids.slice(25, 50).map((id) => apiOrder(id)) })
      .mockResolvedValueOnce({ next_page_token: '', items: ids.slice(50).map((id) => apiOrder(id)) })
    const http = { get } as unknown as VendeloHttpClient

    const result = await new VendeloService(http).getOrdersBatch(ids)

    expect(result).toHaveLength(60)
    expect(get).toHaveBeenCalledTimes(3)
    expect(new URL(`https://x${get.mock.calls[1][0] as string}`).searchParams.get('page_token')).toBe('p2')
  })

  it('cancelOrder llama a POST /v1/admin/orders/{id}/cancel', async () => {
    const http = makeHttpClientMock({ message: 'ok' })

    await new VendeloService(http).cancelOrder('v-1')

    expect(http.post).toHaveBeenCalledWith('/v1/admin/orders/v-1/cancel', {})
  })
})
