import { describe, it, expect } from 'vitest'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { QuoteShippingDto } from '../shipping/dto/quote-shipping.dto'

function makeValid(): Record<string, unknown> {
  return {
    shippingCityCode: '11001000',
    shippingSubdivisionCode: '11',
    items: [{ productId: 'prod-1', quantity: 2 }],
    paymentMethod: 'EXTERNAL_PAYMENT',
  }
}

async function validateDto(overrides: Record<string, unknown>) {
  const dto = plainToInstance(QuoteShippingDto, { ...makeValid(), ...overrides })
  return validate(dto)
}

describe('QuoteShippingDto', () => {
  it('pasa con un payload válido', async () => {
    const errors = await validateDto({})
    expect(errors).toHaveLength(0)
  })

  it('rechaza shippingCityCode que no son 8 dígitos (anti city_code falso)', async () => {
    const errors = await validateDto({ shippingCityCode: '123' })
    expect(errors.some((e) => e.property === 'shippingCityCode')).toBe(true)
  })

  it('rechaza shippingSubdivisionCode que no son 2 dígitos', async () => {
    const errors = await validateDto({ shippingSubdivisionCode: '1' })
    expect(errors.some((e) => e.property === 'shippingSubdivisionCode')).toBe(true)
  })

  it('rechaza items vacío', async () => {
    const errors = await validateDto({ items: [] })
    expect(errors.some((e) => e.property === 'items')).toBe(true)
  })

  it('rechaza más de 50 ítems (anti DoS)', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ productId: `prod-${i}`, quantity: 1 }))
    const errors = await validateDto({ items })
    expect(errors.some((e) => e.property === 'items')).toBe(true)
  })

  it('rechaza quantity fuera de [1, 99]', async () => {
    const errors = await validateDto({ items: [{ productId: 'prod-1', quantity: 100 }] })
    expect(errors.some((e) => e.property === 'items')).toBe(true)
  })

  it('rechaza paymentMethod fuera del enum', async () => {
    const errors = await validateDto({ paymentMethod: 'CASH' })
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true)
  })
})
