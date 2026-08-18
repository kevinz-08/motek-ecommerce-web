import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { SessionTokenDto } from './dto/session-token.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'
import { ResendOtpDto } from './dto/resend-otp.dto'
import { Public } from './decorators/public.decorator'

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Registrar nuevo usuario y enviar OTP de verificación' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Iniciar sesión y obtener JWT (requiere email verificado)' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Verificar email con código OTP de 6 dígitos' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto)
  }

  @Post('resend-otp')
  @HttpCode(200)
  @Throttle({ default: { ttl: 600_000, limit: 3 } })
  @ApiOperation({ summary: 'Reenviar código OTP (anti-enumeración, siempre responde 200)' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto)
  }

  @Post('session-token')
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: '[INTERNAL] Emitir JWT para usuario OAuth (solo Next.js server-side)' })
  sessionToken(
    @Body() dto: SessionTokenDto,
    @Headers('x-internal-secret') secret: string,
  ) {
    if (!secret || secret !== process.env['INTERNAL_API_SECRET']) {
      throw new UnauthorizedException('Acceso no autorizado')
    }
    return this.authService.issueTokenByEmail(dto.email)
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 900_000, limit: 3 } })
  @ApiOperation({ summary: 'Solicitar enlace de recuperación de contraseña' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto)
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Establecer nueva contraseña con token de recuperación' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto)
  }
}
