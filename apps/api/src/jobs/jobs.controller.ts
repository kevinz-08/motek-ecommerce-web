import {
  Controller, HttpCode, InternalServerErrorException, Logger, NotFoundException, Param, Post, UseGuards,
} from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from '../auth/decorators/public.decorator'
import { EmailQueueService } from '../infrastructure/services/EmailQueueService'
import { ExpiredOrdersCleanupService } from '../infrastructure/services/ExpiredOrdersCleanupService'
import { VendeloOrderQueueService } from '../infrastructure/services/VendeloOrderQueueService'
import { WompiReconciliationService } from '../infrastructure/services/WompiReconciliationService'
import { VendeloShipmentPollerCron } from '../vendelo/services/VendeloShipmentPollerCron'
import { WalletAlertCron } from '../vendelo/services/WalletAlertCron'
import { CronSecretGuard } from './cron-secret.guard'

/**
 * Tareas que Cloud Scheduler dispara con `POST /internal/jobs/:job`.
 * Frecuencia sugerida (ver docs/despliegue-produccion.md):
 *
 * | job              | cada    | qué hace                                            |
 * |------------------|---------|-----------------------------------------------------|
 * | vendelo-orders   | 2 min   | envía a Vendelo los pedidos pagados en cola         |
 * | emails           | 2 min   | envía los correos de confirmación en cola           |
 * | shipments        | 10 min  | sincroniza el estado de los envíos (polling en lote) |
 * | wompi-reconcile  | 15 min  | confirma pagos de Wompi cuyo webhook no llegó       |
 * | expired-orders   | 1 h     | cancela pedidos PENDING de más de 2 h               |
 * | vendelo-wallet   | 1 día   | alerta si el saldo de la billetera Vendelo es bajo  |
 */
export const JOB_NAMES = [
  'vendelo-orders',
  'emails',
  'shipments',
  'wompi-reconcile',
  'expired-orders',
  'vendelo-wallet',
] as const

export type JobName = (typeof JOB_NAMES)[number]

/**
 * Endpoint de tareas programadas. Responde cuando la tarea TERMINA: en Cloud
 * Run con CPU solo durante peticiones, el trabajo tiene que ocurrir dentro de
 * la request. Todas las tareas son seguras ante disparos concurrentes (claims
 * atómicos, transiciones idempotentes), así que un reintento o un solapamiento
 * no duplica efectos.
 */
@ApiExcludeController()
@Controller('internal/jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name)
  private readonly jobs: Record<JobName, () => Promise<unknown>>

  constructor(
    vendeloOrderQueue: VendeloOrderQueueService,
    emailQueue: EmailQueueService,
    shipmentPoller: VendeloShipmentPollerCron,
    wompiReconciliation: WompiReconciliationService,
    expiredOrders: ExpiredOrdersCleanupService,
    walletAlert: WalletAlertCron,
  ) {
    this.jobs = {
      'vendelo-orders': () => vendeloOrderQueue.processNext(),
      'emails': () => emailQueue.processNext(),
      'shipments': async () => (shipmentPoller.isEnabled() ? shipmentPoller.tick() : { skipped: 'VENDELO_POLL_ENABLED=false' }),
      'wompi-reconcile': () => wompiReconciliation.reconcile(),
      'expired-orders': () => expiredOrders.cancelExpiredOrders(),
      'vendelo-wallet': () => walletAlert.checkWalletBalance(),
    }
  }

  @Post(':job')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @UseGuards(CronSecretGuard)
  async run(@Param('job') job: string) {
    if (!(JOB_NAMES as readonly string[]).includes(job)) {
      throw new NotFoundException(`Tarea desconocida: ${job}`)
    }

    const start = Date.now()
    try {
      const result = await this.jobs[job as JobName]()
      const durationMs = Date.now() - start
      this.logger.log(JSON.stringify({ service: 'ScheduledJob', job, ok: true, durationMs }))
      return { job, ok: true, durationMs, ...(result && typeof result === 'object' ? { result } : {}) }
    } catch (e) {
      const durationMs = Date.now() - start
      this.logger.error(JSON.stringify({
        service: 'ScheduledJob', job, ok: false, durationMs, error: e instanceof Error ? e.message : String(e),
      }))
      // 500 → Cloud Scheduler registra el fallo y aplica su política de reintentos
      throw new InternalServerErrorException(`La tarea ${job} falló`)
    }
  }
}
