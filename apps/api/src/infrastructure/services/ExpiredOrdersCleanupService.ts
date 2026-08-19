import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // cada hora
const EXPIRY_HOURS = 2

@Injectable()
export class ExpiredOrdersCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpiredOrdersCleanupService.name)
  private timer?: NodeJS.Timeout

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.cancelExpiredOrders().catch((e) =>
        this.logger.error(`[ExpiredOrdersCleanup] Error en limpieza: ${e}`),
      )
    }, CLEANUP_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async cancelExpiredOrders(): Promise<void> {
    const expiryDate = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000)

    const result = await this.prisma.client.order.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: expiryDate },
      },
      data: { status: 'CANCELLED' },
    })

    if (result.count > 0) {
      this.logger.warn(
        `[ExpiredOrdersCleanup] ${result.count} orden(es) PENDING expiradas marcadas CANCELLED (umbral: ${EXPIRY_HOURS}h)`,
      )
    }
  }
}
