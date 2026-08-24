import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'

// vi.mock se alza (hoist) antes de los imports — @motek/database estará mockeado
// cuando PrismaService intente importarlo, evitando el error de cliente generado.
vi.mock('@motek/database', () => ({
  prisma: { $connect: vi.fn(), $disconnect: vi.fn() },
  PrismaClient: vi.fn(),
}))

import { OtpService, type OtpVerifyResult } from '../auth/otp.service'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailOtpRecord {
  id: string
  userId: string
  codeHash: string
  expiresAt: Date
  usedAt: Date | null
  attempts: number
  createdAt: Date
}

interface PrismaMock {
  client: {
    emailOtp: {
      updateMany: MockedFunction<(args: unknown) => Promise<{ count: number }>>
      create: MockedFunction<(args: unknown) => Promise<EmailOtpRecord>>
      findFirst: MockedFunction<(args: unknown) => Promise<EmailOtpRecord | null>>
      update: MockedFunction<(args: unknown) => Promise<EmailOtpRecord>>
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

import { createHash } from 'crypto'

const TEST_USER_ID = 'user-cuid-001'

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function futureDate(minutes = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1_000)
}

function pastDate(minutes = 1): Date {
  return new Date(Date.now() - minutes * 60 * 1_000)
}

function makeRecord(overrides: Partial<EmailOtpRecord> = {}): EmailOtpRecord {
  return {
    id: 'otp-record-001',
    userId: TEST_USER_ID,
    codeHash: sha256('482931'),
    expiresAt: futureDate(10),
    usedAt: null,
    attempts: 0,
    createdAt: new Date(),
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('OtpService', () => {
  let service: OtpService
  let prismaMock: PrismaMock

  beforeEach(() => {
    prismaMock = {
      client: {
        emailOtp: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue(makeRecord()),
          findFirst: vi.fn(),
          update: vi.fn().mockResolvedValue(makeRecord()),
        },
      },
    }
    service = new OtpService(prismaMock as never)
  })

  // ── generateAndSave ────────────────────────────────────────────────────────

  describe('generateAndSave', () => {
    it('genera un código numérico de exactamente 6 dígitos', async () => {
      const code = await service.generateAndSave(TEST_USER_ID)

      expect(code).toMatch(/^\d{6}$/)
    })

    it('el código generado está en el rango [100000, 999999]', async () => {
      const code = await service.generateAndSave(TEST_USER_ID)
      const n = parseInt(code, 10)

      expect(n).toBeGreaterThanOrEqual(100_000)
      expect(n).toBeLessThanOrEqual(999_999)
    })

    it('invalida OTPs anteriores activos antes de crear uno nuevo', async () => {
      await service.generateAndSave(TEST_USER_ID)

      expect(prismaMock.client.emailOtp.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: TEST_USER_ID, usedAt: null }),
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      )
    })

    it('almacena el hash SHA-256 del código, no el código en claro', async () => {
      const code = await service.generateAndSave(TEST_USER_ID)
      const expectedHash = sha256(code)

      expect(prismaMock.client.emailOtp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ codeHash: expectedHash }),
        }),
      )
    })

    it('genera códigos distintos en invocaciones consecutivas (no estático)', async () => {
      const codes = await Promise.all(
        Array.from({ length: 20 }, () => service.generateAndSave(TEST_USER_ID)),
      )
      const unique = new Set(codes)

      expect(unique.size).toBeGreaterThan(1)
    })
  })

  // ── verify ─────────────────────────────────────────────────────────────────

  describe('verify', () => {
    it('retorna "success" con el código correcto y OTP vigente', async () => {
      const record = makeRecord({ codeHash: sha256('482931') })
      prismaMock.client.emailOtp.findFirst.mockResolvedValue(record)

      const result: OtpVerifyResult = await service.verify(TEST_USER_ID, '482931')

      expect(result).toBe('success')
    })

    it('marca el OTP como usado (usedAt) al verificar correctamente', async () => {
      prismaMock.client.emailOtp.findFirst.mockResolvedValue(
        makeRecord({ codeHash: sha256('482931') }),
      )

      await service.verify(TEST_USER_ID, '482931')

      expect(prismaMock.client.emailOtp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      )
    })

    it('retorna "invalid_or_expired" cuando no existe OTP activo', async () => {
      prismaMock.client.emailOtp.findFirst.mockResolvedValue(null)

      const result = await service.verify(TEST_USER_ID, '000000')

      expect(result).toBe('invalid_or_expired')
    })

    it('retorna "invalid_or_expired" con código incorrecto e incrementa intentos', async () => {
      prismaMock.client.emailOtp.findFirst.mockResolvedValue(
        makeRecord({ codeHash: sha256('482931'), attempts: 1 }),
      )

      const result = await service.verify(TEST_USER_ID, '111111')

      expect(result).toBe('invalid_or_expired')
      expect(prismaMock.client.emailOtp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ attempts: { increment: 1 } }),
        }),
      )
    })

    it('retorna "too_many_attempts" cuando el OTP alcanzó 5 intentos fallidos', async () => {
      prismaMock.client.emailOtp.findFirst.mockResolvedValue(
        makeRecord({ attempts: 5 }),
      )

      const result = await service.verify(TEST_USER_ID, '123456')

      expect(result).toBe('too_many_attempts')
      expect(prismaMock.client.emailOtp.update).not.toHaveBeenCalled()
    })

    it('retorna "invalid_or_expired" para OTP expirado (findFirst no lo devuelve)', async () => {
      prismaMock.client.emailOtp.findFirst.mockResolvedValue(null)

      const result = await service.verify(TEST_USER_ID, '482931')

      expect(result).toBe('invalid_or_expired')
    })

    it('no persiste datos adicionales al fallar con too_many_attempts', async () => {
      prismaMock.client.emailOtp.findFirst.mockResolvedValue(
        makeRecord({ attempts: 5 }),
      )

      await service.verify(TEST_USER_ID, '999999')

      expect(prismaMock.client.emailOtp.update).not.toHaveBeenCalled()
      expect(prismaMock.client.emailOtp.updateMany).not.toHaveBeenCalled()
    })
  })
})
