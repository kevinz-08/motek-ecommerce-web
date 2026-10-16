import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ActiveVendeloOrder,
  IOrderRepository,
  IShipmentRepository,
  IVendeloShippingPort,
  VendeloOrderNotFoundError,
  VendeloOrderSnapshot,
  ShipmentStatus,
} from '@motek/domain'
import { VendeloShipmentPollerCron } from '../vendelo/services/VendeloShipmentPollerCron'
import { VendeloHttpClient } from '../infrastructure/services/VendeloHttpClient'

// ── Mocks compartidos ─────────────────────────────────────────────────────────

function makeOrderRepoMock(active: ActiveVendeloOrder[] = []): IOrderRepository {
  return {
    findActiveVendeloOrders: vi.fn().mockResolvedValue(active),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    updatePaymentExternalId: vi.fn(),
    transitionFromPending: vi.fn(),
    getTodayRevenue: vi.fn(),
    getPendingCount: vi.fn(),
    findVendeloOrderIdsBatch: vi.fn(),
  } as unknown as IOrderRepository
}

function makeShipmentRepoMock(): IShipmentRepository {
  return {
    findByOrderId: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
    atomicUpdateStatus: vi.fn().mockResolvedValue({ applied: true }),
    updateTrackingDetails: vi.fn().mockResolvedValue(undefined),
  } as unknown as IShipmentRepository
}

function makePortMock(snapshot: Partial<VendeloOrderSnapshot> = {}): IVendeloShippingPort {
  return {
    getOrder: vi.fn().mockResolvedValue({
      id: snapshot.id ?? 'vendelo-1',
      status: snapshot.status ?? ('SHIPPED' as ShipmentStatus),
      trackingNumber: snapshot.trackingNumber ?? '1Z999',
      carrier: snapshot.carrier ?? 'COORDINADORA',
    }),
    // Lote vacío por defecto: todos los pedidos caen al fallback uno a uno
    getOrdersBatch: vi.fn().mockResolvedValue([]),
    createShipments: vi.fn(),
    getException: vi.fn(),
    resolveException: vi.fn(),
  } as unknown as IVendeloShippingPort
}

function makeHttpClientMock(state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'): VendeloHttpClient {
  return { getCircuitState: () => state } as unknown as VendeloHttpClient
}

/** Builder con valores razonables, sobrescribible por test. */
function buildOrder(overrides: Partial<ActiveVendeloOrder> = {}): ActiveVendeloOrder {
  return {
    orderId: 'order-1',
    vendeloOrderId: 'vendelo-1',
    currentShipmentStatus: 'PENDING',
    ...overrides,
  }
}

