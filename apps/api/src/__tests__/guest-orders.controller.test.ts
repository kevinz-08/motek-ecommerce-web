import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common'

vi.mock('@motek/database', () => ({
  prisma: { client: { $connect: vi.fn(), $disconnect: vi.fn() } },
  PrismaClient: vi.fn(),
}))

// `CreateOrder` se mockea para aislar el controlador: las reglas del use case
// (COD sin cuenta, cupones restringidos) ya tienen su propia suite en
// packages/domain. Acá se prueba lo que el controlador aporta encima: kill-switch,
// captcha, tope por email y la forma de las respuestas públicas.
vi.mock('@motek/domain', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    IOrderRepository: undefined,
    IProductRepository: undefined,
    IPaymentService: undefined,
    IVendeloShippingPort: undefined,
    ICouponRepository: undefined,
    IShipmentRepository: undefined,
    CreateOrder: vi.fn().mockImplementation(function () {
      return {
        execute: vi.fn().mockResolvedValue({
          ok: true,
          value: { order: mockGuestOrder, payment: mockPayment, shippingQuoteFallback: false },
        }),
      }
    }),
    ValidateCoupon: vi.fn().mockImplementation(function () {
      return { execute: vi.fn() }
    }),
    QuoteShipping: vi.fn().mockImplementation(function () {
      return { execute: vi.fn() }
    }),
  }
})

import { GuestOrdersController } from '../orders/guest-orders.controller'
import { MercadoPagoService } from '../infrastructure/services/MercadoPagoService'
import { ResendEmailService } from '../infrastructure/services/ResendEmailService'
import { TurnstileService } from '../infrastructure/services/TurnstileService'
import { PrismaService } from '../infrastructure/database/prisma.service'
import {
  ORDER_REPOSITORY,
  PRODUCT_REPOSITORY,
  PAYMENT_SERVICE,
  VENDELO_SHIPPING_PORT,
  COUPON_REPOSITORY,
  SHIPMENT_REPOSITORY,
} from '../infrastructure/injection-tokens'
import type { CreateGuestOrderDto } from '../orders/dto/create-guest-order.dto'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TRACKING_TOKEN = 'tok-de-256-bits-simulado'

const mockGuestOrder = {
  id: 'order-guest-1',
  userId: null,
  guestId: 'guest-1',
  contactEmail: 'invitado@motek.test',
  trackingToken: TRACKING_TOKEN,
  total: 5000000,
  shippingTotal: 0,
  status: 'PENDING',
  paymentProvider: 'WOMPI',
  deliveryMethod: 'HOME_DELIVERY',
  createdAt: new Date('2026-09-01'),
  items: [
    {
      id: 'item-1',
      orderId: 'order-guest-1',
      productId: 'prod-1',
      quantity: 2,
      priceAtPurchase: 2500000,
      productSnapshot: { sku: 'BAT-12V', name: 'Batería 12V' },
    },
  ],
  shippingAddress: {
    fullName: 'Carlos Pérez',
    address: 'Calle 1',
    city: 'Bogotá',
    department: 'Cundinamarca',
    phone: '3001234567',
  },
}

const mockPayment = {
  publicKey: 'pub_test',
  integritySignature: 'sig-abc',
  reference: 'ORDER-guest-1-1000',
  amountInCents: 5000000,
  currency: 'COP',
}

const validDto = {
  items: [{ productId: 'prod-1', quantity: 2 }],
  shippingAddress: {
    fullName: 'Carlos Pérez',
    address: 'Calle 1',
    city: 'Bogotá',
    phone: '3001234567',
  },
  buyer: { idType: 'CC', idNumber: '1000123456' },
  paymentProvider: 'WOMPI',
  contactEmail: 'invitado@motek.test',
  guestName: 'Carlos Pérez',
  acceptsPolicies: true,
  captchaToken: 'captcha-ok',
} as unknown as CreateGuestOrderDto

// ── Mocks de dependencias ─────────────────────────────────────────────────────

const mockOrderRepo = {
  countPendingByEmailSince: vi.fn().mockResolvedValue(0),
  findByTrackingToken: vi.fn().mockResolvedValue(mockGuestOrder),
  findUnclaimedByEmail: vi.fn().mockResolvedValue([]),
}
const mockShipmentRepo = { findByOrderId: vi.fn().mockResolvedValue(null) }
const mockProductRepo = { findById: vi.fn() }
const mockWompiService = { createTransaction: vi.fn() }
const mockMercadoPagoService = { createTransaction: vi.fn() }
const mockShippingPort = { quoteOrder: vi.fn() }
const mockCouponRepo = { findByCode: vi.fn() }
const mockEmailService = {
  sendOrderReceived: vi.fn().mockResolvedValue(undefined),
  sendGuestTrackingLinks: vi.fn().mockResolvedValue(undefined),
}
const mockTurnstile = { verify: vi.fn().mockResolvedValue({ ok: true }) }
const mockPrismaClient = {
  settings: { findUnique: vi.fn() },
  order: { update: vi.fn().mockResolvedValue(undefined) },
}

