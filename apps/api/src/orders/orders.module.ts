import { Module } from '@nestjs/common'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { OrdersController } from './orders.controller'
import { GuestOrdersController } from './guest-orders.controller'

@Module({
  imports: [InfrastructureModule],
  controllers: [OrdersController, GuestOrdersController],
})
export class OrdersModule {}
