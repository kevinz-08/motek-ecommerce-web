import { describe, it, expect, vi } from 'vitest'
import { CreateShipments } from '@/domain/use-cases/shipping/CreateShipments'
import type { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import type { IVendeloShippingPort } from '@/domain/repositories/IVendeloShippingPort'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrderRepo(
  rows: Array<{ id: string; vendeloOrderId: string | null }>,
): IOrderRepository {
  return {
    findVendeloOrderIdsBatch: vi.fn().mockResolvedValue(rows),
  } as unknown as IOrderRepository
}

function makeShippingPort(message = 'Envíos creados'): IVendeloShippingPort {
  return {
    createShipments: vi.fn().mockResolvedValue({ message }),
  } as unknown as IVendeloShippingPort
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateShipments', () => {
  it('happy path: procesa pedidos con vendeloOrderId y reporta skipped los que no lo tienen', async () => {
    const orderRepo = makeOrderRepo([
      { id: 'order-1', vendeloOrderId: 'v-001' },
      { id: 'order-2', vendeloOrderId: null },
      { id: 'order-3', vendeloOrderId: 'v-003' },
    ])
    const shippingPort = makeShippingPort('2 envíos creados')

    const result = await new CreateShipments(orderRepo, shippingPort).execute({
      orderIds: ['order-1', 'order-2', 'order-3'],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.processed).toEqual(['v-001', 'v-003'])
      expect(result.value.skipped).toEqual(['order-2'])
      expect(result.value.message).toBe('2 envíos creados')
    }
  })

  it('llama a shippingPort.createShipments solo con los vendeloOrderIds, nunca con los internos', async () => {
    const orderRepo = makeOrderRepo([
      { id: 'order-1', vendeloOrderId: 'v-001' },
    ])
    const shippingPort = makeShippingPort()

    await new CreateShipments(orderRepo, shippingPort).execute({
      orderIds: ['order-1'],
    })

    expect(shippingPort.createShipments).toHaveBeenCalledWith(['v-001'])
  })

  it('retorna VALIDATION_ERROR cuando el array de orderIds está vacío', async () => {
    const result = await new CreateShipments(
      {} as IOrderRepository,
      {} as IVendeloShippingPort,
    ).execute({ orderIds: [] })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('retorna VALIDATION_ERROR cuando ningún pedido tiene vendeloOrderId asignado', async () => {
    const orderRepo = makeOrderRepo([
      { id: 'order-1', vendeloOrderId: null },
      { id: 'order-2', vendeloOrderId: null },
    ])

    const result = await new CreateShipments(orderRepo, {} as IVendeloShippingPort).execute({
      orderIds: ['order-1', 'order-2'],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toMatch(/VendeloOrderQueueService/)
    }
  })

  it('no llama a createShipments si todos los pedidos están en skipped', async () => {
    const orderRepo = makeOrderRepo([{ id: 'order-1', vendeloOrderId: null }])
    const createShipments = vi.fn()
    const shippingPort = { createShipments } as unknown as IVendeloShippingPort

    await new CreateShipments(orderRepo, shippingPort).execute({ orderIds: ['order-1'] })

    expect(createShipments).not.toHaveBeenCalled()
  })

  it('retorna ok con processed vacío y todos en skipped no es posible (ya falla antes)', async () => {
    // Verificar que la query batch se llama con los IDs correctos
    const findBatch = vi.fn().mockResolvedValue([
      { id: 'order-A', vendeloOrderId: 'v-A' },
    ])
    const orderRepo = { findVendeloOrderIdsBatch: findBatch } as unknown as IOrderRepository
    const shippingPort = makeShippingPort()

    await new CreateShipments(orderRepo, shippingPort).execute({ orderIds: ['order-A'] })

    expect(findBatch).toHaveBeenCalledWith(['order-A'])
  })
})
