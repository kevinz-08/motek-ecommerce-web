import { describe, it, expect, vi } from 'vitest'
import { CancelOrder } from '@/domain/use-cases/orders/CancelOrder'
import type { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import type { IShipmentRepository } from '@/domain/repositories/IShipmentRepository'
import type { IVendeloShippingPort } from '@/domain/repositories/IVendeloShippingPort'
import type { Order, OrderStatus } from '@/domain/entities/Order'
import type { Shipment, ShipmentStatus } from '@/domain/entities/Shipment'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeOrder(status: OrderStatus = 'PAID'): Order {
  return {
    id: 'order-1',
    userId: 'user-1',
    guestId: null,
    contactEmail: 'cliente@motek.test',
    trackingToken: 'tok-test-order-1',
    status,
    total: 5000000,
    shippingAddress: { fullName: 'Carlos Pérez', address: 'Calle 123', city: 'Bogotá', phone: '3001234567' },
    buyer: { idType: 'CC', idNumber: '1000123456' },
    paymentProvider: 'WOMPI',
    deliveryMethod: 'HOME_DELIVERY',
    shippingTotal: 0,
    createdAt: new Date('2025-01-01'),
  }
}

function makeShipment(status: ShipmentStatus): Shipment {
  return {
    id: 'shipment-1', orderId: 'order-1', status,
    trackingNumber: null, carrier: null, labelUrl: null,
    trackingStatus: null, deliveryAttempts: null, deliveredAt: null, trackingUpdatedAt: null,
    createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
  }
}

function makeDeps(opts: {
  order?: Order | null
  shipment?: Shipment | null
  vendeloOrderId?: string | null
  cancelFails?: boolean
} = {}) {
  const orderRepo = {
    findById: vi.fn().mockResolvedValue(opts.order === undefined ? makeOrder() : opts.order),
    findVendeloOrderIdsBatch: vi.fn().mockResolvedValue([{ id: 'order-1', vendeloOrderId: opts.vendeloOrderId ?? null }]),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    restockItems: vi.fn().mockResolvedValue(undefined),
  } as unknown as IOrderRepository
  const shipmentRepo = {
    findByOrderId: vi.fn().mockResolvedValue(opts.shipment ?? null),
    upsert: vi.fn().mockResolvedValue(undefined),
    atomicUpdateStatus: vi.fn().mockResolvedValue({ applied: true }),
    updateTrackingDetails: vi.fn().mockResolvedValue(undefined),
  } as unknown as IShipmentRepository
  const port = {
    cancelOrder: opts.cancelFails
      ? vi.fn().mockRejectedValue(new Error('Vendelo API 422: no se puede anular'))
      : vi.fn().mockResolvedValue({ message: 'ok' }),
  } as unknown as IVendeloShippingPort
  return { orderRepo, shipmentRepo, port, useCase: new CancelOrder(orderRepo, shipmentRepo, port) }
}

describe('CancelOrder', () => {
  it('pedido en Vendelo: anula allá primero, luego el envío y el pedido local (con restock)', async () => {
    const { orderRepo, shipmentRepo, port, useCase } = makeDeps({
      vendeloOrderId: 'v-1',
      shipment: makeShipment('READY'),
    })

    const result = await useCase.execute({ orderId: 'order-1' })

    expect(result.ok && result.value).toEqual({ alreadyCancelled: false, cancelledInVendelo: true })
    expect(port.cancelOrder).toHaveBeenCalledWith('v-1')
    expect(shipmentRepo.atomicUpdateStatus).toHaveBeenCalledWith('order-1', 'READY', 'CANCELLED', expect.anything())
    expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-1', 'CANCELLED')
    expect(orderRepo.restockItems).toHaveBeenCalledTimes(1)
  })

  it('si Vendelo rechaza la anulación, el pedido local NO cambia', async () => {
    const { orderRepo, useCase } = makeDeps({ vendeloOrderId: 'v-1', cancelFails: true })

    const result = await useCase.execute({ orderId: 'order-1' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL_ERROR')
      expect(result.error.message).toContain('no se puede anular')
    }
    expect(orderRepo.updateStatus).not.toHaveBeenCalled()
    expect(orderRepo.restockItems).not.toHaveBeenCalled()
  })

  it('pedido PAID aún sin enviar a Vendelo: solo estado local + reposición de stock', async () => {
    const { orderRepo, port, useCase } = makeDeps({ vendeloOrderId: null })

    const result = await useCase.execute({ orderId: 'order-1' })

    expect(result.ok && result.value.cancelledInVendelo).toBe(false)
    expect(port.cancelOrder).not.toHaveBeenCalled()
    expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-1', 'CANCELLED')
    expect(orderRepo.restockItems).toHaveBeenCalledWith('order-1')
  })

  it('pedido PENDING (sin pago): no repone stock porque nunca se descontó', async () => {
    const { orderRepo, useCase } = makeDeps({ order: makeOrder('PENDING') })

    await useCase.execute({ orderId: 'order-1' })

    expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-1', 'CANCELLED')
    expect(orderRepo.restockItems).not.toHaveBeenCalled()
  })

  it.each<ShipmentStatus>(['SHIPPED', 'INCIDENT', 'DELIVERED', 'RETURNED'])(
    'rechaza anular si el envío ya está en %s',
    async (status) => {
      const { port, orderRepo, useCase } = makeDeps({ vendeloOrderId: 'v-1', shipment: makeShipment(status) })

      const result = await useCase.execute({ orderId: 'order-1' })

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(port.cancelOrder).not.toHaveBeenCalled()
      expect(orderRepo.updateStatus).not.toHaveBeenCalled()
    },
  )

  it('rechaza anular un pedido SHIPPED aunque no haya registro de envío', async () => {
    const { useCase } = makeDeps({ order: makeOrder('SHIPPED') })

    const result = await useCase.execute({ orderId: 'order-1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('pedido ya cancelado: no hace nada', async () => {
    const { orderRepo, port, useCase } = makeDeps({ order: makeOrder('CANCELLED'), vendeloOrderId: 'v-1' })

    const result = await useCase.execute({ orderId: 'order-1' })

    expect(result.ok && result.value.alreadyCancelled).toBe(true)
    expect(port.cancelOrder).not.toHaveBeenCalled()
    expect(orderRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('pedido inexistente → NOT_FOUND', async () => {
    const { useCase } = makeDeps({ order: null })

    const result = await useCase.execute({ orderId: 'nope' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })
})
