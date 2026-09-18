import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { ClaimGuestOrders, IOrderRepository, IUserRepository } from '@motek/domain'
import { PrismaService } from '../infrastructure/database/prisma.service'
import { ResendEmailService } from '../infrastructure/services/ResendEmailService'
import { ORDER_REPOSITORY, USER_REPOSITORY } from '../infrastructure/injection-tokens'
import { OtpService } from './otp.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'
import { ResendOtpDto } from './dto/resend-otp.dto'
import type { JwtPayload } from './strategies/jwt.strategy'

const TOKEN_EXPIRY_MS = 60 * 60 * 1000

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: ResendEmailService,
    private readonly otpService: OtpService,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: IOrderRepository,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string; verificationRequired: boolean }> {
    const existing = await this.userRepo.findByEmail(dto.email)
    if (existing) throw new ConflictException('El email ya está registrado')

    const hashed = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.client.user.create({
      data: { name: dto.name, email: dto.email, password: hashed, role: 'CUSTOMER' },
    })

    const code = await this.otpService.generateAndSave(user.id)
    if (process.env['NODE_ENV'] !== 'production') {
      this.logger.warn(`[DEV] OTP para ${dto.email}: ${code}`)
    }
    this.emailService
      .sendOtpVerification(dto.email, dto.name, code)
      .catch((e) => this.logger.error(`register sendOtpVerification failed userId=${user.id}: ${e}`))

    return { message: 'Revisa tu correo para verificar tu cuenta.', verificationRequired: true }
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string
    role: string
    userId: string
    name: string
    email: string
  }> {
    const user = await this.userRepo.findByEmail(dto.email)
    if (!user) throw new UnauthorizedException('Credenciales inválidas')

    const raw = await this.prisma.client.user.findUnique({ where: { email: dto.email } })
    if (!raw?.password) throw new UnauthorizedException('Credenciales inválidas')

    const valid = await bcrypt.compare(dto.password, raw.password)
    if (!valid) throw new UnauthorizedException('Credenciales inválidas')

    if (!raw.emailVerified) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED')
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role }
    return {
      accessToken: this.jwtService.sign(payload),
      role: user.role,
      userId: user.id,
      name: user.name ?? '',
      email: user.email,
    }
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const rawUser = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
      select: { id: true, emailVerified: true },
    })

    if (!rawUser) throw new BadRequestException('Código inválido o expirado.')

    if (rawUser.emailVerified) {
      return { message: 'Tu correo ya fue verificado. Puedes iniciar sesión.' }
    }

    const result = await this.otpService.verify(rawUser.id, dto.code)

    if (result === 'too_many_attempts') {
      throw new BadRequestException('Demasiados intentos fallidos. Solicita un nuevo código.')
    }

    if (result === 'invalid_or_expired') {
      throw new BadRequestException('Código inválido o expirado.')
    }

    await this.prisma.client.user.update({
      where: { id: rawUser.id },
      data: { emailVerified: new Date() },
    })

    // Verificar el OTP prueba la propiedad del correo — es el único momento del
    // registro en que eso queda demostrado. Recién ahí es seguro vincular los
    // pedidos que esa persona hizo antes como invitada con este mismo email.
    // Hacerlo en el checkout, con un correo apenas tecleado, expondría los datos
    // del comprador real a quien escribiera su dirección.
    const claim = await new ClaimGuestOrders(this.orderRepo).execute({
      userId: rawUser.id,
      accountEmail: dto.email,
    })
    if (claim.ok && claim.value.claimed > 0) {
      this.logger.log(
        `[VerifyEmail] userId=${rawUser.id} vinculó ${claim.value.claimed} pedido(s) hechos como invitado`,
      )
    } else if (!claim.ok) {
      // No romper la verificación por esto: la cuenta ya quedó verificada y el
      // usuario siempre puede reclamar sus pedidos desde /pedidos.
      this.logger.error(`[VerifyEmail] Falló el vínculo de pedidos de invitado: ${claim.error.code}`)
    }

    return { message: 'Email verificado correctamente. Ya puedes iniciar sesión.' }
  }

  async resendOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    const SAFE_RESPONSE = {
      message: 'Si el correo está registrado y pendiente de verificación, recibirás un nuevo código.',
    }

    const rawUser = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, emailVerified: true },
    })

    if (!rawUser || rawUser.emailVerified) return SAFE_RESPONSE

    const code = await this.otpService.generateAndSave(rawUser.id)
    if (process.env['NODE_ENV'] !== 'production') {
      this.logger.warn(`[DEV] OTP (resend) para ${dto.email}: ${code}`)
    }
    this.emailService
      .sendOtpVerification(dto.email, rawUser.name ?? 'Usuario', code)
      .catch((e) => this.logger.error(`resendOtp failed email=${dto.email}: ${e}`))

    return SAFE_RESPONSE
  }

  async issueTokenByEmail(email: string): Promise<{ accessToken: string; role: string }> {
    const user = await this.userRepo.findByEmail(email)
    if (!user) throw new UnauthorizedException('Usuario no encontrado')
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role }
    return { accessToken: this.jwtService.sign(payload), role: user.role }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const SAFE_RESPONSE = { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' }

    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true, password: true },
    })

    if (!user?.password) return SAFE_RESPONSE

    await this.prisma.client.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    })

    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)

    await this.prisma.client.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
      },
    })

    this.emailService
      .sendPasswordReset(user.email, user.name ?? 'Usuario', rawToken)
      .catch((e) => this.logger.error(`sendPasswordReset failed userId=${user.id}: ${e}`))

    return SAFE_RESPONSE
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = hashToken(dto.token)

    const record = await this.prisma.client.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    })

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('El enlace de recuperación no es válido o ya expiró.')
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12)

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.client.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ])

    return { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' }
  }
}
