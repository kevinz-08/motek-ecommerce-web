export type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL'

export interface AlertContext {
  [key: string]: unknown
}

/**
 * Puerto de notificaciones de alerta del sistema.
 *
 * Desacopla al emisor de la alerta (ej. WalletAlertCron) del canal de envío
 * (log, Slack, Telegram, email). Para cambiar el canal: registrar una nueva
 * implementación como ALERT_NOTIFICATION_PORT en infrastructure.module.ts
 * sin modificar el código del cron.
 */
export interface IAlertNotificationPort {
  sendAlert(level: AlertLevel, message: string, context?: AlertContext): Promise<void>
}
