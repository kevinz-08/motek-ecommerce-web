import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { ConflictException, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common'

vi.mock('@motek/database', () => ({
  prisma: { $connect: vi.fn(), $disconnect: vi.fn() },
  PrismaClient: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password'), compare: vi.fn() },
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn(),
}))

import { AuthService } from '../auth/auth.service'
import * as bcrypt from 'bcryptjs'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawUser {
  id: string
  email: string
  name: string | null
  password: string | null
  emailVerified: Date | null
}

// ── Mocks factory ─────────────────────────────────────────────────────────────

function buildMocks() {
  const verifiedUser: RawUser = {
    id: 'user-001',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed-password',
    emailVerified: new Date(),
  }

  const unverifiedUser: RawUser = { ...verifiedUser, emailVerified: null }

  const prismaMock = {
    client: {
      user: {
        create: vi.fn().mockResolvedValue(verifiedUser),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue(verifiedUser),
      },
      passwordResetToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn(),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    },
  }

  const jwtMock = { sign: vi.fn().mockReturnValue('jwt-token') }

  const emailMock = {
    sendOtpVerification: vi.fn().mockResolvedValue(undefined),
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  }

  const otpMock = {
    generateAndSave: vi.fn().mockResolvedValue('482931'),
    verify: vi.fn(),
  }

  const userRepoMock = {
    findByEmail: vi.fn(),
  }

  return { prismaMock, jwtMock, emailMock, otpMock, userRepoMock, verifiedUser, unverifiedUser }
}

function buildService(mocks: ReturnType<typeof buildMocks>): AuthService {
  return new AuthService(
    mocks.prismaMock as never,
    mocks.jwtMock as never,
    mocks.emailMock as never,
    mocks.otpMock as never,
    mocks.userRepoMock as never,
  )
}

// ── register ──────────────────────────────────────────────────────────────────

describe('AuthService.register', () => {
  it('lanza ConflictException si el email ya existe', async () => {
    const mocks = buildMocks()
    mocks.userRepoMock.findByEmail.mockResolvedValue({ id: 'existing' })
    const service = buildService(mocks)

    await expect(service.register({ name: 'A', email: 'test@example.com', password: 'pass1234' }))
      .rejects.toBeInstanceOf(ConflictException)
  })

  it('genera y envía OTP tras crear el usuario', async () => {
    const mocks = buildMocks()
    mocks.userRepoMock.findByEmail.mockResolvedValue(null)
    const service = buildService(mocks)

    await service.register({ name: 'Test User', email: 'new@example.com', password: 'pass1234' })

    expect(mocks.otpMock.generateAndSave).toHaveBeenCalledWith('user-001')
    expect(mocks.emailMock.sendOtpVerification).toHaveBeenCalledWith('new@example.com', 'Test User', '482931')
  })

  it('retorna verificationRequired: true', async () => {
    const mocks = buildMocks()
    mocks.userRepoMock.findByEmail.mockResolvedValue(null)
    const service = buildService(mocks)

    const result = await service.register({ name: 'Test', email: 'new@example.com', password: 'pass1234' })

    expect(result.verificationRequired).toBe(true)
  })
})

// ── login ─────────────────────────────────────────────────────────────────────

describe('AuthService.login', () => {
  it('lanza UnauthorizedException si el usuario no existe', async () => {
    const mocks = buildMocks()
    mocks.userRepoMock.findByEmail.mockResolvedValue(null)
    const service = buildService(mocks)

    await expect(service.login({ email: 'no@exist.com', password: 'pass' }))
      .rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('lanza ForbiddenException con EMAIL_NOT_VERIFIED si el email no está verificado', async () => {
    const mocks = buildMocks()
    mocks.userRepoMock.findByEmail.mockResolvedValue({ id: 'user-001', email: 'test@example.com', role: 'CUSTOMER', name: 'Test' })
    mocks.prismaMock.client.user.findUnique.mockResolvedValue(mocks.unverifiedUser)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    const service = buildService(mocks)

    const error = await service.login({ email: 'test@example.com', password: 'pass1234' }).catch((e) => e)

    expect(error).toBeInstanceOf(ForbiddenException)
    expect(error.message).toBe('EMAIL_NOT_VERIFIED')
  })

  it('retorna accessToken si las credenciales son válidas y email verificado', async () => {
    const mocks = buildMocks()
    mocks.userRepoMock.findByEmail.mockResolvedValue({ id: 'user-001', email: 'test@example.com', role: 'CUSTOMER', name: 'Test' })
    mocks.prismaMock.client.user.findUnique.mockResolvedValue(mocks.verifiedUser)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    const service = buildService(mocks)

    const result = await service.login({ email: 'test@example.com', password: 'pass1234' })

    expect(result.accessToken).toBe('jwt-token')
  })

  it('lanza UnauthorizedException si la contraseña es incorrecta', async () => {
    const mocks = buildMocks()
    mocks.userRepoMock.findByEmail.mockResolvedValue({ id: 'user-001', email: 'test@example.com', role: 'CUSTOMER', name: 'Test' })
    mocks.prismaMock.client.user.findUnique.mockResolvedValue(mocks.verifiedUser)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
    const service = buildService(mocks)

    await expect(service.login({ email: 'test@example.com', password: 'wrong' }))
      .rejects.toBeInstanceOf(UnauthorizedException)
  })
})

// ── verifyEmail ───────────────────────────────────────────────────────────────

describe('AuthService.verifyEmail', () => {
  it('lanza BadRequestException si el usuario no existe (anti-enumeración)', async () => {
    const mocks = buildMocks()
    mocks.prismaMock.client.user.findUnique.mockResolvedValue(null)
    const service = buildService(mocks)

    await expect(service.verifyEmail({ email: 'ghost@example.com', code: '123456' }))
      .rejects.toBeInstanceOf(BadRequestException)
  })

  it('retorna mensaje de ya verificado si emailVerified no es null', async () => {
    const mocks = buildMocks()
    mocks.prismaMock.client.user.findUnique.mockResolvedValue({ id: 'user-001', emailVerified: new Date() })
    const service = buildService(mocks)

    const result = await service.verifyEmail({ email: 'test@example.com', code: '123456' })

    expect(result.message).toContain('ya fue verificado')
    expect(mocks.otpMock.verify).not.toHaveBeenCalled()
  })

  it('lanza BadRequestException con código inválido', async () => {
    const mocks = buildMocks()
    mocks.prismaMock.client.user.findUnique.mockResolvedValue({ id: 'user-001', emailVerified: null })
    mocks.otpMock.verify.mockResolvedValue('invalid_or_expired')
    const service = buildService(mocks)

    await expect(service.verifyEmail({ email: 'test@example.com', code: '000000' }))
      .rejects.toBeInstanceOf(BadRequestException)
  })

  it('lanza BadRequestException cuando se superan los intentos', async () => {
    const mocks = buildMocks()
    mocks.prismaMock.client.user.findUnique.mockResolvedValue({ id: 'user-001', emailVerified: null })
    mocks.otpMock.verify.mockResolvedValue('too_many_attempts')
    const service = buildService(mocks)

    const error = await service.verifyEmail({ email: 'test@example.com', code: '000000' }).catch((e) => e)

    expect(error).toBeInstanceOf(BadRequestException)
    expect(error.message).toContain('Demasiados intentos')
  })

  it('actualiza emailVerified y retorna mensaje de éxito con código correcto', async () => {
    const mocks = buildMocks()
    mocks.prismaMock.client.user.findUnique.mockResolvedValue({ id: 'user-001', emailVerified: null })
    mocks.otpMock.verify.mockResolvedValue('success')
    const service = buildService(mocks)

    const result = await service.verifyEmail({ email: 'test@example.com', code: '482931' })

    expect(mocks.prismaMock.client.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emailVerified: expect.any(Date) }) }),
    )
    expect(result.message).toContain('verificado correctamente')
  })
})

