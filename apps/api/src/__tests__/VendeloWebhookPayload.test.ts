import { describe, it, expect } from 'vitest'
import { describeShape, parseVendeloWebhook } from '../vendelo/webhook/vendelo-webhook-payload'

const outbound = (overrides: Record<string, unknown> = {}) => ({
  tracking_number: '98765432100',
  carrier_code: 'COORDINADORA',
  carrier_name: 'Coordinadora',
  type: 'OUTBOUND',
  tracking_status: 'TRANSIT',
  tracking_date: '2026-10-12T01:01:45.850Z',
  delivery_date: null,
  quoted_shipping_cost: 15000,
  payment_url: null,
  delivery_attempts: 0,
  ...overrides,
})

describe('parseVendeloWebhook — formas del sobre', () => {
  it('forma asumida históricamente: { event, data: { external_order_id, shipments[].carrier } }', () => {
    const parsed = parseVendeloWebhook({
      event: 'ORDER_SHIPPED',
      data: { external_order_id: 'order-1', shipments: [{ tracking_number: 'TRK', carrier: 'COORD' }] },
    })

    expect(parsed).toMatchObject({
      event: 'ORDER_SHIPPED',
      externalOrderId: 'order-1',
      targetStatus: 'SHIPPED',
      trackingNumber: 'TRK',
      carrier: 'COORD',
    })
  })

  it('pedido con forma ApiOrder del spec dentro de data', () => {
    const parsed = parseVendeloWebhook({
      event: 'ORDER_DELIVERED',
      data: {
        id: 'v-1', status: 'DELIVERED', external_order_id: 'order-1',
        shipments: [outbound({ tracking_status: 'DELIVERED', delivery_date: '2026-10-13T15:00:00Z', delivery_attempts: 1 })],
      },
    })

    expect(parsed).toMatchObject({
      vendeloOrderId: 'v-1',
      externalOrderId: 'order-1',
      targetStatus: 'DELIVERED',
      carrier: 'Coordinadora',
      trackingStatus: 'DELIVERED',
      deliveryAttempts: 1,
      deliveredAt: new Date('2026-10-13T15:00:00Z'),
      trackingUpdatedAt: new Date('2026-10-12T01:01:45.850Z'),
    })
  })

  it('pedido anidado en data.order y evento en `type`', () => {
    const parsed = parseVendeloWebhook({
      type: 'ORDER_PREPARED',
      data: { order: { id: 'v-1', external_order_id: 'order-1', status: 'PREPARING', shipments: [] } },
    })

    expect(parsed).toMatchObject({ event: 'ORDER_PREPARED', externalOrderId: 'order-1', targetStatus: 'PREPARING' })
  })

  it('pedido en la raíz del sobre', () => {
    const parsed = parseVendeloWebhook({
      event_type: 'ORDER_CANCELLED', id: 'v-1', external_order_id: 'order-1', status: 'CANCELLED',
    })

    expect(parsed).toMatchObject({ event: 'ORDER_CANCELLED', externalOrderId: 'order-1', targetStatus: 'CANCELLED' })
  })

  it('prefiere el envío OUTBOUND aunque la devolución venga primero', () => {
    const parsed = parseVendeloWebhook({
      event: 'ORDER_SHIPPED',
      data: {
        external_order_id: 'order-1',
        shipments: [outbound({ type: 'RETURN', tracking_number: 'RET' }), outbound({ tracking_number: 'OUT' })],
      },
    })

    expect(parsed.trackingNumber).toBe('OUT')
  })

  it('sin external_order_id expone el ID de Vendelo para resolver el pedido', () => {
    const parsed = parseVendeloWebhook({ event: 'ORDER_SHIPPED', data: { id: 'v-1', status: 'SHIPPED' } })

    expect(parsed.externalOrderId).toBeNull()
    expect(parsed.vendeloOrderId).toBe('v-1')
  })

  it('nunca lanza con entradas inválidas', () => {
    for (const body of [null, undefined, 'texto', 42, [], { data: 'x' }, { event: 123 }]) {
      expect(() => parseVendeloWebhook(body)).not.toThrow()
    }
    expect(parseVendeloWebhook(null)).toMatchObject({ event: null, rawEvent: null, targetStatus: null })
  })
})

