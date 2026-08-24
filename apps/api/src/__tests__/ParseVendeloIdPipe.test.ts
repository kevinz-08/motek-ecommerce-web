import { describe, it, expect } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { ParseVendeloIdPipe } from '../vendelo/pipes/parse-vendelo-id.pipe'

const pipe = new ParseVendeloIdPipe()

describe('ParseVendeloIdPipe', () => {
  it('acepta IDs alfanuméricos válidos', () => {
    expect(pipe.transform('exc-abc123')).toBe('exc-abc123')
    expect(pipe.transform('EXCEPTION_001')).toBe('EXCEPTION_001')
    expect(pipe.transform('a1B2c3')).toBe('a1B2c3')
  })

  it('acepta IDs con guión y guión bajo', () => {
    expect(pipe.transform('exc-001_v2')).toBe('exc-001_v2')
  })

  it('rechaza IDs con path traversal (barras)', () => {
    expect(() => pipe.transform('../secrets')).toThrow(BadRequestException)
    expect(() => pipe.transform('exc/123')).toThrow(BadRequestException)
  })

  it('rechaza IDs con caracteres especiales (inyección)', () => {
    expect(() => pipe.transform('<script>')).toThrow(BadRequestException)
    expect(() => pipe.transform('exc;DROP')).toThrow(BadRequestException)
    expect(() => pipe.transform('exc%20space')).toThrow(BadRequestException)
  })

  it('rechaza IDs vacíos', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException)
  })

  it('rechaza IDs de más de 100 caracteres', () => {
    const tooLong = 'a'.repeat(101)
    expect(() => pipe.transform(tooLong)).toThrow(BadRequestException)
  })

  it('acepta exactamente 100 caracteres', () => {
    const maxLen = 'a'.repeat(100)
    expect(pipe.transform(maxLen)).toBe(maxLen)
  })
})