// ── resendOtp ─────────────────────────────────────────────────────────────────

describe('AuthService.resendOtp', () => {
  it('retorna respuesta segura aunque el email no exista (anti-enumeración)', async () => {
    const mocks = buildMocks()
    mocks.prismaMock.client.user.findUnique.mockResolvedValue(null)
    const service = buildService(mocks)

    const result = await service.resendOtp({ email: 'ghost@example.com' })

    expect(result.message).toContain('Si el correo está registrado')
    expect(mocks.otpMock.generateAndSave).not.toHaveBeenCalled()
  })

  it('retorna respuesta segura si el usuario ya está verificado', async () => {
    const mocks = buildMocks()
    mocks.prismaMock.client.user.findUnique.mockResolvedValue({ id: 'user-001', name: 'Test', emailVerified: new Date() })
    const service = buildService(mocks)

    const result = await service.resendOtp({ email: 'test@example.com' })

    expect(result.message).toContain('Si el correo está registrado')
    expect(mocks.otpMock.generateAndSave).not.toHaveBeenCalled()
  })

  it('genera y envía nuevo OTP si el usuario existe y no está verificado', async () => {
    const mocks = buildMocks()
    mocks.prismaMock.client.user.findUnique.mockResolvedValue({ id: 'user-001', name: 'Test', emailVerified: null })
    const service = buildService(mocks)

    await service.resendOtp({ email: 'test@example.com' })

    expect(mocks.otpMock.generateAndSave).toHaveBeenCalledWith('user-001')
    expect(mocks.emailMock.sendOtpVerification).toHaveBeenCalled()
  })
})
