import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { IOrderRepository, IShipmentRepository, Shipment, ShipmentStatus } from '@motek/domain'
import { VendeloWebhookController } from '../vendelo/vendelo-webhook.controller'

function makeShipment(status: ShipmentStatus, overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 'shipment-1', orderId: 'order-1', status,
    trackingNumber: null, carrier: null, labelUrl: null,
    trackingStatus: null, deliveryAttempts: null, deliveredAt: null, trackingUpdatedAt: null,
    createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

function makeRepos(opts: { shipment?: Shipment | null; userId?: string | null; idByVendelo?: string | null } = {}) {
  const orderRepo = {
    findById: vi.fn().mockResolvedValue({ id: 'order-1', userId: opts.userId === undefined ? 'user-1' : opts.userId, status: 'PAID' }),
    findIdByVendeloOrderId: vi.fn().mockResolvedValue(opts.idByVendelo ?? null),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    restockItems: vi.fn().mockResolvedValue(undefined),
  } as unknown as IOrderRepository
  const shipmentRepo = {
    findByOrderId: vi.fn().mockResolvedValue(opts.shipment ?? null),
    upsert: vi.fn().mockResolvedValue(undefined),
    atomicUpdateStatus: vi.fn().mockResolvedValue({ applied: true }),
    updateTrackingDetails: vi.fn().mockResolvedValue(undefined),
  } as unknown as IShipmentRepository
  return { orderRepo, shipmentRepo, controller: new VendeloWebhookController(orderRepo, shipmentRepo) }
}

describe('VendeloWebhookController', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('ORDER_SHIPPED: aplica la transición con guía y transportadora del spec', async () => {
    const { shipmentRepo, orderRepo, controller } = makeRepos({ shipment: makeShipment('READY') })

    const res = await controller.webhook({
      event: 'ORDER_SHIPPED',
      data: {
        external_order_id: 'order-1',
        shipments: [{ type: 'OUTBOUND', tracking_number: 'TRK-1', carrier_name: 'Coordinadora', tracking_status: 'TRANSIT' }],
      },
    })

    expect(res).toMatchObject({ processed: true, updated: true })
    expect(shipmentRepo.atomicUpdateStatus).toHaveBeenCalledWith(
      'order-1', 'READY', 'SHIPPED', { trackingNumber: 'TRK-1', carrier: 'Coordinadora' },
    )
    expect(shipmentRepo.updateTrackingDetails).toHaveBeenCalledWith('order-1', { trackingStatus: 'TRANSIT' })
    expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-1', 'SHIPPED')
    // Invalida la caché del historial del usuario dueño
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/internal/revalidate'),
      expect.objectContaining({ body: JSON.stringify({ tags: ['orders:user-1'] }) }),
    )
  })

  it('sin external_order_id resuelve el pedido por el ID de Vendelo', async () => {
    const { orderRepo, shipmentRepo, controller } = makeRepos({ shipment: makeShipment('READY'), idByVendelo: 'order-1' })

    const res = await controller.webhook({ event: 'ORDER_SHIPPED', data: { id: 'v-1', status: 'SHIPPED' } })

    expect(orderRepo.findIdByVendeloOrderId).toHaveBeenCalledWith('v-1')
    expect(shipmentRepo.atomicUpdateStatus).toHaveBeenCalledWith('order-1', 'READY', 'SHIPPED', expect.anything())
    expect(res).toMatchObject({ processed: true })
  })

  it('pedido no resoluble → 200 con reason missing_order_id, sin tocar la BD', async () => {
    const { shipmentRepo, controller } = makeRepos({ idByVendelo: null })

    const res = await controller.webhook({ event: 'ORDER_SHIPPED', data: { id: 'v-desconocido' } })

    expect(res).toMatchObject({ received: true, processed: false, reason: 'missing_order_id' })
    expect(shipmentRepo.atomicUpdateStatus).not.toHaveBeenCalled()
  })

  it('SHIPMENT_STATUS_UPDATED con devolución en curso: solo registra el detalle, sin cambiar estado', async () => {
    const { orderRepo, shipmentRepo, controller } = makeRepos({ shipment: makeShipment('INCIDENT', { deliveryAttempts: 1 }) })

    const res = await controller.webhook({
      event: 'SHIPMENT_STATUS_UPDATED',
      data: {
        external_order_id: 'order-1',
        shipments: [{ type: 'OUTBOUND', tracking_status: 'RETURN', delivery_attempts: 2 }],
      },
    })

    expect(res).toMatchObject({ processed: true, updated: false, detailsUpdated: true })
    expect(shipmentRepo.updateTrackingDetails).toHaveBeenCalledWith('order-1', { trackingStatus: 'RETURN', deliveryAttempts: 2 })
    expect(orderRepo.updateStatus).not.toHaveBeenCalled()
    expect(orderRepo.restockItems).not.toHaveBeenCalled()
  })

  it('evento sin impacto (ORDER_CREATED) se reconoce pero no procesa', async () => {
    const { shipmentRepo, controller } = makeRepos()

    const res = await controller.webhook({ event: 'ORDER_CREATED', data: { external_order_id: 'order-1' } })

    expect(res).toMatchObject({ processed: false, reason: 'event_not_tracked' })
    expect(shipmentRepo.findByOrderId).not.toHaveBeenCalled()
  })

  it('payload sin evento → missing_event; evento desconocido → unknown_event', async () => {
    const { controller } = makeRepos()

    await expect(controller.webhook({ data: {} })).resolves.toMatchObject({ reason: 'missing_event' })
    await expect(controller.webhook({ event: 'ALGO_NUEVO' })).resolves.toMatchObject({ reason: 'unknown_event' })
  })

  it('pedido de invitado (userId null): no intenta invalidar caché por usuario', async () => {
    const { controller } = makeRepos({ shipment: makeShipment('READY'), userId: null })

    await controller.webhook({ event: 'ORDER_SHIPPED', data: { external_order_id: 'order-1' } })

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
