import { describe, it, expect, vi } from 'vitest'
import { ConfirmPayment } from '@/domain/use-cases/orders/ConfirmPayment'
import type { IOrderRepository, PaymentTransitionResult } from '@/domain/repositories/IOrderRepository'
import type { Order } from '@/domain/entities/Order'

// ── Factory ───────────────────────────────────────────────────────────────────

function makePendingOrder(overrides?: Partial<Order>): Order {
  return {
    id: 'order-1',
    userId: 'user-1',
    status: 'PENDING',
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
    items: [
      { id: 'item-1', orderId: 'order-1', productId: 'prod-1', quantity: 2, priceAtPurchase: 2500000 },
    ],
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ConfirmPayment', () => {
  it('retorna ok({ stateChanged: true, finalStatus: PAID }) cuando el pago es APPROVED', async () => {
    const order = makePendingOrder()
    const transitionFromPending = vi.fn<() => Promise<PaymentTransitionResult>>()
      .mockResolvedValue({ applied: true })

    const orderRepo = {
      findById: vi.fn().mockResolvedValue(order),
      transitionFromPending,
    } as unknown as IOrderRepository

    const result = await new ConfirmPayment(orderRepo).execute({
      orderId: 'order-1',
      externalId: 'ext-123',
      status: 'APPROVED',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.stateChanged).toBe(true)
      expect(result.value.finalStatus).toBe('PAID')
    }
  })

  it('pasa stockDecrements con los ítems de la orden dentro de la transición APPROVED', async () => {
    const order = makePendingOrder()
    const transitionFromPending = vi.fn<() => Promise<PaymentTransitionResult>>()
      .mockResolvedValue({ applied: true })

    const orderRepo = {
      findById: vi.fn().mockResolvedValue(order),
      transitionFromPending,
    } as unknown as IOrderRepository

    await new ConfirmPayment(orderRepo).execute({
      orderId: 'order-1',
      externalId: 'ext-123',
      status: 'APPROVED',
    })

    expect(transitionFromPending).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        orderStatus: 'PAID',
        paymentStatus: 'APPROVED',
        externalId: 'ext-123',
        stockDecrements: [{ productId: 'prod-1', quantity: 2 }],
      }),
    )
  })

  it('idempotencia: retorna stateChanged: false cuando la orden ya no está PENDING', async () => {
    const paidOrder = makePendingOrder({ status: 'PAID' })
    const transitionFromPending = vi.fn()

    const orderRepo = {
      findById: vi.fn().mockResolvedValue(paidOrder),
      transitionFromPending,
    } as unknown as IOrderRepository

    const result = await new ConfirmPayment(orderRepo).execute({
      orderId: 'order-1',
      externalId: 'ext-123',
      status: 'APPROVED',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.stateChanged).toBe(false)
    expect(transitionFromPending).not.toHaveBeenCalled()
  })

  it('idempotencia: retorna stateChanged: false cuando transitionFromPending reporta applied: false', async () => {
    const order = makePendingOrder()
    const transitionFromPending = vi.fn<() => Promise<PaymentTransitionResult>>()
      .mockResolvedValue({ applied: false })

    const orderRepo = {
      findById: vi.fn().mockResolvedValue(order),
      transitionFromPending,
    } as unknown as IOrderRepository

    const result = await new ConfirmPayment(orderRepo).execute({
      orderId: 'order-1',
      externalId: 'ext-123',
      status: 'APPROVED',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.stateChanged).toBe(false)
  })

  it('no llama a transitionFromPending cuando el webhook reporta status PENDING', async () => {
    const order = makePendingOrder()
    const transitionFromPending = vi.fn()

    const orderRepo = {
      findById: vi.fn().mockResolvedValue(order),
      transitionFromPending,
    } as unknown as IOrderRepository

    const result = await new ConfirmPayment(orderRepo).execute({
      orderId: 'order-1',
      externalId: 'ext-123',
      status: 'PENDING',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.stateChanged).toBe(false)
    expect(transitionFromPending).not.toHaveBeenCalled()
  })

  it('cancela la orden (CANCELLED) cuando el pago es DECLINED', async () => {
    const order = makePendingOrder()
    const transitionFromPending = vi.fn<() => Promise<PaymentTransitionResult>>()
      .mockResolvedValue({ applied: true })

    const orderRepo = {
      findById: vi.fn().mockResolvedValue(order),
      transitionFromPending,
    } as unknown as IOrderRepository

    const result = await new ConfirmPayment(orderRepo).execute({
      orderId: 'order-1',
      externalId: 'ext-123',
      status: 'DECLINED',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.stateChanged).toBe(true)
      expect(result.value.finalStatus).toBe('CANCELLED')
    }
    expect(transitionFromPending).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        orderStatus: 'CANCELLED',
        stockDecrements: undefined,
      }),
    )
  })

  it('retorna err(VALIDATION_ERROR) cuando el monto del webhook no coincide con el total del pedido', async () => {
    const order = makePendingOrder({ total: 5000000 })

    const orderRepo = {
      findById: vi.fn().mockResolvedValue(order),
      transitionFromPending: vi.fn(),
    } as unknown as IOrderRepository

    const result = await new ConfirmPayment(orderRepo).execute({
      orderId: 'order-1',
      externalId: 'ext-123',
      status: 'APPROVED',
      amountInCents: 9999999,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('retorna err(NOT_FOUND) cuando el pedido no existe', async () => {
    const orderRepo = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as IOrderRepository

    const result = await new ConfirmPayment(orderRepo).execute({
      orderId: 'orden-inexistente',
      externalId: 'ext-123',
      status: 'APPROVED',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })
})
