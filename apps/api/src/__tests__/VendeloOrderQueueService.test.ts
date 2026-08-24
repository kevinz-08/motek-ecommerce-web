import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'

// vi.mock se alza (hoist) antes de los imports — @motek/database estará mockeado
// cuando PrismaService intente importarlo, evitando el error de cliente generado.
vi.mock('@motek/database', () => ({
  prisma: { $connect: vi.fn(), $disconnect: vi.fn() },
  PrismaClient: vi.fn(),
}))

import { VendeloOrderQueueService } from '../infrastructure/services/VendeloOrderQueueService'

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueRow {
  id: string
  orderId: string
  attempts: number
  lastError: string | null
  status: string
  createdAt: Date
  nextRetry: Date
  processingStartedAt: Date | null
}

interface OrderRow {
  id: string
  userId: string
  vendeloOrderId: string | null
  shippingAddress: unknown
  buyerIdType: string
  buyerIdNumber: string
  buyerBusinessName: string | null
  items: Array<{
    id: string
    orderId: string
    productId: string
    quantity: number
    priceAtPurchase: number
    product: {
      sku: string
      name: string
      weightKg?: number | null
      heightCm?: number | null
      widthCm?: number | null
      lengthCm?: number | null
    }
  }>
}

interface PrismaMock {
  client: {
    vendeloOrderQueue: {
      findMany: MockedFunction<(args: unknown) => Promise<QueueRow[]>>
      updateMany: MockedFunction<(args: unknown) => Promise<{ count: number }>>
      update: MockedFunction<(args: unknown) => Promise<QueueRow>>
    }
    order: {
      findUnique: MockedFunction<(args: unknown) => Promise<OrderRow | null>>
      updateMany: MockedFunction<(args: unknown) => Promise<{ count: number }>>
      update: MockedFunction<(args: unknown) => Promise<unknown>>
    }
    user: {
      findUnique: MockedFunction<(args: unknown) => Promise<{ email: string } | null>>
    }
    $transaction: MockedFunction<(ops: unknown[]) => Promise<unknown>>
  }
}

interface VendeloServiceMock {
  createOrder: MockedFunction<(...args: unknown[]) => Promise<{ items: Array<{ id: string }> }>>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueueRow(overrides: Partial<QueueRow> = {}): QueueRow {
  return {
    id: 'queue-001',
    orderId: 'order-001',
    attempts: 0,
    lastError: null,
    status: 'PENDING',
    createdAt: new Date(),
    nextRetry: new Date(),
    processingStartedAt: null,
    ...overrides,
  }
}

function makeOrderRow(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 'order-001',
    userId: 'user-001',
    vendeloOrderId: null,
    shippingAddress: { fullName: 'Juan Pérez', address: 'Calle 1', city: 'Medellín', phone: '3001234567' },
    buyerIdType: 'CC',
    buyerIdNumber: '12345678',
    buyerBusinessName: null,
    items: [
      {
        id: 'item-001',
        orderId: 'order-001',
        productId: 'prod-cuid-xyz',
        quantity: 1,
        priceAtPurchase: 50_000,
        product: { sku: 'SKU-REAL-001', name: 'Bujía NGK' },
      },
    ],
    ...overrides,
  }
}

