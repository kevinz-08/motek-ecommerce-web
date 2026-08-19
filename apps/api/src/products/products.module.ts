import { Module } from '@nestjs/common'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { ProductsController } from './products.controller'

@Module({
  imports: [InfrastructureModule],
  controllers: [ProductsController],
})
export class ProductsModule {}
