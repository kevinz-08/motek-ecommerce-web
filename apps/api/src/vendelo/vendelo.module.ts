import { Module } from '@nestjs/common'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { VendeloController } from './vendelo.controller'
import { VendeloWebhookController } from './vendelo-webhook.controller'
import { ShippingAdminService } from './services/shipping-admin.service'
import { WalletAlertCron } from './services/WalletAlertCron'
import { VendeloShipmentPollerCron } from './services/VendeloShipmentPollerCron'
import { RecipientTrustEvaluator } from './trust/RecipientTrustEvaluator'
import { OrderHistoryTrustStrategy } from './trust/strategies/OrderHistoryTrustStrategy'
import { PhoneFormatTrustStrategy } from './trust/strategies/PhoneFormatTrustStrategy'
import { AddressCompletenessTrustStrategy } from './trust/strategies/AddressCompletenessTrustStrategy'
import { RECIPIENT_TRUST_STRATEGIES } from '../infrastructure/injection-tokens'
import type { IRecipientTrustStrategy } from '@motek/domain'

@Module({
  imports: [InfrastructureModule],
  controllers: [VendeloController, VendeloWebhookController],
  providers: [
    ShippingAdminService,
    WalletAlertCron,
    VendeloShipmentPollerCron,
    OrderHistoryTrustStrategy,
    PhoneFormatTrustStrategy,
    AddressCompletenessTrustStrategy,
    {
      provide: RECIPIENT_TRUST_STRATEGIES,
      useFactory: (
        history: OrderHistoryTrustStrategy,
        phone: PhoneFormatTrustStrategy,
        address: AddressCompletenessTrustStrategy,
      ): IRecipientTrustStrategy[] => [history, phone, address],
      inject: [OrderHistoryTrustStrategy, PhoneFormatTrustStrategy, AddressCompletenessTrustStrategy],
    },
    RecipientTrustEvaluator,
  ],
  exports: [RecipientTrustEvaluator],
})
export class VendeloModule {}
