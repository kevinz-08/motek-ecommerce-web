import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common'
import * as Sentry from '@sentry/nestjs'
import {
  IOrderRepository,
  IVendeloShippingPort,
  IShipmentRepository,
  SyncShipmentStatus,
  VendeloOrderNotFoundError,
  ActiveVendeloOrder,
} from '@motek/domain'
import {
  ORDER_REPOSITORY,
  SHIPMENT_REPOSITORY,
  VENDELO_SHIPPING_PORT,
} from '../../infrastructure/injection-tokens'
import { VendeloHttpClient } from '../../infrastructure/services/VendeloHttpClient'

/**
 * Cron de polling que sincroniza el estado de envíos activos contra Vendelo.
 *
 * **Por qué existe:**
 * Venndelo no tiene webhooks abiertos para comercios regulares (su endpoint
 * `/v1/admin/chatbot/connections` rechaza con `Provider id inválido` si
 * no eres Lucidbot/Chatby). Hasta que abran webhooks, polling es la única
 * vía para detectar transiciones de estado (PREPARING → SHIPPED → DELIVERED).
 *
 * **Estrategia (local-driven):**
 *   1. Consulta nuestra BD por pedidos con `vendeloOrderId` y estado vivo
 *      (`IOrderRepository.findActiveVendeloOrders(batchSize)`).
 *   2. Por cada uno: `GET /v1/admin/orders/{id}` a Vendelo, con delay
 *      entre requests para no saturar.
 *   3. Mapea `VendeloOrderSnapshot.status` → `ShipmentStatus`.
 *   4. Llama al use case `SyncShipmentStatus` (idempotente, atómico).
 *
 * **Garantías:**
 *   - Circuit breaker del HttpClient: si Vendelo está caído, skip cycle.
 *   - Polling solo de pedidos nuestros (filtro por `vendeloOrderId IS NOT NULL`).
 *   - Idempotencia ante múltiples instancias Cloud Run vía atomic UPDATE en
 *     `SyncShipmentStatus.shipmentRepo.atomicUpdateStatus`.
 *   - Kill switch vía `VENDELO_POLL_ENABLED=false` (sin redeploy).
 *
 * **Logs estructurados:**
 *   Cada tick emite una línea JSON parseable por Cloud Logging que incluye
 *   cycle timestamp, batchSize, transitionsApplied, transitionsSkipped,
 *   errors, circuitState y durationMs.
 */
