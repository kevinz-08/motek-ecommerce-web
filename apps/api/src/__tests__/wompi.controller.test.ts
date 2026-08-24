import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock se alza (hoist) antes de los imports — @motek/database ya estará mockeado
// cuando PrismaService intente importarlo.
vi.mock('@motek/database', () => ({
  prisma: { client: {} },
  PrismaClient: vi.fn(),
}))

vi.mock('@motek/domain', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    // Las interfaces TypeScript no existen en runtime; placeholder para vitest
    IOrderRepository: undefined,
    PaymentStatus: undefined,
    // Usar function() (no arrow) para que sea compatible con `new ConfirmPayment(...)`
    ConfirmPayment: vi.fn().mockImplementation(function () {
      return {
        execute: vi.fn().mockResolvedValue({
          ok: true,
          value: { stateChanged: true },
        }),
      }
    }),
  }
})

import { Test } from '@nestjs/testing'
import { UnauthorizedException } from '@nestjs/common'
import { WompiController } from '../payments/wompi.controller'
import { WompiService } from '../infrastructure/services/WompiService'
import { ResendEmailService } from '../infrastructure/services/ResendEmailService'
import { EmailQueueService } from '../infrastructure/services/EmailQueueService'
import { VendeloOrderQueueService } from '../infrastructure/services/VendeloOrderQueueService'
import { PrismaService } from '../infrastructure/database/prisma.service'
import { ORDER_REPOSITORY } from '../infrastructure/injection-tokens'

// ── Stubs de dependencias ──────────────────────────────────────────────────────

const mockOrderRepo = {
  findById: vi.fn().mockResolvedValue({
    id: 'order-1',
    userId: 'user-1',
    total: 5000000,
    status: 'PENDING',
    items: [],
  }),
  updateStatus: vi.fn(),
  transitionFromPending: vi.fn(),
}

const mockWompiService = {
  validateWebhook: vi.fn().mockReturnValue(true),
}

const mockEmailService = {
  sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
}

const mockEmailQueue = {
  enqueue: vi.fn().mockResolvedValue(undefined),
}

const mockPrisma = {
  client: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ email: 'user@test.com' }),
    },
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTransactionEvent(
  status: string,
  reference = 'ORDER-order-1-1000000000000',
) {
  return {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: 'wompi-tx-999',
        reference,
        status,
        amount_in_cents: 5000000,
      },
    },
  }
}

const mockVendeloQueue = { enqueue: vi.fn().mockResolvedValue(undefined) }

async function buildController() {
  const module = await Test.createTestingModule({
    controllers: [WompiController],
    providers: [
      { provide: ORDER_REPOSITORY,         useValue: mockOrderRepo },
      { provide: WompiService,             useValue: mockWompiService },
      { provide: ResendEmailService,       useValue: mockEmailService },
      { provide: EmailQueueService,        useValue: mockEmailQueue },
      { provide: VendeloOrderQueueService, useValue: mockVendeloQueue },
      { provide: PrismaService,            useValue: mockPrisma },
    ],
  }).compile()

  return module.get(WompiController)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('WompiController', () => {
  let controller: WompiController

  beforeEach(async () => {
    vi.clearAllMocks()
    mockWompiService.validateWebhook.mockReturnValue(true)
    controller = await buildController()
  })

  // ── webhook ───────────────────────────────────────────────────────────────────

  describe('POST /payments/wompi/webhook', () => {
    it('lanza UnauthorizedException si la firma del webhook es inválida', async () => {
      mockWompiService.validateWebhook.mockReturnValueOnce(false)

      await expect(
        controller.webhook(buildTransactionEvent('APPROVED'), {}),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('retorna { received: true, processed: false } para eventos que no son transacciones', async () => {
      const result = await controller.webhook({ event: 'nequi.token.created' }, {})

      expect(result).toEqual({ received: true, processed: false })
    })

    it('procesa un pago APPROVED y encola el email de confirmación y Vendelo', async () => {
      const result = await controller.webhook(
        buildTransactionEvent('APPROVED'),
        {},
      )

      expect(mockEmailQueue.enqueue).toHaveBeenCalledWith('user@test.com', 'order-1')
      expect(mockVendeloQueue.enqueue).toHaveBeenCalledWith('order-1')
      expect(result).toMatchObject({ received: true, stateChanged: true })
    })

    it('STORE_PICKUP: encola email pero NUNCA encola Vendelo', async () => {
      mockOrderRepo.findById.mockResolvedValueOnce({
        id: 'order-1',
        userId: 'user-1',
        total: 5000000,
        status: 'PENDING',
        items: [],
        deliveryMethod: 'STORE_PICKUP',
      })

      await controller.webhook(buildTransactionEvent('APPROVED'), {})

      expect(mockEmailQueue.enqueue).toHaveBeenCalledWith('user@test.com', 'order-1')
      expect(mockVendeloQueue.enqueue).not.toHaveBeenCalled()
    })

    it('procesa un pago DECLINED sin encolar email', async () => {
      const { ConfirmPayment } = await import('@motek/domain')
      vi.mocked(ConfirmPayment).mockImplementationOnce(function () {
        return {
          execute: vi.fn().mockResolvedValue({
            ok: true,
            value: { stateChanged: true },
          }),
        }
      })

      await controller.webhook(buildTransactionEvent('DECLINED'), {})

      expect(mockEmailQueue.enqueue).not.toHaveBeenCalled()
    })

    it('retorna error del dominio sin lanzar excepción si ConfirmPayment falla', async () => {
      const { ConfirmPayment } = await import('@motek/domain')
      vi.mocked(ConfirmPayment).mockImplementationOnce(function () {
        return {
          execute: vi.fn().mockResolvedValue({
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Pedido no encontrado' },
          }),
        }
      })

      const result = await controller.webhook(
        buildTransactionEvent('APPROVED'),
        {},
      )

      expect(result).toMatchObject({ received: true, error: 'NOT_FOUND' })
    })
  })
})
