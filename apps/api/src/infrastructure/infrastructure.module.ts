import { Module } from '@nestjs/common'
import { PrismaModule } from './database/prisma.module'
import {
  COUPON_REPOSITORY,
  PRODUCT_REPOSITORY,
  PRODUCT_DESCRIPTION_REPOSITORY,
  ORDER_REPOSITORY,
  USER_REPOSITORY,
  INVENTORY_REPOSITORY,
  PAYMENT_SERVICE,
  SHIPMENT_REPOSITORY,
  VENDELO_SHIPPING_PORT,
  ALERT_NOTIFICATION_PORT,
} from './injection-tokens'
import { PrismaCouponRepository } from './repositories/PrismaCouponRepository'
import { PrismaProductRepository } from './repositories/PrismaProductRepository'
import { PrismaStockSyncRepository } from './repositories/PrismaStockSyncRepository'
import { SyncFileParserService } from './services/SyncFileParserService'
import { PrismaProductDescriptionRepository } from './repositories/PrismaProductDescriptionRepository'
import { PrismaOrderRepository } from './repositories/PrismaOrderRepository'
import { PrismaUserRepository } from './repositories/PrismaUserRepository'
import { PrismaShipmentRepository } from './repositories/PrismaShipmentRepository'
import { WompiService } from './services/WompiService'
import { MercadoPagoService } from './services/MercadoPagoService'
import { ResendEmailService } from './services/ResendEmailService'
import { CloudinaryService } from './services/CloudinaryService'
import { EmailQueueService } from './services/EmailQueueService'
import { VendeloHttpClient } from './services/VendeloHttpClient'
import { VendeloService } from './services/VendeloService'
import { VendeloOrderQueueService } from './services/VendeloOrderQueueService'
import { LogAlertNotificationService } from './services/LogAlertNotificationService'
import { WompiReconciliationService } from './services/WompiReconciliationService'
import { ExpiredOrdersCleanupService } from './services/ExpiredOrdersCleanupService'

@Module({
  imports: [PrismaModule],
  providers: [
    { provide: COUPON_REPOSITORY,              useClass: PrismaCouponRepository },
    { provide: PRODUCT_REPOSITORY,             useClass: PrismaProductRepository },
    { provide: INVENTORY_REPOSITORY,           useClass: PrismaStockSyncRepository },
    SyncFileParserService,
    { provide: PRODUCT_DESCRIPTION_REPOSITORY, useClass: PrismaProductDescriptionRepository },
    { provide: ORDER_REPOSITORY,               useClass: PrismaOrderRepository },
    { provide: USER_REPOSITORY,                useClass: PrismaUserRepository },
    { provide: SHIPMENT_REPOSITORY,            useClass: PrismaShipmentRepository },
    { provide: VENDELO_SHIPPING_PORT,          useClass: VendeloService },
    // PAYMENT_SERVICE token → Wompi (pasarela principal Colombia)
    { provide: PAYMENT_SERVICE,    useClass: WompiService },
    // Servicios concretos también disponibles por clase para inyección directa en controllers
    WompiService,
    MercadoPagoService,
    ResendEmailService,
    CloudinaryService,
    EmailQueueService,
    VendeloHttpClient,
    VendeloService,
    VendeloOrderQueueService,
    LogAlertNotificationService,
    { provide: ALERT_NOTIFICATION_PORT, useClass: LogAlertNotificationService },
    WompiReconciliationService,
    ExpiredOrdersCleanupService,
  ],
  exports: [
    COUPON_REPOSITORY,
    INVENTORY_REPOSITORY,
    SyncFileParserService,
    PrismaModule,
    PRODUCT_REPOSITORY,
    PRODUCT_DESCRIPTION_REPOSITORY,
    ORDER_REPOSITORY,
    USER_REPOSITORY,
    SHIPMENT_REPOSITORY,
    VENDELO_SHIPPING_PORT,
    PAYMENT_SERVICE,
    ALERT_NOTIFICATION_PORT,
    WompiService,
    MercadoPagoService,
    ResendEmailService,
    CloudinaryService,
    EmailQueueService,
    VendeloHttpClient,
    VendeloService,
    VendeloOrderQueueService,
  ],
})
export class InfrastructureModule {}
