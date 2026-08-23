import { Module } from '@nestjs/common'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { CouponsController } from './coupons.controller'

@Module({
  imports: [InfrastructureModule],
  controllers: [CouponsController],
})
export class CouponsModule {}