function makePrismaMock(): PrismaMock {
  return {
    client: {
      vendeloOrderQueue: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue(makeQueueRow()),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue(makeOrderRow()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ email: 'cliente@test.com' }),
      },
      $transaction: vi.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
    },
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('VendeloOrderQueueService', () => {
  let prismaMock: PrismaMock
  let vendeloServiceMock: VendeloServiceMock
  let service: VendeloOrderQueueService

  beforeEach(() => {
    prismaMock = makePrismaMock()
    vendeloServiceMock = {
      createOrder: vi.fn().mockResolvedValue({ items: [{ id: 'vendelo-order-001' }] }),
    }
    service = new VendeloOrderQueueService(prismaMock as never, vendeloServiceMock as never)
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  it('procesa una orden pendiente: reclama la fila, crea en Vendelo y marca SENT', async () => {
    prismaMock.client.vendeloOrderQueue.findMany.mockResolvedValue([makeQueueRow()])

    await service.processNext()

    expect(prismaMock.client.vendeloOrderQueue.updateMany).toHaveBeenCalledWith({
      where: { id: 'queue-001', status: 'PENDING' },
      data: { status: 'PROCESSING', processingStartedAt: expect.any(Date) },
    })
    expect(vendeloServiceMock.createOrder).toHaveBeenCalledTimes(1)
    expect(prismaMock.client.$transaction).toHaveBeenCalledTimes(1)
  })

  it('pasa el sku y name reales del producto a VendeloService.createOrder (no el productId/cuid)', async () => {
    prismaMock.client.vendeloOrderQueue.findMany.mockResolvedValue([makeQueueRow()])

    await service.processNext()

    const [domainOrder] = vendeloServiceMock.createOrder.mock.calls[0] as [{ items: Array<{ productSnapshot?: { sku: string; name: string } }> }]
    expect(domainOrder.items[0].productSnapshot).toEqual({ sku: 'SKU-REAL-001', name: 'Bujía NGK' })
  })

  it('pasa el peso/dimensiones reales del producto en el productSnapshot cuando existen', async () => {
    prismaMock.client.vendeloOrderQueue.findMany.mockResolvedValue([makeQueueRow()])
    prismaMock.client.order.findUnique.mockResolvedValue(makeOrderRow({
      items: [{
        id: 'item-001', orderId: 'order-001', productId: 'prod-cuid-xyz', quantity: 1, priceAtPurchase: 50_000,
        product: { sku: 'SKU-REAL-001', name: 'Bujía NGK', weightKg: 3.2, heightCm: 20, widthCm: 15, lengthCm: 30 },
      }],
    }))

    await service.processNext()

    const [domainOrder] = vendeloServiceMock.createOrder.mock.calls[0] as [{
      items: Array<{ productSnapshot?: { weightKg?: number | null; heightCm?: number | null; widthCm?: number | null; lengthCm?: number | null } }>
    }]
    expect(domainOrder.items[0].productSnapshot).toMatchObject({ weightKg: 3.2, heightCm: 20, widthCm: 15, lengthCm: 30 })
  })

  // ── Causa B: segundo worker agarra la misma fila ─────────────────────────

  it('si otro worker ya reclamó la fila (claim count=0), no llama a Vendelo', async () => {
    prismaMock.client.vendeloOrderQueue.findMany.mockResolvedValue([makeQueueRow()])
    prismaMock.client.vendeloOrderQueue.updateMany.mockResolvedValue({ count: 0 })

    await service.processNext()

    expect(vendeloServiceMock.createOrder).not.toHaveBeenCalled()
  })

  // ── Causa A/D: guard de vendeloOrderId ya existente ──────────────────────

  it('si el pedido ya tiene vendeloOrderId, no vuelve a llamar a Vendelo y marca SENT', async () => {
    prismaMock.client.vendeloOrderQueue.findMany.mockResolvedValue([makeQueueRow()])
    prismaMock.client.order.findUnique.mockResolvedValue(makeOrderRow({ vendeloOrderId: 'vendelo-existing-999' }))

    await service.processNext()

    expect(vendeloServiceMock.createOrder).not.toHaveBeenCalled()
    expect(prismaMock.client.vendeloOrderQueue.update).toHaveBeenCalledWith({
      where: { id: 'queue-001' },
      data: { status: 'SENT', attempts: 1 },
    })
  })

  // ── Retry de fila huérfana (sweeper) ─────────────────────────────────────

  it('libera filas PROCESSING atascadas por más de 5 minutos antes de procesar', async () => {
    await service.processNext()

    expect(prismaMock.client.vendeloOrderQueue.updateMany).toHaveBeenCalledWith({
      where: { status: 'PROCESSING', processingStartedAt: { lt: expect.any(Date) } },
      data: { status: 'PENDING', processingStartedAt: null },
    })
  })

  it('no libera filas PROCESSING recientes (menos de 5 min)', async () => {
    prismaMock.client.vendeloOrderQueue.updateMany.mockResolvedValueOnce({ count: 0 })

    await service.processNext()

    expect(prismaMock.client.vendeloOrderQueue.findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING', nextRetry: { lte: expect.any(Date) } },
      take: 10,
      orderBy: { createdAt: 'asc' },
    })
  })

  // ── Capa 3: commit idempotente ───────────────────────────────────────────

  it('al confirmar éxito, solo actualiza order.vendeloOrderId si seguía NULL', async () => {
    prismaMock.client.vendeloOrderQueue.findMany.mockResolvedValue([makeQueueRow()])

    await service.processNext()

    const ops = prismaMock.client.$transaction.mock.calls[0]?.[0] as Array<unknown>
    expect(ops).toHaveLength(2)
    expect(prismaMock.client.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-001', vendeloOrderId: null },
      data: { vendeloOrderId: 'vendelo-order-001' },
    })
  })

  // ── Falla → backoff ───────────────────────────────────────────────────────

  it('en caso de error, programa retry con backoff y libera el lock (PROCESSING → PENDING)', async () => {
    prismaMock.client.vendeloOrderQueue.findMany.mockResolvedValue([makeQueueRow()])
    vendeloServiceMock.createOrder.mockRejectedValue(new Error('Vendelo API 503: timeout'))

    await service.processNext()

    expect(prismaMock.client.vendeloOrderQueue.update).toHaveBeenCalledWith({
      where: { id: 'queue-001' },
      data: {
        attempts: 1,
        lastError: 'Error: Vendelo API 503: timeout',
        status: 'PENDING',
        nextRetry: expect.any(Date),
        processingStartedAt: null,
      },
    })
  })
})
