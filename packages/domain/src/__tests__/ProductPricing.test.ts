import { describe, it, expect } from 'vitest'
import { validateProductPricing, getDiscountPercent, hasCompareAtPrice } from '@/domain/entities/Product'

describe('validateProductPricing', () => {
  it('acepta precio sin ancla', () => {
    expect(validateProductPricing(8_500_000, null)).toBeNull()
    expect(validateProductPricing(8_500_000, undefined)).toBeNull()
  })

  it('acepta ancla mayor que el precio', () => {
    expect(validateProductPricing(8_500_000, 10_000_000)).toBeNull()
  })

  it('rechaza ancla igual o menor al precio', () => {
    expect(validateProductPricing(8_500_000, 8_500_000)).toMatch(/mayor/)
    expect(validateProductPricing(8_500_000, 7_000_000)).toMatch(/mayor/)
  })

  it('rechaza precios no enteros o negativos', () => {
    expect(validateProductPricing(-1, null)).not.toBeNull()
    expect(validateProductPricing(10.5, null)).not.toBeNull()
    expect(validateProductPricing(100, 200.5)).not.toBeNull()
  })
})

describe('getDiscountPercent', () => {
  it('calcula el porcentaje redondeando hacia abajo', () => {
    expect(getDiscountPercent(8_500_000, 10_000_000)).toBe(15)
    expect(getDiscountPercent(6_667, 10_000)).toBe(33)
  })

  it('retorna 0 sin ancla o con ancla inválida', () => {
    expect(getDiscountPercent(100, null)).toBe(0)
    expect(getDiscountPercent(100, 100)).toBe(0)
    expect(getDiscountPercent(100, 50)).toBe(0)
  })

  it('hasCompareAtPrice refleja si hay descuento visible', () => {
    expect(hasCompareAtPrice({ price: 100, compareAtPrice: 200 })).toBe(true)
    expect(hasCompareAtPrice({ price: 100, compareAtPrice: null })).toBe(false)
    // descuento < 1 % no se muestra
    expect(hasCompareAtPrice({ price: 999, compareAtPrice: 1000 })).toBe(false)
  })
})
