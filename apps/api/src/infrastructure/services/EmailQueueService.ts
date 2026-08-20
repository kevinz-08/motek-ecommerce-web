import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { Order } from '@motek/domain'
import { PrismaService } from '../database/prisma.service'
import { ResendEmailService } from './ResendEmailService'

const PROCESS_INTERVAL_MS = 2 * 60 * 1000 // cada 2 minutos
const MAX_ATTEMPTS = 3
const BACKOFF_SECONDS = [5, 30, 120] // por intento fallido

@Injectable()
export class EmailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueService.name)
  private timer?: NodeJS.Timeout

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: ResendEmailService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.processNext().catch((e) => this.logger.error(`[EmailQueue] Error en procesamiento: ${e}`))
    }, PROCESS_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async enqueue(to: string, orderId: string): Promise<void> {
    await this.prisma.client.emailQueue.create({
      data: { to, orderId, status: 'PENDING' },
    })
    this.logger.log(`[EmailQueue] Encolado email de confirmación orderId=${orderId}`)
  }

  async processNext(): Promise<void> {
    const pending = await this.prisma.client.emailQueue.findMany({
      where: { status: 'PENDING', nextRetry: { lte: new Date() } },
      take: 10,
      orderBy: { createdAt: 'asc' },
    })

    if (pending.length === 0) return

    this.logger.log(`[EmailQueue] Procesando ${pending.length} email(s) pendiente(s)`)

    for (const item of pending) {
      try {
        const order = await this.prisma.client.order.findUnique({
          where: { id: item.orderId },
          include: { items: true },
        })

        if (!order) {
          await this.prisma.client.emailQueue.update({
            where: { id: item.id },
            data: { status: 'FAILED', lastError: 'Pedido no encontrado', attempts: item.attempts + 1 },
          })
          this.logger.warn(`[EmailQueue] Pedido no encontrado orderId=${item.orderId}, marcando FAILED`)
          continue
        }

        await this.emailService.sendOrderConfirmation(order as unknown as Order, item.to)

        await this.prisma.client.emailQueue.update({
          where: { id: item.id },
          data: { status: 'SENT', attempts: item.attempts + 1 },
        })
        this.logger.log(`[EmailQueue] Email enviado exitosamente orderId=${item.orderId}`)
      } catch (e) {
        const attempts = item.attempts + 1
        const backoffSecs = BACKOFF_SECONDS[attempts - 1] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]
        const nextRetry = new Date(Date.now() + backoffSecs * 1000)
        const status = attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING'

        await this.prisma.client.emailQueue.update({
          where: { id: item.id },
          data: { attempts, lastError: String(e), status, nextRetry },
        })

        this.logger.error(
          `[EmailQueue] Intento ${attempts}/${MAX_ATTEMPTS} fallido orderId=${item.orderId} status=${status}: ${e}`,
        )
      }
    }
  }

  async findFailed(limit = 50) {
    return this.prisma.client.emailQueue.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
