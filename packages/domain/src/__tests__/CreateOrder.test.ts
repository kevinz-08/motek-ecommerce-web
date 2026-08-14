import { describe, it, expect, vi } from 'vitest'
import { CreateOrder } from '@/domain/use-cases/orders/CreateOrder'
import { QuoteShipping } from '@/domain/use-cases/shipping/QuoteShipping'
import { ValidateCoupon } from '@/domain/use-cases/coupons/ValidateCoupon'
import { ok, err, AppError } from '@/domain/shared/Result'
import type { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import type { IProductRepository } from '@/domain/repositories/IProductRepository'
import type { IPaymentService } from '@/domain/services/IPaymentService'
import type { Product } from '@/domain/entities/Product'
import type { Order } from '@/domain/entities/Order'

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

function makeOrder(overrides?: Partial<Order>): Order {
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
    ...overrides,
  }
}

const SHIPPING = {
  fullName: 'Carlos Pérez',
  address: 'Calle 123 #45-67',
  city: 'Bogotá',
  department: 'Cundinamarca',
  phone: '3001234567',
  cityCode: '11001000',
  subdivisionCode: '11',
} as const

/** Mock mínimo de QuoteShipping — evita instanciar la clase real con sus dependencias. */
function makeQuoteShippingMock(result: Awaited<ReturnType<QuoteShipping['execute']>>) {
  return { execute: vi.fn().mockResolvedValue(result) } as unknown as QuoteShipping
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateOrder', () => {
  it('retorna ok con el total calculado correctamente en el happy path', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price * 2 })

    const productRepo = {
      findById: vi.fn().mockResolvedValue(product),
    } as unknown as IProductRepository

    const orderRepo = {
      create: vi.fn().mockResolvedValue(order),
    } as unknown as IOrderRepository

    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null,
        reference: 'ORDER-order-1-123',
        integritySignature: 'abc123',
        publicKey: 'pub-key',
        amountInCents: order.total,
        currency: 'COP',
      }),
    } as unknown as IPaymentService

    const result = await new CreateOrder(orderRepo, productRepo, paymentService).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.order.total).toBe(product.price * 2)
    }
  })

  it('llama a orderRepo.create con los ítems resueltos y el total correcto', async () => {
    const product = makeProduct({ price: 3000000 })
    const order = makeOrder({ total: product.price * 3 })

    const productRepo = {
      findById: vi.fn().mockResolvedValue(product),
    } as unknown as IProductRepository

    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository

    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({ externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk', amountInCents: order.total, currency: 'COP' }),
    } as unknown as IPaymentService

    await new CreateOrder(orderRepo, productRepo, paymentService).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 3 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      total: product.price * 3,
      items: [{ productId: 'prod-1', quantity: 3, priceAtPurchase: product.price }],
    }))
  })

  it('retorna err(STOCK_UNAVAILABLE) cuando la cantidad supera el stock disponible', async () => {
    const product = makeProduct({ stock: 2 })

    const productRepo = {
      findById: vi.fn().mockResolvedValue(product),
    } as unknown as IProductRepository

    const result = await new CreateOrder(
      {} as IOrderRepository,
      productRepo,
      {} as IPaymentService,
    ).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 5 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('STOCK_UNAVAILABLE')
  })

  it('retorna err(NOT_FOUND) cuando el producto no existe en el repositorio', async () => {
    const productRepo = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as IProductRepository

    const result = await new CreateOrder(
      {} as IOrderRepository,
      productRepo,
      {} as IPaymentService,
    ).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-inexistente', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('retorna err(VALIDATION_ERROR) cuando la cantidad del ítem es 0', async () => {
    const result = await new CreateOrder(
      {} as IOrderRepository,
      { findById: vi.fn() } as unknown as IProductRepository,
      {} as IPaymentService,
    ).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 0 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('COD: crea el pedido vía createPaidOrder y no llama a paymentService', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price * 2, paymentProvider: 'COD', status: 'PAID' })

    const productRepo = {
      findById: vi.fn().mockResolvedValue(product),
    } as unknown as IProductRepository

    const createPaidOrder = vi.fn().mockResolvedValue(order)
    const create = vi.fn()
    const orderRepo = { createPaidOrder, create } as unknown as IOrderRepository

    const createTransaction = vi.fn()
    const paymentService = { createTransaction } as unknown as IPaymentService

    const result = await new CreateOrder(orderRepo, productRepo, paymentService).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'COD',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.order.status).toBe('PAID')
      expect(result.value.payment).toBeNull()
    }
    expect(createPaidOrder).toHaveBeenCalledWith(expect.objectContaining({
      total: product.price * 2,
      paymentProvider: 'COD',
    }))
    expect(create).not.toHaveBeenCalled()
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it('retorna err(VALIDATION_ERROR) cuando el producto está inactivo', async () => {
    const product = makeProduct({ isActive: false })

    const productRepo = {
      findById: vi.fn().mockResolvedValue(product),
    } as unknown as IProductRepository

    const result = await new CreateOrder(
      {} as IOrderRepository,
      productRepo,
      {} as IPaymentService,
    ).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  // ── chargeShippingOnline: sumar el flete cotizado al cobro online ──────────

  it('chargeShippingOnline: suma el flete cotizado al total y lo persiste en shippingTotal', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price * 2 + 9000, shippingTotal: 9000 })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: order.total, currency: 'COP',
      }),
    } as unknown as IPaymentService
    const quoteShipping = makeQuoteShippingMock(ok({ quotedShippingTotal: 9000, freeShipping: false }))

    const result = await new CreateOrder(orderRepo, productRepo, paymentService, quoteShipping).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
      chargeShippingOnline: true,
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.shippingQuoteFallback).toBe(false)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      total: product.price * 2 + 9000,
      shippingTotal: 9000,
    }))
  })

  it('chargeShippingOnline: freeShipping deja shippingTotal en 0', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: order.total, currency: 'COP',
      }),
    } as unknown as IPaymentService
    const quoteShipping = makeQuoteShippingMock(ok({ quotedShippingTotal: 0, freeShipping: true }))

    await new CreateOrder(orderRepo, productRepo, paymentService, quoteShipping).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
      chargeShippingOnline: true,
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ shippingTotal: 0, total: product.price }))
  })

  it('chargeShippingOnline: si QuoteShipping falla, degrada a shippingTotal 0 y marca shippingQuoteFallback', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: order.total, currency: 'COP',
      }),
    } as unknown as IPaymentService
    const quoteShipping = makeQuoteShippingMock(err(new AppError('INTERNAL_ERROR', 'Vendelo caído')))

    const result = await new CreateOrder(orderRepo, productRepo, paymentService, quoteShipping).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
      chargeShippingOnline: true,
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.shippingQuoteFallback).toBe(true)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ shippingTotal: 0 }))
  })

  it('chargeShippingOnline: sin cityCode/subdivisionCode degrada a shippingTotal 0 sin llamar a QuoteShipping', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: order.total, currency: 'COP',
      }),
    } as unknown as IPaymentService
    const quoteShipping = makeQuoteShippingMock(ok({ quotedShippingTotal: 9000, freeShipping: false }))
    const incompleteAddress = { ...SHIPPING, cityCode: undefined, subdivisionCode: undefined }

    const result = await new CreateOrder(orderRepo, productRepo, paymentService, quoteShipping).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: incompleteAddress,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
      chargeShippingOnline: true,
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.shippingQuoteFallback).toBe(true)
    expect(quoteShipping.execute).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ shippingTotal: 0 }))
  })

  it('chargeShippingOnline: sin quoteShipping inyectado (constructor de 3 args) degrada sin lanzar', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: order.total, currency: 'COP',
      }),
    } as unknown as IPaymentService

    // Sin 4º argumento — mismo patrón que el resto de los tests de este archivo.
    const result = await new CreateOrder(orderRepo, productRepo, paymentService).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
      chargeShippingOnline: true,
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.shippingQuoteFallback).toBe(true)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ shippingTotal: 0 }))
  })

  it('chargeShippingOnline: el tope maxShippingChargeCents recorta el monto cotizado', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price + 5000, shippingTotal: 5000 })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: order.total, currency: 'COP',
      }),
    } as unknown as IPaymentService
    const quoteShipping = makeQuoteShippingMock(ok({ quotedShippingTotal: 50000, freeShipping: false }))

    await new CreateOrder(orderRepo, productRepo, paymentService, quoteShipping).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
      chargeShippingOnline: true,
      maxShippingChargeCents: 5000,
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      shippingTotal: 5000,
      total: product.price + 5000,
    }))
  })

  it('paymentProvider COD con chargeShippingOnline:true igual deja shippingTotal en 0 (guard explícito)', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price, paymentProvider: 'COD', status: 'PAID' })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const createPaidOrder = vi.fn().mockResolvedValue(order)
    const orderRepo = { createPaidOrder } as unknown as IOrderRepository
    const quoteShipping = makeQuoteShippingMock(ok({ quotedShippingTotal: 9000, freeShipping: false }))

    await new CreateOrder(orderRepo, productRepo, {} as IPaymentService, quoteShipping).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'COD',
      chargeShippingOnline: true,
    })

    expect(quoteShipping.execute).not.toHaveBeenCalled()
    expect(createPaidOrder).toHaveBeenCalledWith(expect.objectContaining({ shippingTotal: 0 }))
  })

  it('STORE_PICKUP: deja shippingTotal en 0 y no llama a QuoteShipping aunque chargeShippingOnline sea true', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price, deliveryMethod: 'STORE_PICKUP' })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: order.total, currency: 'COP',
      }),
    } as unknown as IPaymentService
    const quoteShipping = makeQuoteShippingMock(ok({ quotedShippingTotal: 9000, freeShipping: false }))

    const result = await new CreateOrder(orderRepo, productRepo, paymentService, quoteShipping).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
      deliveryMethod: 'STORE_PICKUP',
      chargeShippingOnline: true,
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.shippingQuoteFallback).toBe(false)
    expect(quoteShipping.execute).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      deliveryMethod: 'STORE_PICKUP',
      shippingTotal: 0,
      total: product.price,
    }))
  })

  it('sin deliveryMethod (undefined) persiste HOME_DELIVERY por default', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: order.total, currency: 'COP',
      }),
    } as unknown as IPaymentService

    await new CreateOrder(orderRepo, productRepo, paymentService).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ deliveryMethod: 'HOME_DELIVERY' }))
  })

  // ── Integración con ValidateCoupon ────────────────────────────────────────

  function makeValidateCouponMock(discount: number, eligibleProductIds: string[]) {
    return {
      execute: vi.fn().mockResolvedValue(ok({ discount, eligibleProductIds })),
    } as unknown as ValidateCoupon
  }

  it('aplica el descuento del cupón al total del pedido', async () => {
    const product = makeProduct({ price: 10000000, categoryId: 'cat-1' })
    const expectedTotal = product.price - 2000000 // 20% de 10.000.000
    const order = makeOrder({ total: expectedTotal })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: expectedTotal, currency: 'COP',
      }),
    } as unknown as IPaymentService
    const validateCoupon = makeValidateCouponMock(2000000, ['prod-1'])

    await new CreateOrder(orderRepo, productRepo, paymentService, undefined, validateCoupon).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
      couponCode: 'HALLOWEEN20',
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      total: expectedTotal,
      couponCode: 'HALLOWEEN20',
      discountAmount: 2000000,
    }))
  })

  it('el total nunca es negativo aunque el descuento supere el subtotal', async () => {
    const product = makeProduct({ price: 1000000, categoryId: 'cat-1' })
    const order = makeOrder({ total: 0 })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: 0, currency: 'COP',
      }),
    } as unknown as IPaymentService
    // Descuento más grande que el precio del producto
    const validateCoupon = makeValidateCouponMock(9999999, ['prod-1'])

    await new CreateOrder(orderRepo, productRepo, paymentService, undefined, validateCoupon).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
      couponCode: 'MEGADEAL',
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ total: 0 }))
  })

  it('si ValidateCoupon falla, el pedido se rechaza con el error del cupón', async () => {
    const product = makeProduct()
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const validateCoupon = {
      execute: vi.fn().mockResolvedValue(err(new AppError('VALIDATION_ERROR', 'Cupón vencido'))),
    } as unknown as ValidateCoupon

    const result = await new CreateOrder(
      {} as IOrderRepository,
      productRepo,
      {} as IPaymentService,
      undefined,
      validateCoupon,
    ).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
      couponCode: 'EXPIRED',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('sin couponCode el pedido avanza normalmente sin llamar a ValidateCoupon', async () => {
    const product = makeProduct()
    const order = makeOrder({ total: product.price })
    const productRepo = { findById: vi.fn().mockResolvedValue(product) } as unknown as IProductRepository
    const create = vi.fn().mockResolvedValue(order)
    const orderRepo = { create } as unknown as IOrderRepository
    const paymentService = {
      createTransaction: vi.fn().mockResolvedValue({
        externalId: null, reference: 'ref', integritySignature: 'sig', publicKey: 'pk',
        amountInCents: order.total, currency: 'COP',
      }),
    } as unknown as IPaymentService
    const validateCoupon = { execute: vi.fn() } as unknown as ValidateCoupon

    await new CreateOrder(orderRepo, productRepo, paymentService, undefined, validateCoupon).execute({
      userId: 'user-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddress: SHIPPING,
      buyer: { idType: 'CC', idNumber: '1000123456' },
      paymentProvider: 'WOMPI',
    })

    expect(validateCoupon.execute).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ discountAmount: 0 }))
  })
})
