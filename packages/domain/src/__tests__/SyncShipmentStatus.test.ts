import { describe, it, expect, vi } from 'vitest'
import { SyncShipmentStatus } from '@/domain/use-cases/orders/SyncShipmentStatus'
import type { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import type { IShipmentRepository } from '@/domain/repositories/IShipmentRepository'
import type { Order } from '@/domain/entities/Order'
import type { Shipment } from '@/domain/entities/Shipment'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeOrder(overrides?: Partial<Order>): Order {
  return {
    id: 'order-1',
    userId: 'user-1',
    guestId: null,
    contactEmail: 'cliente@motek.test',
    trackingToken: 'tok-test-order-1',
    status: 'PAID',
    total: 5000000,
    shippingAddress: {
      fullName: 'Carlos Pérez',
      address: 'Calle 123 #45-67',
      city: 'Bogotá',
      department: 'Cundinamarca',
      phone: '3001234567',
    },
    buyer: { idType: 'CC', idNumber: '1000123456' },
    paymentProvider: 'WOMPI',
    deliveryMethod: 'HOME_DELIVERY',
    shippingTotal: 0,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  }
}

function makeShipment(overrides?: Partial<Shipment>): Shipment {
  return {
    id: 'shipment-1',
    orderId: 'order-1',
    status: 'PENDING',
    trackingNumber: null,
    carrier: null,
    labelUrl: null,
    trackingStatus: null,
    deliveryAttempts: null,
    deliveredAt: null,
    trackingUpdatedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

function makeOrderRepo(order: Order | null): IOrderRepository {
  return {
    findById: vi.fn().mockResolvedValue(order),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    restockItems: vi.fn().mockResolvedValue(undefined),
  } as unknown as IOrderRepository
}

function makeShipmentRepo(shipment: Shipment | null, applied = true): IShipmentRepository {
  return {
    findByOrderId: vi.fn().mockResolvedValue(shipment),
    upsert: vi.fn().mockResolvedValue(shipment ?? makeShipment()),
    atomicUpdateStatus: vi.fn().mockResolvedValue({ applied }),
    updateTrackingDetails: vi.fn().mockResolvedValue(undefined),
  } as unknown as IShipmentRepository
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SyncShipmentStatus', () => {
  describe('progresión válida', () => {
    it('aplica transición PENDING → READY y retorna updated: true', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'PENDING' }))
      const orderRepo = makeOrderRepo(makeOrder())

      const result = await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'READY',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.updated).toBe(true)
        expect(result.value.newStatus).toBe('READY')
      }
    })

    it('llama a atomicUpdateStatus con los parámetros from/to correctos', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'READY' }))
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'SHIPPED',
        trackingNumber: 'TRK-001',
        carrier: 'COORDINADORA',
      })

      expect(shipmentRepo.atomicUpdateStatus).toHaveBeenCalledWith(
        'order-1',
        'READY',
        'SHIPPED',
        expect.objectContaining({ trackingNumber: 'TRK-001', carrier: 'COORDINADORA' }),
      )
    })

    it('actualiza Order.status a DELIVERED cuando el envío llega a DELIVERED', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'SHIPPED' }))
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'DELIVERED',
      })

      expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-1', 'DELIVERED')
    })

    it('no actualiza Order.status para transiciones intermedias (PENDING → READY)', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'PENDING' }))
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'READY',
      })

      expect(orderRepo.updateStatus).not.toHaveBeenCalled()
    })
  })

  describe('idempotencia', () => {
    it('retorna updated: false cuando el status entrante tiene rank igual al actual (evento duplicado)', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'SHIPPED' }))
      const orderRepo = makeOrderRepo(makeOrder())

      const result = await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'SHIPPED',
      })

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.updated).toBe(false)
      expect(shipmentRepo.atomicUpdateStatus).not.toHaveBeenCalled()
    })

    it('retorna updated: false cuando el status entrante tiene rank menor (retroceso rechazado)', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'DELIVERED' }))
      const orderRepo = makeOrderRepo(makeOrder())

      const result = await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'SHIPPED',
      })

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.updated).toBe(false)
    })

    it('retorna updated: false cuando atomicUpdateStatus informa applied: false (race condition entre workers)', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'READY' }), false)
      const orderRepo = makeOrderRepo(makeOrder())

      const result = await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'SHIPPED',
      })

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.updated).toBe(false)
    })
  })

  describe('estado CANCELLED (terminal especial)', () => {
    it('acepta CANCELLED desde cualquier estado (incluyendo DELIVERED)', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'DELIVERED' }))
      const orderRepo = makeOrderRepo(makeOrder())

      const result = await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'CANCELLED',
      })

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.updated).toBe(true)
    })

    it('actualiza Order.status a CANCELLED cuando el envío se cancela', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'READY' }))
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'CANCELLED',
      })

      expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-1', 'CANCELLED')
    })
  })

  describe('restock automático', () => {
    it('restaura stock cuando el envío pasa a RETURNED desde SHIPPED', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'SHIPPED' }))
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'RETURNED',
      })

      expect(orderRepo.restockItems).toHaveBeenCalledWith('order-1')
    })

    it('restaura stock cuando el envío pasa a CANCELLED desde READY', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'READY' }))
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'CANCELLED',
      })

      expect(orderRepo.restockItems).toHaveBeenCalledWith('order-1')
    })

    it('NO restaura stock dos veces si CANCELLED es seguido de un evento RETURNED tardío', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'CANCELLED' }))
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'RETURNED',
      })

      expect(orderRepo.restockItems).not.toHaveBeenCalled()
    })

    it('no restaura stock en transiciones que no son de devolución (ej. SHIPPED → DELIVERED)', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'SHIPPED' }))
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'DELIVERED',
      })

      expect(orderRepo.restockItems).not.toHaveBeenCalled()
    })

    it('restaura stock cuando RETURNED llega como primer evento (sin shipment previo)', async () => {
      const shipmentRepo = makeShipmentRepo(null)
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'RETURNED',
      })

      expect(orderRepo.restockItems).toHaveBeenCalledWith('order-1')
    })
  })

  describe('envío sin registro previo', () => {
    it('crea el envío via upsert cuando no existe registro previo en DB', async () => {
      const shipmentRepo = makeShipmentRepo(null)
      const orderRepo = makeOrderRepo(makeOrder())

      const result = await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'READY',
      })

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.updated).toBe(true)
      expect(shipmentRepo.upsert).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({ status: 'READY' }),
      )
    })

    it('no llama a atomicUpdateStatus cuando no existe registro previo', async () => {
      const shipmentRepo = makeShipmentRepo(null)
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'READY',
      })

      expect(shipmentRepo.atomicUpdateStatus).not.toHaveBeenCalled()
    })
  })

  describe('errores', () => {
    it('retorna NOT_FOUND cuando el pedido no existe', async () => {
      const orderRepo = makeOrderRepo(null)
      const shipmentRepo = makeShipmentRepo(null)

      const result = await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'pedido-inexistente',
        vendelo_status: 'READY',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  describe('detalle de seguimiento', () => {
    it('un evento sin datos de envío NO borra la guía guardada (no envía null al repo)', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'SHIPPED', trackingNumber: 'TRK-001', carrier: 'Coordinadora' }))
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'DELIVERED',
      })

      const extra = vi.mocked(shipmentRepo.atomicUpdateStatus).mock.calls[0][3]
      expect(extra?.trackingNumber).toBeUndefined()
      expect(extra?.carrier).toBeUndefined()
    })

    it('actualiza intentos de entrega y estado fino aunque el status no avance', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'INCIDENT', deliveryAttempts: 1 }))
      const orderRepo = makeOrderRepo(makeOrder())

      const result = await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'INCIDENT',
        trackingStatus: 'OUT-FOR-DELIVERY',
        deliveryAttempts: 2,
      })

      expect(result.ok && result.value).toMatchObject({ updated: false, detailsUpdated: true })
      expect(shipmentRepo.atomicUpdateStatus).not.toHaveBeenCalled()
      expect(shipmentRepo.updateTrackingDetails).toHaveBeenCalledWith('order-1', {
        trackingStatus: 'OUT-FOR-DELIVERY',
        deliveryAttempts: 2,
      })
    })

    it('no escribe nada si el detalle es igual al guardado (polling repetido)', async () => {
      const deliveredAt = new Date('2026-10-10T15:00:00Z')
      const shipmentRepo = makeShipmentRepo(makeShipment({
        status: 'DELIVERED', trackingNumber: 'TRK-001', trackingStatus: 'DELIVERED', deliveryAttempts: 1, deliveredAt,
      }))
      const orderRepo = makeOrderRepo(makeOrder())

      const result = await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'DELIVERED',
        trackingNumber: 'TRK-001',
        trackingStatus: 'DELIVERED',
        deliveryAttempts: 1,
        deliveredAt: new Date(deliveredAt.getTime()),
      })

      expect(result.ok && result.value.detailsUpdated).toBe(false)
      expect(shipmentRepo.updateTrackingDetails).not.toHaveBeenCalled()
    })

    it('registra la guía asignada antes del despacho aunque el status no cambie', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'READY' }))
      const orderRepo = makeOrderRepo(makeOrder())

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'READY',
        trackingNumber: 'TRK-NEW',
        carrier: 'Coordinadora',
      })

      expect(shipmentRepo.updateTrackingDetails).toHaveBeenCalledWith('order-1', {
        trackingNumber: 'TRK-NEW',
        carrier: 'Coordinadora',
      })
    })

    it('en una transición escribe el detalle restante sin repetir guía/transportadora', async () => {
      const shipmentRepo = makeShipmentRepo(makeShipment({ status: 'SHIPPED' }))
      const orderRepo = makeOrderRepo(makeOrder())
      const deliveredAt = new Date('2026-10-12T10:00:00Z')

      await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'DELIVERED',
        trackingNumber: 'TRK-001',
        trackingStatus: 'DELIVERED',
        deliveredAt,
      })

      expect(shipmentRepo.updateTrackingDetails).toHaveBeenCalledWith('order-1', {
        trackingStatus: 'DELIVERED',
        deliveredAt,
      })
    })

    it('al crear el envío guarda también el detalle de seguimiento', async () => {
      const shipmentRepo = makeShipmentRepo(null)
      const orderRepo = makeOrderRepo(makeOrder())

      const result = await new SyncShipmentStatus(shipmentRepo, orderRepo).execute({
        orderId: 'order-1',
        vendelo_status: 'SHIPPED',
        trackingNumber: 'TRK-001',
        trackingStatus: 'TRANSIT',
      })

      expect(result.ok && result.value.detailsUpdated).toBe(true)
      expect(shipmentRepo.upsert).toHaveBeenCalledWith('order-1', expect.objectContaining({ trackingNumber: 'TRK-001' }))
      expect(shipmentRepo.updateTrackingDetails).toHaveBeenCalledWith('order-1', { trackingStatus: 'TRANSIT' })
    })
  })
})
