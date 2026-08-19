import { Module } from '@nestjs/common'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { OrdersController } from './orders.controller'

@Module({
  imports: [InfrastructureModule],
  controllers: [OrdersController],
})
export class OrdersModule {}