@Injectable()
export class VendeloShipmentPollerCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VendeloShipmentPollerCron.name)
  private timer?: NodeJS.Timeout

  /** Intervalo entre ticks. Default 5 min. */
  private readonly intervalMs: number
  /** Máximo de pedidos a procesar por tick. */
  private readonly batchSize: number
  /** Delay entre cada GET a Vendelo dentro del mismo tick (suaviza la carga). */
  private readonly requestDelayMs: number
  /** Kill switch operativo — sin redeploy. */
  private readonly enabled: boolean

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: IOrderRepository,
    @Inject(SHIPMENT_REPOSITORY) private readonly shipmentRepo: IShipmentRepository,
    @Inject(VENDELO_SHIPPING_PORT) private readonly vendeloPort: IVendeloShippingPort,
    private readonly httpClient: VendeloHttpClient,
  ) {
    this.intervalMs     = Number(process.env['VENDELO_POLL_INTERVAL_MS'] ?? 5 * 60 * 1000)
    this.batchSize      = Number(process.env['VENDELO_POLL_BATCH_SIZE'] ?? 50)
    this.requestDelayMs = Number(process.env['VENDELO_POLL_REQUEST_DELAY_MS'] ?? 100)
    this.enabled        = (process.env['VENDELO_POLL_ENABLED'] ?? 'true') === 'true'
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.warn('[VendeloShipmentPoller] Deshabilitado por VENDELO_POLL_ENABLED=false')
      return
    }
    this.logger.log(
      `[VendeloShipmentPoller] Iniciando — intervalo=${this.intervalMs}ms, batch=${this.batchSize}, delay=${this.requestDelayMs}ms`,
    )
    this.timer = setInterval(() => {
      this.tick().catch((e) => {
        this.logger.error(`[VendeloShipmentPoller] Excepción no controlada en tick: ${e}`)
        Sentry.captureException(e, { tags: { service: 'VendeloShipmentPoller' } })
      })
    }, this.intervalMs)
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  /**
   * Un ciclo de polling. Público para poder invocarlo manualmente desde un
   * endpoint admin o desde tests sin esperar al timer.
   */
  async tick(): Promise<TickResult> {
    const cycleStart = Date.now()
    const cycleIso = new Date().toISOString()

    // Circuit breaker abierto → no abrumamos más a Vendelo, esperamos al siguiente ciclo.
    const circuitState = this.httpClient.getCircuitState()
    if (circuitState === 'OPEN') {
      this.logger.warn('[VendeloShipmentPoller] Skip — circuit breaker OPEN')
      return this.buildResult(cycleIso, [], 0, 0, 0, circuitState, cycleStart)
    }

    let orders: ActiveVendeloOrder[]
    try {
      orders = await this.orderRepo.findActiveVendeloOrders(this.batchSize)
    } catch (e) {
      this.logger.error(`[VendeloShipmentPoller] Error consultando BD: ${e}`)
      Sentry.captureException(e, { tags: { service: 'VendeloShipmentPoller', step: 'findActive' } })
      return this.buildResult(cycleIso, [], 0, 0, 1, circuitState, cycleStart)
    }

    if (orders.length === 0) {
      return this.buildResult(cycleIso, orders, 0, 0, 0, circuitState, cycleStart)
    }

    const syncUseCase = new SyncShipmentStatus(this.shipmentRepo, this.orderRepo)
    let applied = 0
    let skipped = 0
    let errors  = 0

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i]
      try {
        const snapshot = await this.vendeloPort.getOrder(order.vendeloOrderId)
        const result = await syncUseCase.execute({
          orderId: order.orderId,
          vendelo_status: snapshot.status,
          trackingNumber: snapshot.trackingNumber ?? undefined,
          carrier: snapshot.carrier ?? undefined,
        })
        if (!result.ok) {
          this.logger.warn(
            `[VendeloShipmentPoller] SyncShipmentStatus fallo orderId=${order.orderId}: ${result.error.code} ${result.error.message}`,
          )
          errors++
        } else if (result.value.updated) {
          applied++
        } else {
          skipped++
        }
      } catch (e) {
        if (e instanceof VendeloOrderNotFoundError) {
          // Vendelo no conoce este pedido — caso raro pero esperable.
          // No es fatal: skip y continúa para no atascar el cron.
          this.logger.warn(
            `[VendeloShipmentPoller] Vendelo no encontró vendeloOrderId=${e.vendeloOrderId} (orderId=${order.orderId}) — skip`,
          )
          errors++
        } else {
          this.logger.warn(
            `[VendeloShipmentPoller] Error polling orderId=${order.orderId}: ${e instanceof Error ? e.message : e}`,
          )
          Sentry.captureException(e, {
            tags: { service: 'VendeloShipmentPoller', step: 'pollOrder' },
            extra: { orderId: order.orderId, vendeloOrderId: order.vendeloOrderId },
          })
          errors++
        }
      }
      // Delay entre requests dentro del mismo tick — suaviza la carga sobre Vendelo
      // y permite que el circuit breaker reaccione antes de seguir saturando.
      if (i < orders.length - 1 && this.requestDelayMs > 0) {
        await this.sleep(this.requestDelayMs)
      }
    }

    return this.buildResult(cycleIso, orders, applied, skipped, errors, circuitState, cycleStart)
  }

  private buildResult(
    cycle: string,
    orders: ActiveVendeloOrder[],
    applied: number,
    skipped: number,
    errors: number,
    circuitState: string,
    startMs: number,
  ): TickResult {
    const result: TickResult = {
      cycle,
      batchSize: orders.length,
      transitionsApplied: applied,
      transitionsSkipped: skipped,
      errors,
      circuitState,
      durationMs: Date.now() - startMs,
    }
    // Log estructurado JSON para Cloud Logging — clave "service" facilita filtros y alertas
    this.logger.log(JSON.stringify({ service: 'VendeloShipmentPoller', ...result }))
    return result
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export interface TickResult {
  cycle: string
  batchSize: number
  transitionsApplied: number
  transitionsSkipped: number
  errors: number
  circuitState: string
  durationMs: number
}