/** Builder del cron evitando boilerplate de provider tokens. */
function makeCron(opts: {
  orderRepo?: IOrderRepository
  shipmentRepo?: IShipmentRepository
  port?: IVendeloShippingPort
  http?: VendeloHttpClient
  env?: Record<string, string>
} = {}): VendeloShipmentPollerCron {
  Object.assign(process.env, opts.env ?? {})
  const cron = new VendeloShipmentPollerCron(
    opts.orderRepo  ?? makeOrderRepoMock(),
    opts.shipmentRepo ?? makeShipmentRepoMock(),
    opts.port       ?? makePortMock(),
    opts.http       ?? makeHttpClientMock(),
  )
  // Suprimir el delay real entre requests para que los tests corran rápido
  vi.spyOn(cron as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
    .mockResolvedValue(undefined)
  return cron
}

beforeEach(() => {
  // Defaults estables — específicos por test los sobrescriben
  process.env['VENDELO_POLL_INTERVAL_MS']     = '5000'
  process.env['VENDELO_POLL_BATCH_SIZE']      = '50'
  process.env['VENDELO_POLL_REQUEST_DELAY_MS'] = '0'
  process.env['VENDELO_POLL_ENABLED']         = 'true'
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Casos base ────────────────────────────────────────────────────────────────

describe('VendeloShipmentPollerCron — casos base', () => {
  it('sin pedidos activos, no llama a Vendelo y reporta 0', async () => {
    const port = makePortMock()
    const cron = makeCron({ orderRepo: makeOrderRepoMock([]), port })

    const result = await cron.tick()

    expect(result.batchSize).toBe(0)
    expect(result.transitionsApplied).toBe(0)
    expect(result.errors).toBe(0)
    expect(port.getOrder).not.toHaveBeenCalled()
  })

  it('con 3 pedidos activos, llama getOrder 3 veces', async () => {
    const orders = [
      buildOrder({ orderId: 'o1', vendeloOrderId: 'v1' }),
      buildOrder({ orderId: 'o2', vendeloOrderId: 'v2' }),
      buildOrder({ orderId: 'o3', vendeloOrderId: 'v3' }),
    ]
    const port = makePortMock({ status: 'SHIPPED' as ShipmentStatus })
    const cron = makeCron({ orderRepo: makeOrderRepoMock(orders), port })

    const result = await cron.tick()

    expect(port.getOrder).toHaveBeenCalledTimes(3)
    expect(port.getOrder).toHaveBeenCalledWith('v1')
    expect(port.getOrder).toHaveBeenCalledWith('v2')
    expect(port.getOrder).toHaveBeenCalledWith('v3')
    expect(result.batchSize).toBe(3)
  })

  it('aplica transición cuando Vendelo reporta status más avanzado', async () => {
    const shipmentRepo = makeShipmentRepoMock()
    // SyncShipmentStatus partirá de currentStatus='PENDING' (existing es null)
    // y aceptará el SHIPPED entrante como progresivo
    vi.spyOn(shipmentRepo, 'findByOrderId').mockResolvedValue(null)

    const cron = makeCron({
      orderRepo: makeOrderRepoMock([buildOrder()]),
      shipmentRepo,
      port: makePortMock({ status: 'SHIPPED' as ShipmentStatus }),
    })
    // findById necesario para SyncShipmentStatus
    vi.spyOn(cron['orderRepo'], 'findById').mockResolvedValue({
      id: 'order-1', userId: 'user-1', status: 'PAID',
    } as never)

    const result = await cron.tick()

    expect(result.transitionsApplied).toBe(1)
    expect(result.transitionsSkipped).toBe(0)
    expect(shipmentRepo.upsert).toHaveBeenCalledOnce()
  })

  it('reporta como skipped cuando el status entrante no es progresivo', async () => {
    const shipmentRepo = makeShipmentRepoMock()
    // Shipment ya está en DELIVERED; PENDING entrante no progresa
    vi.spyOn(shipmentRepo, 'findByOrderId').mockResolvedValue({
      status: 'DELIVERED' as ShipmentStatus,
    } as never)

    const cron = makeCron({
      orderRepo: makeOrderRepoMock([buildOrder()]),
      shipmentRepo,
      port: makePortMock({ status: 'PENDING' as ShipmentStatus }),
    })
    vi.spyOn(cron['orderRepo'], 'findById').mockResolvedValue({
      id: 'order-1', userId: 'user-1', status: 'DELIVERED',
    } as never)

    const result = await cron.tick()

    expect(result.transitionsApplied).toBe(0)
    expect(result.transitionsSkipped).toBe(1)
    expect(shipmentRepo.upsert).not.toHaveBeenCalled()
    expect(shipmentRepo.atomicUpdateStatus).not.toHaveBeenCalled()
  })
})

// ── Resiliencia ───────────────────────────────────────────────────────────────

describe('VendeloShipmentPollerCron — resiliencia', () => {
  it('si circuit breaker OPEN, no consulta BD ni Vendelo', async () => {
    const orderRepo = makeOrderRepoMock([buildOrder()])
    const port = makePortMock()
    const cron = makeCron({ orderRepo, port, http: makeHttpClientMock('OPEN') })

    const result = await cron.tick()

    expect(result.circuitState).toBe('OPEN')
    expect(result.batchSize).toBe(0)
    expect(orderRepo.findActiveVendeloOrders).not.toHaveBeenCalled()
    expect(port.getOrder).not.toHaveBeenCalled()
  })

  it('Vendelo retorna 404 para un pedido — loguea como error pero sigue con los demás', async () => {
    const orders = [
      buildOrder({ orderId: 'o1', vendeloOrderId: 'v1' }),
      buildOrder({ orderId: 'o2', vendeloOrderId: 'v2' }),
    ]
    const port = makePortMock()
    vi.spyOn(port, 'getOrder')
      .mockRejectedValueOnce(new VendeloOrderNotFoundError('v1'))
      .mockResolvedValueOnce({
        id: 'v2', status: 'SHIPPED' as ShipmentStatus,
        trackingNumber: null, carrier: null,
      })

    const cron = makeCron({ orderRepo: makeOrderRepoMock(orders), port })
    vi.spyOn(cron['orderRepo'], 'findById').mockResolvedValue({
      id: 'o2', userId: 'u', status: 'PAID',
    } as never)

    const result = await cron.tick()

    expect(port.getOrder).toHaveBeenCalledTimes(2)
    expect(result.errors).toBe(1)
    expect(result.transitionsApplied + result.transitionsSkipped).toBe(1)
  })

  it('si Vendelo lanza error genérico en una orden, sigue procesando las demás', async () => {
    const orders = [
      buildOrder({ orderId: 'o1', vendeloOrderId: 'v1' }),
      buildOrder({ orderId: 'o2', vendeloOrderId: 'v2' }),
      buildOrder({ orderId: 'o3', vendeloOrderId: 'v3' }),
    ]
    const port = makePortMock()
    vi.spyOn(port, 'getOrder')
      .mockResolvedValueOnce({
        id: 'v1', status: 'SHIPPED' as ShipmentStatus,
        trackingNumber: null, carrier: null,
      })
      .mockRejectedValueOnce(new Error('Vendelo API 500: Internal'))
      .mockResolvedValueOnce({
        id: 'v3', status: 'DELIVERED' as ShipmentStatus,
        trackingNumber: '1Z999', carrier: 'COORDINADORA',
      })

    const cron = makeCron({ orderRepo: makeOrderRepoMock(orders), port })
    vi.spyOn(cron['orderRepo'], 'findById').mockResolvedValue({
      id: 'oN', userId: 'u', status: 'PAID',
    } as never)

    const result = await cron.tick()

    expect(port.getOrder).toHaveBeenCalledTimes(3)
    expect(result.errors).toBe(1)
  })

  it('si findActiveVendeloOrders falla, retorna result con error y no llama Vendelo', async () => {
    const orderRepo = makeOrderRepoMock()
    vi.spyOn(orderRepo, 'findActiveVendeloOrders').mockRejectedValue(new Error('DB down'))
    const port = makePortMock()
    const cron = makeCron({ orderRepo, port })

    const result = await cron.tick()

    expect(result.errors).toBe(1)
    expect(result.batchSize).toBe(0)
    expect(port.getOrder).not.toHaveBeenCalled()
  })
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────

describe('VendeloShipmentPollerCron — lifecycle', () => {
  it('VENDELO_POLL_ENABLED=false → onModuleInit NO arranca el timer', () => {
    const cron = makeCron({ env: { VENDELO_POLL_ENABLED: 'false' } })
    const setSpy = vi.spyOn(global, 'setInterval')

    cron.onModuleInit()

    expect(setSpy).not.toHaveBeenCalled()
  })

  it('onModuleInit con enabled=true arranca el timer; onModuleDestroy lo limpia', () => {
    const cron = makeCron({ env: { VENDELO_POLL_ENABLED: 'true' } })
    const clearSpy = vi.spyOn(global, 'clearInterval')

    cron.onModuleInit()
    cron.onModuleDestroy()

    expect(clearSpy).toHaveBeenCalled()
  })
})

// ── Consulta en lote ──────────────────────────────────────────────────────────

describe('VendeloShipmentPollerCron — consulta en lote', () => {
  function snapshot(id: string, overrides: Partial<VendeloOrderSnapshot> = {}): VendeloOrderSnapshot {
    return { id, status: 'SHIPPED', trackingNumber: `TRK-${id}`, carrier: 'Coordinadora', ...overrides }
  }

  function makeOrderRepoWithOrder(active: ActiveVendeloOrder[]) {
    const repo = makeOrderRepoMock(active)
    vi.spyOn(repo, 'findById').mockResolvedValue({ id: 'order-1', userId: 'user-1', status: 'PAID' } as never)
    return repo
  }

  const orders = [
    buildOrder({ orderId: 'o1', vendeloOrderId: 'v1' }),
    buildOrder({ orderId: 'o2', vendeloOrderId: 'v2' }),
    buildOrder({ orderId: 'o3', vendeloOrderId: 'v3' }),
  ]

  it('si el lote trae todos los pedidos, no hace consultas individuales', async () => {
    const port = makePortMock()
    vi.mocked(port.getOrdersBatch).mockResolvedValue([snapshot('v1'), snapshot('v2'), snapshot('v3')])
    const cron = makeCron({ orderRepo: makeOrderRepoWithOrder(orders), port })

    const result = await cron.tick()

    expect(port.getOrdersBatch).toHaveBeenCalledWith(['v1', 'v2', 'v3'])
    expect(port.getOrder).not.toHaveBeenCalled()
    expect(result).toMatchObject({ fetchedInBatch: 3, fetchedIndividually: 0, transitionsApplied: 3 })
  })

  it('consulta uno a uno solo los que faltaron en el lote', async () => {
    const port = makePortMock()
    vi.mocked(port.getOrdersBatch).mockResolvedValue([snapshot('v1'), snapshot('v3')])
    const cron = makeCron({ orderRepo: makeOrderRepoWithOrder(orders), port })

    const result = await cron.tick()

    expect(port.getOrder).toHaveBeenCalledTimes(1)
    expect(port.getOrder).toHaveBeenCalledWith('v2')
    expect(result).toMatchObject({ fetchedInBatch: 2, fetchedIndividually: 1 })
  })

  it('si el lote falla, cae al fallback uno a uno sin perder el ciclo', async () => {
    const port = makePortMock()
    vi.mocked(port.getOrdersBatch).mockRejectedValue(new Error('Vendelo API 422: filter not supported'))
    const cron = makeCron({ orderRepo: makeOrderRepoWithOrder(orders), port })

    const result = await cron.tick()

    expect(port.getOrder).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({ fetchedInBatch: 0, fetchedIndividually: 3, errors: 0 })
  })

  it('pasa el detalle de seguimiento del snapshot a SyncShipmentStatus', async () => {
    const shipmentRepo = makeShipmentRepoMock()
    vi.spyOn(shipmentRepo, 'findByOrderId').mockResolvedValue(null)
    const port = makePortMock()
    vi.mocked(port.getOrdersBatch).mockResolvedValue([
      snapshot('vendelo-1', { trackingStatus: 'OUT-FOR-DELIVERY', deliveryAttempts: 2 }),
    ])
    const cron = makeCron({ orderRepo: makeOrderRepoWithOrder([buildOrder()]), shipmentRepo, port })

    await cron.tick()

    expect(shipmentRepo.updateTrackingDetails).toHaveBeenCalledWith('order-1', {
      trackingStatus: 'OUT-FOR-DELIVERY',
      deliveryAttempts: 2,
    })
  })
})
