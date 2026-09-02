import Link from 'next/link'
import { cn } from '@/lib/cn'
import type { RevenueRange } from '@/infrastructure/repositories/date-buckets'

export const RANGE_OPTIONS: Array<{ value: RevenueRange; label: string }> = [
  { value: '2w', label: '2 semanas' },
  { value: '1m', label: '1 mes' },
  { value: '3m', label: '3 meses' },
  { value: 'all', label: 'Histórico' },
]

export const DEFAULT_RANGE: RevenueRange = '2w'

/** Etiqueta legible de un rango, para los subtítulos de los módulos. */
export function rangeLabel(range: RevenueRange): string {
  return RANGE_OPTIONS.find((o) => o.value === range)?.label ?? ''
}

/** Normaliza el `?range=` de la URL, cayendo al rango por defecto si no es válido. */
export function parseRange(value?: string): RevenueRange {
  return RANGE_OPTIONS.some((o) => o.value === value) ? (value as RevenueRange) : DEFAULT_RANGE
}

/**
 * Presets de rango del dashboard.
 *
 * Va en una sola fila arriba de todo y da alcance a TODA la pantalla, no solo
 * al gráfico de ingresos como antes: si cada módulo tuviera su propio rango, las
 * cifras dejarían de concordar entre sí.
 *
 * Navega por `searchParams` en vez de estado de cliente, así que el rango se
 * puede compartir por enlace y la página se recalcula en el servidor.
 */
export function RangeFilter({ current }: { current: RevenueRange }) {
  return (
    <nav
      aria-label="Rango de fechas"
      className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--c-border)] bg-[var(--c-surface)] p-[3px]"
    >
      {RANGE_OPTIONS.map((option) => {
        const isCurrent = option.value === current
        return (
          <Link
            key={option.value}
            href={option.value === DEFAULT_RANGE ? '/admin' : `/admin?range=${option.value}`}
            aria-current={isCurrent ? 'page' : undefined}
            className={cn(
              'rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]',
              isCurrent
                ? 'bg-[var(--c-accent)] text-[var(--c-text-on-accent)]'
                : 'text-[var(--c-text-3)] hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]',
            )}
          >
            {option.label}
          </Link>
        )
      })}
    </nav>
  )
}
