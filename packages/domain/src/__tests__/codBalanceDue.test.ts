import { describe, it, expect } from 'vitest'
import { codBalanceDue } from '@/domain/entities/Order'

describe('codBalanceDue', () => {
  it('descuenta el anticipo del total', () => {
    expect(codBalanceDue({ total: 5000000, codDepositAmount: 1500000 })).toBe(3500000)
  })

  it('sin anticipo el saldo es el total', () => {
    expect(codBalanceDue({ total: 5000000 })).toBe(5000000)
    expect(codBalanceDue({ total: 5000000, codDepositAmount: 0 })).toBe(5000000)
  })

  it('nunca es negativo', () => {
    expect(codBalanceDue({ total: 1000000, codDepositAmount: 1500000 })).toBe(0)
  })
})
