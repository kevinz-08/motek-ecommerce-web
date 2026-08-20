import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common'
import { ConfirmPayment, IOrderRepository } from '@motek/domain'
import { ORDER_REPOSITORY } from '../injection-tokens'
import { WompiService } from './WompiService'
import { PrismaService } from '../database/prisma.service'

/** Intervalo entre cada ciclo de reconciliación: 15 minutos */
const RECONCILE_INTERVAL_MS = 15 * 60 * 1000

/**
 * Ventana mínima desde la creación del pedido antes de reconciliarlo.
 * Da tiempo suficiente para que Wompi entregue el webhook normalmente
 * antes de que este job intervenga.
 */
const MIN_PENDING_AGE_MS = 15 * 60 * 1000

/** Máximo de pedidos procesados por ciclo (evita sobrecarga en la primera ejecución) */
const BATCH_SIZE = 20

/**
 * Consulta activamente el estado de transacciones Wompi cuyo webhook
 * nunca llegó. Corre cada 15 minutos y solo actúa sobre pedidos
 * con al menos 15 minutos de antigüedad que tengan un externalId.
 *
 * Escenario que cubre: el usuario completó el pago en Wompi, Wompi intentó
 * entregar el webhook pero falló (red, reinicio del servidor, misconfiguration
 * temporal), y el pedido quedó en PENDING indefinidamente.
 */
@Injectable()
export class WompiReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WompiReconciliationService.name)
  private timer?: NodeJS.Timeout

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: IOrderRepository,
    private readonly wompiService: WompiService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.reconcile().catch((e) =>
        this.logger.error(`Error en ciclo de reconciliación: ${e}`),
      )
    }, RECONCILE_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async reconcile(): Promise<void> {
    const cutoff = new Date(Date.now() - MIN_PENDING_AGE_MS)

    const staleOrders = await this.prisma.client.order.findMany({
      where: {
        status: 'PENDING',
        paymentProvider: 'WOMPI',
        createdAt: { lt: cutoff },
        payment: { externalId: { not: null } },
      },
      include: { payment: { select: { externalId: true } } },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
    })

    if (staleOrders.length === 0) return

    this.logger.log(`[Reconciliación] ${staleOrders.length} pedido(s) PENDING con más de 15 min`)

    for (const order of staleOrders) {
      const externalId = order.payment?.externalId
      if (!externalId) continue

      try {
        const paymentStatus = await this.wompiService.getTransactionStatus(externalId)

        if (paymentStatus === 'PENDING') {
          this.logger.log(
            `[Reconciliación] pedido=${order.id} externalId=${externalId} sigue PENDING en Wompi — omitiendo`,
          )
          continue
        }

        const confirmPayment = new ConfirmPayment(this.orderRepo)
        const result = await confirmPayment.execute({
          orderId: order.id,
          externalId,
          status: paymentStatus,
        })

        if (result.ok) {
          this.logger.log(
            `[Reconciliación] pedido=${order.id} reconciliado status=${paymentStatus} stateChanged=${result.value.stateChanged}`,
          )
        } else {
          this.logger.error(
            `[Reconciliación] pedido=${order.id} ConfirmPayment error=${result.error.code}`,
          )
        }
      } catch (e) {
        this.logger.error(
          `[Reconciliación] pedido=${order.id} error al consultar Wompi: ${e}`,
        )
      }
    }
  }
}
