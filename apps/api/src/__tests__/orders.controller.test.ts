import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ForbiddenException } from '@nestjs/common'

// vi.mock se alza (hoist) antes de los imports — @motek/database ya estará mockeado
// cuando PrismaService intente importarlo.
vi.mock('@motek/database', () => ({
  prisma: { client: { $connect: vi.fn(), $disconnect: vi.fn() } },
  PrismaClient: vi.fn(),
}))

vi.mock('@motek/domain', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    // Las interfaces TypeScript no existen en runtime; placeholder para vitest
    IOrderRepository: undefined,
    IProductRepository: undefined,
    IPaymentService: undefined,
    IVendeloShippingPort: undefined,
    ICouponRepository: undefined,
    OrderStatus: undefined,
    // Usar function() (no arrow) para que sea compatible con `new CreateOrder(...)`
    CreateOrder: vi.fn().mockImplementation(function () {
      return {
        execute: vi.fn().mockResolvedValue({
          ok: true,
          value: { order: mockOrder, payment: mockPayment, shippingQuoteFallback: false },
        }),
      }
    }),
    ValidateCoupon: vi.fn().mockImplementation(function () {
      return { execute: vi.fn() }
    }),
  }
})

import { OrdersController } from '../orders/orders.controller'
import { WompiService } from '../infrastructure/services/WompiService'
import { MercadoPagoService } from '../infrastructure/services/MercadoPagoService'
import { ResendEmailService } from '../infrastructure/services/ResendEmailService'
import { PrismaService } from '../infrastructure/database/prisma.service'
import { EmailQueueService } from '../infrastructure/services/EmailQueueService'
import { VendeloOrderQueueService } from '../infrastructure/services/VendeloOrderQueueService'
import {
  ORDER_REPOSITORY,
  PRODUCT_REPOSITORY,
  PAYMENT_SERVICE,
  VENDELO_SHIPPING_PORT,
  COUPON_REPOSITORY,
} from '../infrastructure/injection-tokens'
import type { JwtUser } from '../auth/decorators/current-user.decorator'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockOrder = {
  id: 'order-abc123',
  userId: 'user-1',
  total: 5000000,
  status: 'PENDING',
  items: [],
  shippingAddress: {
    fullName: 'Test User',
    address: 'Calle 1',
    city: 'Bogotá',
    department: 'Cundinamarca',
    phone: '3001234567',
  },
}

const mockPayment = {
  publicKey: 'pub_test',
  integritySignature: 'sig-abc',
  reference: 'ORDER-abc123-1000',
  amountInCents: 5000000,
  currency: 'COP',
}

const mockOrderRepo = {
  save: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  updateStatus: vi.fn().mockResolvedValue(undefined),
  transitionFromPending: vi.fn(),
  decrementStock: vi.fn(),
  count: vi.fn(),
}
const mockProductRepo = { findById: vi.fn(), save: vi.fn(), findAll: vi.fn() }
const mockWompiService = { initiate: vi.fn(), validateWebhook: vi.fn() }
const mockEmailService = {
  sendOrderReceived: vi.fn().mockResolvedValue(undefined),
}
const mockPrismaClient = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  settings: { findUnique: vi.fn().mockResolvedValue({ value: 'false' }) },
}
const mockMercadoPagoService = { initiate: vi.fn() }
const mockEmailQueue = { enqueue: vi.fn().mockResolvedValue(undefined) }
const mockVendeloOrderQueue = { enqueue: vi.fn().mockResolvedValue(undefined) }
const mockShippingPort = { quoteOrder: vi.fn(), createShipments: vi.fn() }
const mockCouponRepo = { findByCode: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }

const mockUser: JwtUser = { id: 'user-1', email: 'user@test.com', role: 'CUSTOMER' }

// ── Setup ─────────────────────────────────────────────────────────────────────

