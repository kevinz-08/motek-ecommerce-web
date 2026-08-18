import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RolesGuard } from './guards/roles.guard'
import { OtpService } from './otp.service'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-in-production',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRY') ?? '7d' },
      }),
      inject: [ConfigService],
    }),
    InfrastructureModule,
  ],
  providers: [AuthService, OtpService, JwtStrategy, JwtAuthGuard, RolesGuard],
  controllers: [AuthController],
  exports: [JwtAuthGuard, RolesGuard, JwtModule, PassportModule, OtpService],
})
export class AuthModule {}
