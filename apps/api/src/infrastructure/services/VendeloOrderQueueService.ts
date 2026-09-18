import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { VendeloService } from './VendeloService'

const PROCESS_INTERVAL_MS = 2 * 60 * 1000 // cada 2 minutos
const MAX_ATTEMPTS = 3
const BACKOFF_SECONDS = [5, 30, 120] // por intento fallido
const ORPHAN_THRESHOLD_MS = 5 * 60 * 1000 // 5 min sin avance = contenedor crasheó

@Injectable()
export class VendeloOrderQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VendeloOrderQueueService.name)
  private timer?: NodeJS.Timeout

  constructor(
    private readonly prisma: PrismaService,
    private readonly vendeloService: VendeloService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.processNext().catch((e) => this.logger.error(`[VendeloOrderQueue] Error en procesamiento: ${e}`))
    }, PROCESS_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async enqueue(orderId: string): Promise<void> {
    await this.prisma.client.vendeloOrderQueue.create({
      data: { orderId, status: 'PENDING' },
    })
    this.logger.log(`[VendeloOrderQueue] Encolado orderId=${orderId}`)
  }

  async processNext(): Promise<void> {
    await this.releaseOrphanedRows()

    const pending = await this.prisma.client.vendeloOrderQueue.findMany({
      where: { status: 'PENDING', nextRetry: { lte: new Date() } },
      take: 10,
      orderBy: { createdAt: 'asc' },
    })

    if (pending.length === 0) return

    this.logger.log(`[VendeloOrderQueue] Procesando ${pending.length} orden(es) pendiente(s)`)

    for (const item of pending) {
      // Prefijo de trazabilidad consistente: todos los logs de este item llevan orderId + queueId
      const ctx = `orderId=${item.orderId} queueId=${item.id} intento=${item.attempts + 1}/${MAX_ATTEMPTS}`

      // Claim atómico: solo avanzamos si la fila SIGUE en PENDING. Si otra instancia
      // de Cloud Run (u otro tick de este mismo proceso) ya la agarró, count === 0.
      const claimed = await this.prisma.client.vendeloOrderQueue.updateMany({
        where: { id: item.id, status: 'PENDING' },
        data: { status: 'PROCESSING', processingStartedAt: new Date() },
      })

      if (claimed.count === 0) {
        this.logger.warn(`[VendeloOrderQueue] Skip: fila ya reclamada por otro worker ${ctx}`)
        continue
      }

      try {
        const order = await this.prisma.client.order.findUnique({
          where: { id: item.orderId },
          include: {
            items: {
              include: {
                product: {
                  select: { sku: true, name: true, weightKg: true, heightCm: true, widthCm: true, lengthCm: true },
                },
              },
            },
          },
        })

        if (!order) {
          await this.prisma.client.vendeloOrderQueue.update({
            where: { id: item.id },
            data: { status: 'FAILED', lastError: 'Pedido no encontrado', attempts: item.attempts + 1 },
          })
          this.emitFailedAlert({
            orderId: item.orderId,
            queueId: item.id,
            lastError: 'Pedido no encontrado en BD',
            attempts: item.attempts + 1,
          })
          continue
        }

        // Guard de idempotencia: si el pedido ya tiene vendeloOrderId, ya se creó
        // en Vendelo en una corrida anterior. No volver a llamar a createOrder.
        if (order.vendeloOrderId) {
          await this.prisma.client.vendeloOrderQueue.update({
            where: { id: item.id },
            data: { status: 'SENT', attempts: item.attempts + 1 },
          })
          this.logger.warn(
            `[VendeloOrderQueue] Skip: pedido ya tenía vendeloOrderId=${order.vendeloOrderId} ${ctx}`,
          )
          continue
        }

        this.logger.log(`[VendeloOrderQueue] Enviando a Vendelo ${ctx}`)

        // Mapear desde Prisma al tipo de dominio Order
        const domainOrder = {
          ...order,
          shippingAddress: order.shippingAddress as unknown as import('@motek/domain').ShippingAddress,
          buyer: {
            idType: order.buyerIdType as import('@motek/domain').BuyerIdType,
            idNumber: order.buyerIdNumber,
            businessName: order.buyerBusinessName ?? undefined,
          },
          items: order.items.map((i) => ({
            id: i.id,
            orderId: i.orderId,
            productId: i.productId,
            quantity: i.quantity,
            priceAtPurchase: i.priceAtPurchase,
            productSnapshot: {
              sku: i.product.sku,
              name: i.product.name,
              weightKg: i.product.weightKg,
              heightCm: i.product.heightCm,
              widthCm: i.product.widthCm,
              lengthCm: i.product.lengthCm,
            },
          })),
        } as import('@motek/domain').Order

        const vendeloRes = await this.vendeloService.createOrder(domainOrder, order.contactEmail)

        const vendeloOrderId = vendeloRes.items?.[0]?.id as string | undefined

        await this.prisma.client.$transaction([
          this.prisma.client.vendeloOrderQueue.update({
            where: { id: item.id },
            data: { status: 'SENT', attempts: item.attempts + 1 },
          }),
          // Guard de commit: solo actualiza si vendeloOrderId sigue NULL. Si otra
          // corrida ya lo escribió antes que esta, count===0 y queda registrado
          // en el log — la orden duplicada en Vendelo quedará sin tracking.
          ...(vendeloOrderId
            ? [this.prisma.client.order.updateMany({
                where: { id: order.id, vendeloOrderId: null },
                data: { vendeloOrderId },
              })]
            : []),
        ])

        this.logger.log(
          `[VendeloOrderQueue] OK — vendeloOrderId=${vendeloOrderId ?? 'n/a'} ${ctx}`,
        )
      } catch (e) {
        const attempts = item.attempts + 1
        const backoffSecs = BACKOFF_SECONDS[attempts - 1] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]
        const nextRetry = new Date(Date.now() + backoffSecs * 1000)
        const status = attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING'

        await this.prisma.client.vendeloOrderQueue.update({
          where: { id: item.id },
          data: { attempts, lastError: String(e), status, nextRetry, processingStartedAt: null },
        })

        if (status === 'FAILED') {
          this.emitFailedAlert({
            orderId: item.orderId,
            queueId: item.id,
            lastError: String(e),
            attempts,
          })
        } else {
          this.logger.warn(
            `[VendeloOrderQueue] Reintento programado — status=${status} nextRetry=${nextRetry.toISOString()} ${ctx}: ${e}`,
          )
        }
      }
    }
  }

  /**
   * Libera filas atascadas en PROCESSING por más de 5 min — cubre el caso de un
   * contenedor Cloud Run que crashea mid-process antes de actualizar el status.
   */
  private async releaseOrphanedRows(): Promise<void> {
    const staleSince = new Date(Date.now() - ORPHAN_THRESHOLD_MS)
    const released = await this.prisma.client.vendeloOrderQueue.updateMany({
      where: { status: 'PROCESSING', processingStartedAt: { lt: staleSince } },
      data: { status: 'PENDING', processingStartedAt: null },
    })
    if (released.count > 0) {
      this.logger.warn(`[VendeloOrderQueue] Liberadas ${released.count} fila(s) huérfana(s) en PROCESSING`)
    }
  }

  async findFailed(limit = 50) {
    return this.prisma.client.vendeloOrderQueue.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  private emitFailedAlert(payload: {
    orderId: string
    queueId: string
    lastError: string
    attempts: number
  }): void {
    // Emitir como JSON estructurado a stderr para Railway/Logtail.
    // Nivel CRITICAL indica que un cliente pagó pero su pedido no se creó en Vendelo.
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'CRITICAL',
      alert: 'VENDELO_ORDER_QUEUE_FAILED',
      message: `[VendeloOrderQueue] CRITICAL — pedido NO enviado a Vendelo tras ${payload.attempts} intentos. El cliente pagó pero no se generará envío automáticamente.`,
      orderId: payload.orderId,
      queueId: payload.queueId,
      lastError: payload.lastError,
      attempts: payload.attempts,
      action: 'Revisar VendeloOrderQueue y crear la orden manualmente si es necesario.',
    }
    process.stderr.write(JSON.stringify(entry) + '\n')
  }
}
