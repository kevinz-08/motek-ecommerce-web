import { Injectable, Logger, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import type { IAlertNotificationPort } from '@motek/domain'
import { VendeloService } from '../../infrastructure/services/VendeloService'
import { ALERT_NOTIFICATION_PORT } from '../../infrastructure/injection-tokens'

/** Intervalo de chequeo: una vez al día (24 horas) */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

@Injectable()
export class WalletAlertCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletAlertCron.name)
  private timer?: NodeJS.Timeout

  constructor(
    private readonly vendeloService: VendeloService,
    @Inject(ALERT_NOTIFICATION_PORT)
    private readonly alertPort: IAlertNotificationPort,
  ) {}

  onModuleInit(): void {
    // Ejecutar al inicio para detectar problemas al arrancar el servicio
    this.checkWalletBalance().catch((e) =>
      this.logger.error(`[WalletAlertCron] Error en chequeo inicial: ${e}`),
    )

    this.timer = setInterval(() => {
      this.checkWalletBalance().catch((e) =>
        this.logger.error(`[WalletAlertCron] Error en chequeo periódico: ${e}`),
      )
    }, CHECK_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async checkWalletBalance(): Promise<void> {
    // Leer el umbral en runtime para que un cambio de variable de entorno
    // se aplique en el próximo deploy sin cambios de código
    const threshold = Number(process.env['VENDELO_WALLET_ALERT_THRESHOLD'] ?? 50_000)

    let balance: number
    let currency: string

    try {
      const wallet = await this.vendeloService.getWalletBalance()
      balance = wallet.balance
      currency = wallet.currency
    } catch (e) {
      this.logger.error(`[WalletAlertCron] No se pudo consultar el saldo de la wallet: ${e}`)
      await this.alertPort.sendAlert('CRITICAL', 'No se pudo consultar el saldo de la wallet Vendelo', {
        error: String(e),
      })
      return
    }

    this.logger.log(`[WalletAlertCron] Saldo actual: ${balance} ${currency} (umbral: ${threshold})`)

    if (balance < threshold) {
      await this.alertPort.sendAlert('CRITICAL', 'Saldo de wallet Vendelo por debajo del umbral', {
        balance,
        currency,
        threshold,
        action: 'Recargar saldo en https://app.vendelo.com/wallet',
      })
    }
  }
}