async function buildController() {
  const module = await Test.createTestingModule({
    controllers: [OrdersController],
    providers: [
      { provide: ORDER_REPOSITORY, useValue: mockOrderRepo },
      { provide: PRODUCT_REPOSITORY, useValue: mockProductRepo },
      { provide: PAYMENT_SERVICE, useValue: mockWompiService },
      { provide: VENDELO_SHIPPING_PORT, useValue: mockShippingPort },
      { provide: COUPON_REPOSITORY, useValue: mockCouponRepo },
      { provide: WompiService, useValue: mockWompiService },
      { provide: MercadoPagoService, useValue: mockMercadoPagoService },
      { provide: ResendEmailService, useValue: mockEmailService },
      { provide: PrismaService, useValue: { client: mockPrismaClient } },
      { provide: EmailQueueService, useValue: mockEmailQueue },
      { provide: VendeloOrderQueueService, useValue: mockVendeloOrderQueue },
    ],
  }).compile()

  return module.get(OrdersController)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('OrdersController', () => {
  let controller: OrdersController

  beforeEach(async () => {
    vi.clearAllMocks()
    mockPrismaClient.settings.findUnique.mockResolvedValue({ value: 'false' })
    controller = await buildController()
  })

  describe('POST /orders — create()', () => {
    const dto = {
      items: [{ productId: 'prod-1', quantity: 2 }],
      shippingAddress: {
        fullName: 'Test User',
        address: 'Calle 1',
        city: 'Bogotá',
        department: 'Cundinamarca',
        phone: '3001234567',
      },
      buyer: { idType: 'CC' as const, idNumber: '1000123456' },
      paymentProvider: 'WOMPI' as const,
    }

    it('devuelve el pedido y los parámetros de pago cuando el use case tiene éxito', async () => {
      const result = await controller.create(dto, mockUser)
      expect(result).toEqual({ order: mockOrder, payment: mockPayment, shippingQuoteFallback: false })
    })

    it('lanza el error del dominio cuando el use case falla', async () => {
      const { CreateOrder } = await import('@motek/domain')
      vi.mocked(CreateOrder).mockImplementationOnce(function () {
        return {
          execute: vi.fn().mockResolvedValue({
            ok: false,
            error: Object.assign(new Error('Sin stock'), { code: 'STOCK_UNAVAILABLE' }),
          }),
        }
      })

      await expect(controller.create(dto, mockUser)).rejects.toThrow()
    })

    it('lanza ForbiddenException si se pide MERCADO_PAGO y está deshabilitado', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValueOnce({ value: 'false' })

      await expect(
        controller.create({ ...dto, paymentProvider: 'MERCADO_PAGO' }, mockUser),
      ).rejects.toThrow(ForbiddenException)
    })

    it('COD: encola email y Vendelo inmediatamente en vez de sendOrderReceived', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValueOnce({ value: 'true' })
      const { CreateOrder } = await import('@motek/domain')
      vi.mocked(CreateOrder).mockImplementationOnce(function () {
        return {
          execute: vi.fn().mockResolvedValue({
            ok: true,
            value: { order: { ...mockOrder, status: 'PAID' }, payment: null, shippingQuoteFallback: false },
          }),
        }
      })

      await controller.create({ ...dto, paymentProvider: 'COD' }, mockUser)

      expect(mockEmailQueue.enqueue).toHaveBeenCalledWith(mockUser.email, mockOrder.id)
      expect(mockVendeloOrderQueue.enqueue).toHaveBeenCalledWith(mockOrder.id)
      expect(mockEmailService.sendOrderReceived).not.toHaveBeenCalled()
    })

    it('COD + STORE_PICKUP: encola email pero NUNCA encola Vendelo', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValueOnce({ value: 'true' })
      const { CreateOrder } = await import('@motek/domain')
      vi.mocked(CreateOrder).mockImplementationOnce(function () {
        return {
          execute: vi.fn().mockResolvedValue({
            ok: true,
            value: {
              order: { ...mockOrder, status: 'PAID', deliveryMethod: 'STORE_PICKUP' },
              payment: null,
              shippingQuoteFallback: false,
            },
          }),
        }
      })

      await controller.create({ ...dto, paymentProvider: 'COD', deliveryMethod: 'STORE_PICKUP' }, mockUser)

      expect(mockEmailQueue.enqueue).toHaveBeenCalledWith(mockUser.email, mockOrder.id)
      expect(mockVendeloOrderQueue.enqueue).not.toHaveBeenCalled()
    })

    it('pasa deliveryMethod al use case CreateOrder', async () => {
      const { CreateOrder } = await import('@motek/domain')
      const execute = vi.fn().mockResolvedValue({ ok: true, value: { order: mockOrder, payment: mockPayment, shippingQuoteFallback: false } })
      vi.mocked(CreateOrder).mockImplementationOnce(function () {
        return { execute }
      })

      await controller.create({ ...dto, deliveryMethod: 'STORE_PICKUP' }, mockUser)

      expect(execute).toHaveBeenCalledWith(expect.objectContaining({ deliveryMethod: 'STORE_PICKUP' }))
    })

    it('lanza ForbiddenException si se pide COD y el admin lo desactivó', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValueOnce({ value: 'false' })

      await expect(
        controller.create({ ...dto, paymentProvider: 'COD' }, mockUser),
      ).rejects.toThrow(ForbiddenException)
    })

    it('permite COD cuando no existe fila en Settings (habilitado por defecto)', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValueOnce(null)

      await expect(
        controller.create({ ...dto, paymentProvider: 'COD' }, mockUser),
      ).resolves.toBeDefined()
    })

    // chargeShippingOnline lo calcula orders.controller.ts a partir de un único
    // setting (SHIPPING_ONLINE_ENABLED) — default FALSE si no existe la fila
    // (no empezar a cobrar flete extra sin opt-in explícito del admin).

    it('chargeShippingOnline: true cuando SHIPPING_ONLINE_ENABLED está habilitado', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValueOnce({ value: 'true' })
      const { CreateOrder } = await import('@motek/domain')
      const execute = vi.fn().mockResolvedValue({ ok: true, value: { order: mockOrder, payment: mockPayment, shippingQuoteFallback: false } })
      vi.mocked(CreateOrder).mockImplementationOnce(function () {
        return { execute }
      })

      await controller.create(dto, mockUser)

      expect(execute).toHaveBeenCalledWith(expect.objectContaining({ chargeShippingOnline: true }))
    })

    it('chargeShippingOnline: false cuando no existe la fila (default seguro)', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValueOnce(null)
      const { CreateOrder } = await import('@motek/domain')
      const execute = vi.fn().mockResolvedValue({ ok: true, value: { order: mockOrder, payment: mockPayment, shippingQuoteFallback: false } })
      vi.mocked(CreateOrder).mockImplementationOnce(function () {
        return { execute }
      })

      await controller.create(dto, mockUser)

      expect(execute).toHaveBeenCalledWith(expect.objectContaining({ chargeShippingOnline: false }))
    })

    it('chargeShippingOnline: false cuando SHIPPING_ONLINE_ENABLED está explícitamente deshabilitado', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValueOnce({ value: 'false' })
      const { CreateOrder } = await import('@motek/domain')
      const execute = vi.fn().mockResolvedValue({ ok: true, value: { order: mockOrder, payment: mockPayment, shippingQuoteFallback: false } })
      vi.mocked(CreateOrder).mockImplementationOnce(function () {
        return { execute }
      })

      await controller.create(dto, mockUser)

      expect(execute).toHaveBeenCalledWith(expect.objectContaining({ chargeShippingOnline: false }))
    })

    it('COD nunca lee SHIPPING_ONLINE_ENABLED — solo COD_ENABLED', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValueOnce({ value: 'true' }) // COD_ENABLED
      const { CreateOrder } = await import('@motek/domain')
      const execute = vi.fn().mockResolvedValue({ ok: true, value: { order: { ...mockOrder, status: 'PAID' }, payment: null, shippingQuoteFallback: false } })
      vi.mocked(CreateOrder).mockImplementationOnce(function () {
        return { execute }
      })

      await controller.create({ ...dto, paymentProvider: 'COD' }, mockUser)

      expect(mockPrismaClient.settings.findUnique).toHaveBeenCalledTimes(1)
      expect(mockPrismaClient.settings.findUnique).toHaveBeenCalledWith({ where: { key: 'COD_ENABLED' } })
    })

    it('shippingQuoteFallback:true dispara un warning en el logger', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValueOnce({ value: 'true' })
      const { CreateOrder } = await import('@motek/domain')
      const execute = vi.fn().mockResolvedValue({ ok: true, value: { order: mockOrder, payment: mockPayment, shippingQuoteFallback: true } })
      vi.mocked(CreateOrder).mockImplementationOnce(function () {
        return { execute }
      })
      const warnSpy = vi.spyOn(controller['logger'], 'warn')

      await controller.create(dto, mockUser)

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(mockOrder.id))
    })
  })

  describe('PATCH /orders/:id/status — updateStatus()', () => {
    it('actualiza el estado y retorna { success: true }', async () => {
      const result = await controller.updateStatus('order-abc123', { status: 'SHIPPED' })

      expect(mockOrderRepo.updateStatus).toHaveBeenCalledWith('order-abc123', 'SHIPPED')
      expect(result).toEqual({ success: true, status: 'SHIPPED' })
    })
  })
})
