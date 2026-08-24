import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { AppError } from '@motek/domain'

// vi.mock se alza (hoist) antes de los imports — ver orders.controller.test.ts
// para el mismo patrón. IProductRepository/IVendeloShippingPort son interfaces
// TypeScript, no existen en runtime.
vi.mock('@motek/domain', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    IProductRepository: undefined,
    IVendeloShippingPort: undefined,
    QuoteShipping: vi.fn().mockImplementation(function () {
      return { execute: mockExecute }
    }),
  }
})

import { ShippingController } from '../shipping/shipping.controller'
import { PRODUCT_REPOSITORY, VENDELO_SHIPPING_PORT } from '../infrastructure/injection-tokens'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockExecute = vi.fn()
const mockProductRepo = { findById: vi.fn() }
const mockShippingPort = { quoteOrder: vi.fn() }

const VALID_DTO = {
  shippingCityCode: '11001000',
  shippingSubdivisionCode: '11',
  items: [{ productId: 'prod-1', quantity: 2 }],
  paymentMethod: 'EXTERNAL_PAYMENT' as const,
}

// ── Setup ─────────────────────────────────────────────────────────────────────

async function buildController() {
  const module = await Test.createTestingModule({
    controllers: [ShippingController],
    providers: [
      { provide: PRODUCT_REPOSITORY, useValue: mockProductRepo },
      { provide: VENDELO_SHIPPING_PORT, useValue: mockShippingPort },
    ],
  }).compile()

  return module.get(ShippingController)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ShippingController — POST /shipping/quote', () => {
  let controller: ShippingController

  beforeEach(async () => {
    vi.clearAllMocks()
    controller = await buildController()
  })

  it('retorna el resultado del use case en el happy path', async () => {
    mockExecute.mockResolvedValue({ ok: true, value: { quotedShippingTotal: 900000, freeShipping: false } })

    const result = await controller.quote(VALID_DTO)

    expect(result).toEqual({ quotedShippingTotal: 900000, freeShipping: false })
  })

  it('lanza el AppError del use case cuando falla (el filtro global lo mapea a HTTP)', async () => {
    const error = new AppError('NOT_FOUND', 'Producto "prod-1" no encontrado')
    mockExecute.mockResolvedValue({ ok: false, error })

    await expect(controller.quote(VALID_DTO)).rejects.toThrow('Producto "prod-1" no encontrado')
  })

  it('pasa los campos del DTO tal cual al use case (sin pasar precios del cliente)', async () => {
    mockExecute.mockResolvedValue({ ok: true, value: { quotedShippingTotal: 0, freeShipping: true } })

    await controller.quote(VALID_DTO)

    expect(mockExecute).toHaveBeenCalledWith({
      shippingCityCode: '11001000',
      shippingSubdivisionCode: '11',
      items: [{ productId: 'prod-1', quantity: 2 }],
      paymentMethod: 'EXTERNAL_PAYMENT',
    })
  })
})
