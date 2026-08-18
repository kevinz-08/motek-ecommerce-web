import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { SentryModule } from '@sentry/nestjs/setup'
import { AppController } from './app.controller'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { InfrastructureModule } from './infrastructure/infrastructure.module'
import { AuthModule } from './auth/auth.module'
import { ProductsModule } from './products/products.module'
import { OrdersModule } from './orders/orders.module'
import { AdminModule } from './admin/admin.module'
import { PaymentsModule } from './payments/payments.module'
import { VendeloModule } from './vendelo/vendelo.module'
import { ShippingModule } from './shipping/shipping.module'
import { CouponsModule } from './coupons/coupons.module'
import { ContactModule } from './contact/contact.module'
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'
import { RolesGuard } from './auth/guards/roles.guard'

/**
 * AppModule — raíz de la aplicación NestJS.
 *
 * Guards globales (secure-by-default):
 *   - ThrottlerGuard: 100 req/min global; auth endpoints tienen límites más estrictos
 *   - JwtAuthGuard: todas las rutas requieren JWT salvo las marcadas @Public()
 *   - RolesGuard: comprueba @Roles('ADMIN') donde aplique
 */
@Module({
  controllers: [AppController],
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
    InfrastructureModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    AdminModule,
    PaymentsModule,
    VendeloModule,
    ShippingModule,
    CouponsModule,
    ContactModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