/** Por defecto: guest checkout ON, Mercado Pago OFF, flete online OFF. */
function stubSettings(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    GUEST_CHECKOUT_ENABLED: 'true',
    MERCADOPAGO_ENABLED: 'false',
    SHIPPING_ONLINE_ENABLED: 'false',
    ...overrides,
  }
  mockPrismaClient.settings.findUnique.mockImplementation(
    ({ where }: { where: { key: string } }) =>
      Promise.resolve(values[where.key] !== undefined ? { value: values[where.key] } : null),
  )
}

async function buildController() {
  const module = await Test.createTestingModule({
    controllers: [GuestOrdersController],
    providers: [
      { provide: ORDER_REPOSITORY, useValue: mockOrderRepo },
      { provide: PRODUCT_REPOSITORY, useValue: mockProductRepo },
      { provide: PAYMENT_SERVICE, useValue: mockWompiService },
      { provide: VENDELO_SHIPPING_PORT, useValue: mockShippingPort },
      { provide: COUPON_REPOSITORY, useValue: mockCouponRepo },
      { provide: SHIPMENT_REPOSITORY, useValue: mockShipmentRepo },
      { provide: MercadoPagoService, useValue: mockMercadoPagoService },
      { provide: ResendEmailService, useValue: mockEmailService },
      { provide: TurnstileService, useValue: mockTurnstile },
      { provide: PrismaService, useValue: { client: mockPrismaClient } },
    ],
  }).compile()

  return module.get(GuestOrdersController)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GuestOrdersController', () => {
  let controller: GuestOrdersController

  beforeEach(async () => {
    vi.clearAllMocks()
    mockOrderRepo.countPendingByEmailSince.mockResolvedValue(0)
    mockOrderRepo.findByTrackingToken.mockResolvedValue(mockGuestOrder)
    mockOrderRepo.findUnclaimedByEmail.mockResolvedValue([])
    mockShipmentRepo.findByOrderId.mockResolvedValue(null)
    mockTurnstile.verify.mockResolvedValue({ ok: true })
    mockEmailService.sendOrderReceived.mockResolvedValue(undefined)
    mockEmailService.sendGuestTrackingLinks.mockResolvedValue(undefined)
    stubSettings()
    controller = await buildController()
  })

  describe('POST /orders/guest', () => {
    it('crea el pedido y devuelve el token de seguimiento', async () => {
      const res = await controller.createGuestOrder(validDto, '1.2.3.4')

      expect(res.trackingToken).toBe(TRACKING_TOKEN)
      expect(res.trackingUrl).toContain('/pedidos/seguimiento?token=')
      expect(mockEmailService.sendOrderReceived).toHaveBeenCalledWith(
        mockGuestOrder,
        'invitado@motek.test',
      )
    })

    it('no repite el token dentro del objeto `order` de la respuesta', async () => {
      // El token viaja en su propio campo. Dejarlo también dentro de `order`
      // multiplica los caminos por los que puede acabar en un log o en otra vista.
      const res = await controller.createGuestOrder(validDto, '1.2.3.4')
      expect('trackingToken' in res.order).toBe(false)
    })

    it('sella policiesAcceptedAt del lado del servidor', async () => {
      // Una marca de tiempo elegida por el navegador no sirve como evidencia
      // ante una auditoría: la pone el servidor a partir de `acceptsPolicies`.
      await controller.createGuestOrder(validDto, '1.2.3.4')

      expect(mockPrismaClient.order.update).toHaveBeenCalledWith({
        where: { id: 'order-guest-1' },
        data: { policiesAcceptedAt: expect.any(Date) },
      })
    })

    it('rechaza con 403 cuando el kill-switch de admin está apagado', async () => {
      stubSettings({ GUEST_CHECKOUT_ENABLED: 'false' })
      await expect(controller.createGuestOrder(validDto, '1.2.3.4')).rejects.toThrow(ForbiddenException)
    })

    it('rechaza cuando no existe la fila del kill-switch (default cerrado)', async () => {
      mockPrismaClient.settings.findUnique.mockResolvedValue(null)
      await expect(controller.createGuestOrder(validDto, '1.2.3.4')).rejects.toThrow(ForbiddenException)
    })

    it('rechaza con 403 si el captcha es inválido', async () => {
      mockTurnstile.verify.mockResolvedValue({ ok: false, reason: 'invalid' })
      await expect(controller.createGuestOrder(validDto, '1.2.3.4')).rejects.toThrow(ForbiddenException)
      expect(mockPrismaClient.order.update).not.toHaveBeenCalled()
    })

    it('responde 503 —no 403— si el captcha no se pudo verificar por nuestra culpa', async () => {
      // Fail-closed igual, pero el código dice de quién es el problema: un 403
      // le diría al comprador que él hizo algo mal.
      mockTurnstile.verify.mockResolvedValue({ ok: false, reason: 'unavailable' })
      await expect(controller.createGuestOrder(validDto, '1.2.3.4')).rejects.toThrow(ServiceUnavailableException)
    })

    it('responde 503 si Turnstile no está configurado', async () => {
      mockTurnstile.verify.mockResolvedValue({ ok: false, reason: 'not_configured' })
      await expect(controller.createGuestOrder(validDto, '1.2.3.4')).rejects.toThrow(ServiceUnavailableException)
    })

    it('corta cuando el email acumula demasiados pedidos PENDING', async () => {
      // Freno anti card-testing distribuido: el throttler por IP no ve un ataque
      // repartido entre muchas IPs, el email de contacto sí.
      mockOrderRepo.countPendingByEmailSince.mockResolvedValue(5)
      await expect(controller.createGuestOrder(validDto, '1.2.3.4')).rejects.toThrow(ForbiddenException)
    })

    it('rechaza Mercado Pago si el admin lo tiene deshabilitado', async () => {
      const dto = { ...validDto, paymentProvider: 'MERCADO_PAGO' } as CreateGuestOrderDto
      await expect(controller.createGuestOrder(dto, '1.2.3.4')).rejects.toThrow(ForbiddenException)
    })

    it('pasa la IP del cliente a Turnstile como señal adicional', async () => {
      await controller.createGuestOrder(validDto, '9.9.9.9')
      expect(mockTurnstile.verify).toHaveBeenCalledWith('captcha-ok', '9.9.9.9')
    })
  })

  describe('GET /orders/track/:token', () => {
    it('devuelve una proyección pública sin el token ni el email completo', async () => {
      const view = await controller.track(TRACKING_TOKEN)

      expect(view.id).toBe('order-guest-1')
      expect(view.isGuest).toBe(true)
      expect(view.contactEmailMasked).toBe('in******@motek.test')
      expect(JSON.stringify(view)).not.toContain(TRACKING_TOKEN)
      expect(view.items[0]).toMatchObject({ name: 'Batería 12V', sku: 'BAT-12V', quantity: 2 })
    })

    it('incluye el envío cuando Vendelo ya reportó estado', async () => {
      mockShipmentRepo.findByOrderId.mockResolvedValue({
        status: 'SHIPPED', trackingNumber: 'ABC123', carrier: 'COORDINADORA',
      })
      const view = await controller.track(TRACKING_TOKEN)
      expect(view.shipment).toEqual({ status: 'SHIPPED', trackingNumber: 'ABC123', carrier: 'COORDINADORA' })
    })

    it('responde 404 genérico ante un token que no resuelve', async () => {
      // Mismo error que un pedido inexistente: distinguirlos sería un oráculo.
      mockOrderRepo.findByTrackingToken.mockResolvedValue(null)
      await expect(controller.track('token-que-no-existe')).rejects.toThrow(NotFoundException)
    })
  })

  describe('POST /orders/track/request-link', () => {
    const dto = { email: 'invitado@motek.test', captchaToken: 'captcha-ok' }

    it('envía los enlaces cuando hay pedidos', async () => {
      mockOrderRepo.findUnclaimedByEmail.mockResolvedValue([mockGuestOrder])
      await controller.requestTrackingLink(dto, '1.2.3.4')

      expect(mockEmailService.sendGuestTrackingLinks).toHaveBeenCalledWith(
        'invitado@motek.test',
        [expect.objectContaining({ id: 'order-guest-1', trackingToken: TRACKING_TOKEN })],
      )
    })

    it('responde exactamente igual cuando el email no tiene pedidos', async () => {
      // Si la respuesta cambiara, el endpoint permitiría enumerar quién compró
      // en la tienda probando correos.
      mockOrderRepo.findUnclaimedByEmail.mockResolvedValue([mockGuestOrder])
      const conPedidos = await controller.requestTrackingLink(dto, '1.2.3.4')

      mockOrderRepo.findUnclaimedByEmail.mockResolvedValue([])
      const sinPedidos = await controller.requestTrackingLink(dto, '1.2.3.4')

      expect(sinPedidos).toEqual(conPedidos)
      expect(mockEmailService.sendGuestTrackingLinks).toHaveBeenCalledTimes(1)
    })

    it('responde igual aunque el captcha falle, y no consulta ni envía nada', async () => {
      mockTurnstile.verify.mockResolvedValue({ ok: false, reason: 'invalid' })
      const res = await controller.requestTrackingLink(dto, '1.2.3.4')

      expect(res.message).toContain('Si hay pedidos asociados')
      expect(mockOrderRepo.findUnclaimedByEmail).not.toHaveBeenCalled()
      expect(mockEmailService.sendGuestTrackingLinks).not.toHaveBeenCalled()
    })
  })
})
