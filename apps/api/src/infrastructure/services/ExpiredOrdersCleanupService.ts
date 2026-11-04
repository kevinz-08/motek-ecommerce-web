import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { intervalJobsEnabled } from '../../jobs/background-jobs.config'

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // cada hora
const EXPIRY_HOURS = 2
// Contraentrega con anticipo: el cliente puede pagarlo después, así que el plazo es mayor.
const DEPOSIT_EXPIRY_HOURS = 24

@Injectable()
export class ExpiredOrdersCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpiredOrdersCleanupService.name)
  private timer?: NodeJS.Timeout

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Con BACKGROUND_JOBS_MODE=scheduler la dispara Cloud Scheduler (jobs/jobs.controller.ts)
    if (!intervalJobsEnabled()) return
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

    const depositExpiryDate = new Date(Date.now() - DEPOSIT_EXPIRY_HOURS * 60 * 60 * 1000)

    const result = await this.prisma.client.order.updateMany({
      where: {
        OR: [
          { status: 'PENDING', createdAt: { lt: expiryDate } },
          { status: 'AWAITING_DEPOSIT', createdAt: { lt: depositExpiryDate } },
        ],
      },
      data: { status: 'CANCELLED' },
    })

    if (result.count > 0) {
      this.logger.warn(
        `[ExpiredOrdersCleanup] ${result.count} orden(es) PENDING/AWAITING_DEPOSIT expiradas marcadas CANCELLED (umbral: ${EXPIRY_HOURS}h / ${DEPOSIT_EXPIRY_HOURS}h)`,
      )
    }
  }
}
