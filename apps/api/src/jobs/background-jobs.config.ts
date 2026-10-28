/**
 * Cómo se ejecutan las tareas en segundo plano (colas de Vendelo y correos,
 * polling de envíos, reconciliación de Wompi, limpieza de pedidos vencidos y
 * alerta de saldo de Vendelo).
 *
 * - `interval` (default): cada servicio programa su propio `setInterval` al
 *   arrancar. Sirve en desarrollo y en servidores siempre encendidos.
 * - `scheduler`: no se programa ningún timer. Las tareas se disparan desde
 *   afuera (Cloud Scheduler) con `POST /internal/jobs/:job`, ver
 *   jobs.controller.ts. Permite que Cloud Run escale a cero: con CPU solo
 *   durante las peticiones, un `setInterval` no correría de forma confiable.
 */
export type BackgroundJobsMode = 'interval' | 'scheduler'

export function getBackgroundJobsMode(): BackgroundJobsMode {
  const raw = (process.env['BACKGROUND_JOBS_MODE'] ?? 'interval').trim().toLowerCase()
  if (raw !== 'interval' && raw !== 'scheduler') {
    throw new Error(`BACKGROUND_JOBS_MODE inválido: "${raw}" (valores: interval | scheduler)`)
  }
  return raw
}

/** true si los servicios deben programar sus propios timers. */
export function intervalJobsEnabled(): boolean {
  return getBackgroundJobsMode() === 'interval'
}
