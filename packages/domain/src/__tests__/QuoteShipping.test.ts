import { describe, it, expect, vi } from 'vitest'
import { QuoteShipping } from '@/domain/use-cases/shipping/QuoteShipping'
import { FREE_SHIPPING_THRESHOLD_CENTS } from '@/domain/shared/constants'
import type { IProductRepository } from '@/domain/repositories/IProductRepository'
import type { IVendeloShippingPort } from '@/domain/repositories/IVendeloShippingPort'
import type { Product } from '@/domain/entities/Product'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'prod-1',
    name: 'Batería 12V',
    slug: 'bateria-12v',
    description: 'Batería estándar para motos',
    price: 5000000, // 50,000 COP en centavos
    stock: 10,
    sku: 'BAT-12V',
    images: [],
    isActive: true,
    weightKg: null,
    heightCm: null,
    widthCm: null,
    lengthCm: null,
    categoryId: 'cat-1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

const BASE_INPUT = {
  shippingCityCode: '11001000',
  shippingSubdivisionCode: '11',
  items: [{ productId: 'prod-1', quantity: 1 }],
  paymentMethod: 'EXTERNAL_PAYMENT' as const,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QuoteShipping', () => {
  it('retorna ok con el costo cotizado por Vendelo en el happy path', async () => {
    const product = makeProduct()
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const shippingPort = {
      quoteOrder: vi.fn().mockResolvedValue({ quotedShippingTotal: 900000, assumedShippingTotal: 0 }),
    } as unknown as IVendeloShippingPort

    const result = await new QuoteShipping(productRepo, shippingPort).execute(BASE_INPUT)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.quotedShippingTotal).toBe(900000)
      expect(result.value.freeShipping).toBe(false)
    }
    expect(shippingPort.quoteOrder).toHaveBeenCalledWith({
      shippingCityCode: '11001000',
      shippingSubdivisionCode: '11',
      items: [{ productId: 'prod-1', quantity: 1, weightKg: null, heightCm: null, widthCm: null, lengthCm: null }],
      paymentMethod: 'EXTERNAL_PAYMENT',
    })
  })

  it('pasa el peso/dimensiones reales del producto al shippingPort cuando existen', async () => {
    const product = makeProduct({ weightKg: 3.2, heightCm: 20, widthCm: 15, lengthCm: 30 })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const shippingPort = {
      quoteOrder: vi.fn().mockResolvedValue({ quotedShippingTotal: 900000, assumedShippingTotal: 0 }),
    } as unknown as IVendeloShippingPort

    await new QuoteShipping(productRepo, shippingPort).execute(BASE_INPUT)

    expect(shippingPort.quoteOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ productId: 'prod-1', quantity: 1, weightKg: 3.2, heightCm: 20, widthCm: 15, lengthCm: 30 }],
      }),
    )
  })

  it('retorna VALIDATION_ERROR si items está vacío', async () => {
    const productRepo = { findById: vi.fn() } as unknown as IProductRepository
    const shippingPort = { quoteOrder: vi.fn() } as unknown as IVendeloShippingPort

    const result = await new QuoteShipping(productRepo, shippingPort).execute({ ...BASE_INPUT, items: [] })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(shippingPort.quoteOrder).not.toHaveBeenCalled()
  })

  it('retorna VALIDATION_ERROR si alguna cantidad es <= 0', async () => {
    const productRepo = { findById: vi.fn() } as unknown as IProductRepository
    const shippingPort = { quoteOrder: vi.fn() } as unknown as IVendeloShippingPort

    const result = await new QuoteShipping(productRepo, shippingPort).execute({
      ...BASE_INPUT,
      items: [{ productId: 'prod-1', quantity: 0 }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('retorna NOT_FOUND si el producto no existe', async () => {
    const productRepo = { findById: vi.fn().mockResolvedValue(null) } as unknown as IProductRepository
    const shippingPort = { quoteOrder: vi.fn() } as unknown as IVendeloShippingPort

    const result = await new QuoteShipping(productRepo, shippingPort).execute(BASE_INPUT)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(shippingPort.quoteOrder).not.toHaveBeenCalled()
  })

  it('retorna VALIDATION_ERROR si el producto está inactivo', async () => {
    const productRepo = {
      findById: vi.fn().mockResolvedValue(makeProduct({ isActive: false })),
    } as unknown as IProductRepository
    const shippingPort = { quoteOrder: vi.fn() } as unknown as IVendeloShippingPort

    const result = await new QuoteShipping(productRepo, shippingPort).execute(BASE_INPUT)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('retorna INTERNAL_ERROR si Vendelo falla, sin lanzar excepción', async () => {
    const productRepo = {
      findById: vi.fn().mockResolvedValue(makeProduct()),
    } as unknown as IProductRepository
    const shippingPort = {
      quoteOrder: vi.fn().mockRejectedValue(new Error('Vendelo API 503: timeout')),
    } as unknown as IVendeloShippingPort

    const result = await new QuoteShipping(productRepo, shippingPort).execute(BASE_INPUT)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL_ERROR')
  })

  it('si el subtotal alcanza el umbral de envío gratis, no llama a Vendelo y retorna 0', async () => {
    const expensiveProduct = makeProduct({ price: FREE_SHIPPING_THRESHOLD_CENTS })
    const productRepo = {
      findById: vi.fn().mockResolvedValue(expensiveProduct),
    } as unknown as IProductRepository
    const shippingPort = { quoteOrder: vi.fn() } as unknown as IVendeloShippingPort

    const result = await new QuoteShipping(productRepo, shippingPort).execute(BASE_INPUT)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.quotedShippingTotal).toBe(0)
      expect(result.value.freeShipping).toBe(true)
    }
    expect(shippingPort.quoteOrder).not.toHaveBeenCalled()
  })

  it('suma el subtotal de múltiples ítems para decidir el envío gratis', async () => {
    const product = makeProduct({ price: 250_000_00 }) // $250.000
    const productRepo = {
      findById: vi.fn().mockResolvedValue(product),
    } as unknown as IProductRepository
    const shippingPort = {
      quoteOrder: vi.fn().mockResolvedValue({ quotedShippingTotal: 900000, assumedShippingTotal: 0 }),
    } as unknown as IVendeloShippingPort

    // 2 × $250.000 = $500.000 → alcanza el umbral
    const result = await new QuoteShipping(productRepo, shippingPort).execute({
      ...BASE_INPUT,
      items: [{ productId: 'prod-1', quantity: 2 }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.freeShipping).toBe(true)
    expect(shippingPort.quoteOrder).not.toHaveBeenCalled()
  })

  it('retiro en tienda: retorna $0 sin resolver productos ni llamar a Vendelo', async () => {
    const productRepo = { findById: vi.fn() } as unknown as IProductRepository
    const shippingPort = { quoteOrder: vi.fn() } as unknown as IVendeloShippingPort

    const result = await new QuoteShipping(productRepo, shippingPort).execute({
      ...BASE_INPUT,
      deliveryMethod: 'STORE_PICKUP',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.quotedShippingTotal).toBe(0)
      expect(result.value.freeShipping).toBe(true)
    }
    expect(productRepo.findById).not.toHaveBeenCalled()
    expect(shippingPort.quoteOrder).not.toHaveBeenCalled()
  })
})
