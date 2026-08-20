import { Module } from '@nestjs/common'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { WompiController } from './wompi.controller'
import { MercadoPagoController } from './mercadopago.controller'

@Module({
  imports: [InfrastructureModule],
  controllers: [WompiController, MercadoPagoController],
})
export class PaymentsModule {}
