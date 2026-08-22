import { Module } from '@nestjs/common'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { ShippingController } from './shipping.controller'

@Module({
  imports: [InfrastructureModule],
  controllers: [ShippingController],
})
export class ShippingModule {}
