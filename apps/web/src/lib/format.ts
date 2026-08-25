export function formatCOP(cents: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

/**
 * Versión compacta para ejes y etiquetas de gráfico, donde el monto completo no
 * cabe: `$1,5 M`. Los ejes deben caer en números redondos, así que no se
 * muestran decimales de peso.
 */
export function formatCOPCompact(cents: number): string {
  if (cents === 0) return '$0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    notation: 'compact',
  }).format(cents / 100)
}

export type DeltaDirection = 'up' | 'down' | 'flat'

export interface PercentDelta {
  /** Ya formateado y con signo: `+12,4 %`. */
  label: string
  direction: DeltaDirection
}

/**
 * Variación porcentual contra el período anterior.
 *
 * Devuelve `null` cuando no hay base contra la cual comparar (período anterior
 * en cero o inexistente): un «+100 %» sobre cero no significa nada y es peor que
 * no mostrar variación.
 */
export function formatPercentDelta(current: number, previous: number): PercentDelta | null {
  if (previous <= 0) return null

  const change = ((current - previous) / previous) * 100
  const direction: DeltaDirection = Math.abs(change) < 0.05 ? 'flat' : change > 0 ? 'up' : 'down'
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : ''
  const magnitude = Math.abs(change).toLocaleString('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return { label: `${sign}${magnitude} %`, direction }
}

export function formatDateShort(date?: Date | string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
