import { describe, it, expect, vi } from 'vitest'
import { ValidateCoupon } from '@/domain/use-cases/coupons/ValidateCoupon'
import type { ICouponRepository } from '@/domain/repositories/ICouponRepository'
import type { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import type { Coupon } from '@/domain/entities/Coupon'
import type { ValidateCouponItem } from '@/domain/use-cases/coupons/ValidateCoupon'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeCoupon(overrides?: Partial<Coupon>): Coupon {
  return {
    id: 'coupon-1',
    code: 'HALLOWEEN20',
    type: 'PERCENTAGE',
    value: 2000, // 20% (en centésimas de porcentaje: 20 * 100)
    restriction: 'NONE',
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días adelante
    createdAt: new Date('2026-01-01'),
    categoryId: 'cat-1',
    productId: null,
    ...overrides,
  }
}

function makeItem(overrides?: Partial<ValidateCouponItem>): ValidateCouponItem {
  return {
    productId: 'prod-1',
    categoryId: 'cat-1',
    parentCategoryId: null,
    price: 10000000, // 100.000 COP en centavos
    quantity: 1,
    ...overrides,
  }
}

function makeRepos(coupon: Coupon | null, opts?: {
  existsByCouponAndUser?: boolean
  hasApprovedOrders?: boolean
}) {
  const couponRepo = {
    findByCode: vi.fn().mockResolvedValue(coupon),
  } as unknown as ICouponRepository

  const orderRepo = {
    existsByCouponAndUser: vi.fn().mockResolvedValue(opts?.existsByCouponAndUser ?? false),
    hasApprovedOrders: vi.fn().mockResolvedValue(opts?.hasApprovedOrders ?? false),
  } as unknown as IOrderRepository

  return { couponRepo, orderRepo }
}

const INPUT_BASE = {
  code: 'HALLOWEEN20',
  userId: 'user-1',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ValidateCoupon', () => {
  it('retorna err(NOT_FOUND) cuando el cupón no existe', async () => {
    const { couponRepo, orderRepo } = makeRepos(null)
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE, items: [makeItem()],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('retorna err(VALIDATION_ERROR) cuando el cupón está desactivado', async () => {
    const { couponRepo, orderRepo } = makeRepos(makeCoupon({ isActive: false }))
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE, items: [makeItem()],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('retorna err(VALIDATION_ERROR) cuando el cupón está vencido', async () => {
    const { couponRepo, orderRepo } = makeRepos(
      makeCoupon({ expiresAt: new Date('2020-01-01') }),
    )
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE, items: [makeItem()],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('retorna err(VALIDATION_ERROR) ONCE_PER_CUSTOMER cuando el cliente ya lo usó', async () => {
    const { couponRepo, orderRepo } = makeRepos(
      makeCoupon({ restriction: 'ONCE_PER_CUSTOMER' }),
      { existsByCouponAndUser: true },
    )
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE, items: [makeItem()],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(orderRepo.existsByCouponAndUser).toHaveBeenCalledWith('HALLOWEEN20', 'user-1')
  })

  it('retorna err(VALIDATION_ERROR) FIRST_PURCHASE cuando el cliente ya tiene pedidos aprobados', async () => {
    const { couponRepo, orderRepo } = makeRepos(
      makeCoupon({ restriction: 'FIRST_PURCHASE' }),
      { hasApprovedOrders: true },
    )
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE, items: [makeItem()],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(orderRepo.hasApprovedOrders).toHaveBeenCalledWith('user-1')
  })

  it('retorna err(VALIDATION_ERROR) cuando ningún ítem del carrito está dentro del scope', async () => {
    const { couponRepo, orderRepo } = makeRepos(makeCoupon({ categoryId: 'cat-cascos' }))
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE,
      items: [makeItem({ categoryId: 'cat-baterias', parentCategoryId: null })],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  // ── Happy path — categoría directa ────────────────────────────────────────

  it('aplica el descuento de porcentaje sobre el subtotal elegible (scope por categoría directa)', async () => {
    const { couponRepo, orderRepo } = makeRepos(makeCoupon({ value: 2000 })) // 20%
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE,
      items: [makeItem({ price: 10000000, quantity: 2 })], // subtotal 200.000 COP
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      // 20% de 20.000.000 centavos = 4.000.000 centavos
      expect(result.value.discount).toBe(4000000)
      expect(result.value.eligibleProductIds).toEqual(['prod-1'])
    }
  })

  it('aplica el descuento en cascada cuando el ítem está en una subcategoría del scope', async () => {
    const coupon = makeCoupon({ categoryId: 'cat-padre', productId: null })
    const { couponRepo, orderRepo } = makeRepos(coupon)
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE,
      items: [makeItem({ categoryId: 'cat-hija', parentCategoryId: 'cat-padre' })],
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.eligibleProductIds).toEqual(['prod-1'])
  })

  it('scope por producto específico: solo el producto exacto es elegible', async () => {
    const coupon = makeCoupon({ categoryId: null, productId: 'prod-casco-rojo' })
    const { couponRepo, orderRepo } = makeRepos(coupon)
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE,
      items: [
        makeItem({ productId: 'prod-casco-rojo', price: 5000000, quantity: 1 }),
        makeItem({ productId: 'prod-bateria', price: 3000000, quantity: 2 }),
      ],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.eligibleProductIds).toEqual(['prod-casco-rojo'])
      // 20% de 5.000.000 centavos = 1.000.000 centavos (solo el casco, no la batería)
      expect(result.value.discount).toBe(1000000)
    }
  })

  it('descuento FIXED: no supera el subtotal elegible', async () => {
    const coupon = makeCoupon({ type: 'FIXED', value: 999900000, productId: null }) // 9.999.000 COP
    const { couponRepo, orderRepo } = makeRepos(coupon)
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE,
      items: [makeItem({ price: 5000000, quantity: 1 })], // subtotal: 50.000 COP
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      // El descuento fijo no puede superar el subtotal
      expect(result.value.discount).toBe(5000000)
    }
  })

  it('NONE restriction: no consulta existsByCouponAndUser ni hasApprovedOrders', async () => {
    const { couponRepo, orderRepo } = makeRepos(makeCoupon({ restriction: 'NONE' }))
    await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE, items: [makeItem()],
    })
    expect(orderRepo.existsByCouponAndUser).not.toHaveBeenCalled()
    expect(orderRepo.hasApprovedOrders).not.toHaveBeenCalled()
  })

  it('ONCE_PER_CUSTOMER: permite si el cliente NO ha usado el cupón antes', async () => {
    const { couponRepo, orderRepo } = makeRepos(
      makeCoupon({ restriction: 'ONCE_PER_CUSTOMER' }),
      { existsByCouponAndUser: false },
    )
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE, items: [makeItem()],
    })
    expect(result.ok).toBe(true)
  })

  it('FIRST_PURCHASE: permite si el cliente NO tiene pedidos aprobados previos', async () => {
    const { couponRepo, orderRepo } = makeRepos(
      makeCoupon({ restriction: 'FIRST_PURCHASE' }),
      { hasApprovedOrders: false },
    )
    const result = await new ValidateCoupon(couponRepo, orderRepo).execute({
      ...INPUT_BASE, items: [makeItem()],
    })
    expect(result.ok).toBe(true)
  })
})