describe('parseVendeloWebhook — mapeo de estados', () => {
  it.each([
    ['ORDER_PREPARED', 'PREPARING'],
    ['ORDER_READY_FOR_PICKUP', 'READY'],
    ['ORDER_SHIPPED', 'SHIPPED'],
    ['ORDER_DELIVERED', 'DELIVERED'],
    ['ORDER_CANCELLED', 'CANCELLED'],
    ['SHIPMENT_EXCEPTION_CREATED', 'INCIDENT'],
  ])('%s → %s', (event, status) => {
    expect(parseVendeloWebhook({ event, data: { external_order_id: 'o' } }).targetStatus).toBe(status)
  })

  it.each(['ORDER_CREATED', 'ORDER_CONFIRMATION_REQUESTED'])('%s no cambia el estado del envío', (event) => {
    expect(parseVendeloWebhook({ event, data: { external_order_id: 'o' } }).targetStatus).toBeNull()
  })

  it('evento desconocido: conserva el valor crudo pero event = null', () => {
    const parsed = parseVendeloWebhook({ event: 'ORDER_TELEPORTED', data: {} })
    expect(parsed).toMatchObject({ event: null, rawEvent: 'ORDER_TELEPORTED', targetStatus: null })
  })

  describe('SHIPMENT_STATUS_UPDATED', () => {
    it('usa el estado del pedido cuando viene', () => {
      const parsed = parseVendeloWebhook({
        event: 'SHIPMENT_STATUS_UPDATED',
        data: { external_order_id: 'o', status: 'RETURNED', shipments: [outbound({ tracking_status: 'RETURN' })] },
      })
      expect(parsed.targetStatus).toBe('RETURNED')
    })

    it.each([
      ['TRANSIT', 'SHIPPED'],
      ['OUT-FOR-DELIVERY', 'SHIPPED'],
      ['AT-COLLECTION-POINT', 'SHIPPED'],
      ['INCIDENT', 'INCIDENT'],
      ['DELIVERED', 'DELIVERED'],
      ['READY', 'READY'],
    ])('sin estado del pedido deriva de tracking_status %s → %s', (tracking, status) => {
      const parsed = parseVendeloWebhook({
        event: 'SHIPMENT_STATUS_UPDATED',
        data: { external_order_id: 'o', shipments: [outbound({ tracking_status: tracking })] },
      })
      expect(parsed.targetStatus).toBe(status)
      expect(parsed.trackingStatus).toBe(tracking)
    })

    it.each(['RETURN', 'PENDING', 'UNKNOWN'])(
      'tracking_status %s NO dispara transición (devolución en curso no es RETURNED)',
      (tracking) => {
        const parsed = parseVendeloWebhook({
          event: 'SHIPMENT_STATUS_UPDATED',
          data: { external_order_id: 'o', shipments: [outbound({ tracking_status: tracking })] },
        })
        expect(parsed.targetStatus).toBeNull()
        expect(parsed.trackingStatus).toBe(tracking)
      },
    )

    it('ignora un estado de pedido que no es de nuestro enum', () => {
      const parsed = parseVendeloWebhook({
        event: 'SHIPMENT_STATUS_UPDATED',
        data: { external_order_id: 'o', status: 'WHATEVER', shipments: [outbound({ tracking_status: 'TRANSIT' })] },
      })
      expect(parsed.targetStatus).toBe('SHIPPED')
    })
  })
})

describe('describeShape', () => {
  it('describe claves y tipos sin exponer valores', () => {
    const shape = describeShape({
      event: 'ORDER_SHIPPED',
      metadata: [{ key: 'motek_webhook_secret', value: 'super-secreto' }],
      data: { billing_info: { email: 'cliente@correo.com', phone: '3001234567' }, total: 49000, shipments: [] },
    })

    const joined = shape.join(' ')
    expect(shape).toEqual(expect.arrayContaining([
      'event:string',
      'metadata[]:object',
      'metadata[].key:string',
      'data.billing_info.email:string',
      'data.total:number',
      'data.shipments[]:empty',
    ]))
    expect(joined).not.toContain('super-secreto')
    expect(joined).not.toContain('cliente@correo.com')
    expect(joined).not.toContain('3001234567')
    expect(joined).not.toContain('ORDER_SHIPPED')
  })
})
