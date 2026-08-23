import { Module } from '@nestjs/common'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { ContactController } from './contact.controller'

@Module({
  imports: [InfrastructureModule],
  controllers: [ContactController],
})
export class ContactModule {}
