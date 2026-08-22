import { Injectable, Logger } from '@nestjs/common'
import type { IAlertNotificationPort, AlertLevel, AlertContext } from '@motek/domain'

/**
 * Implementación de IAlertNotificationPort que escribe en el logger estructurado de NestJS.
 *
 * Para cambiar el canal de notificaciones (Slack, Telegram, email) sin modificar
 * el código del emisor: crear una nueva implementación y registrarla como
 * ALERT_NOTIFICATION_PORT en infrastructure.module.ts.
 */
@Injectable()
export class LogAlertNotificationService implements IAlertNotificationPort {
  private readonly logger = new Logger('AlertNotification')

  async sendAlert(level: AlertLevel, message: string, context?: AlertContext): Promise<void> {
    const payload = { level, message, ...(context ?? {}) }

    switch (level) {
      case 'CRITICAL':
        this.logger.error(JSON.stringify(payload))
        break
      case 'WARNING':
        this.logger.warn(JSON.stringify(payload))
        break
      default:
        this.logger.log(JSON.stringify(payload))
    }
  }
}
