import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { PercentDelta } from '@/lib/format'

/**
 * Hacia dónde es «bueno» que se mueva la métrica. Subir no siempre es mejorar:
 * más pedidos pendientes de pago es peor, no mejor.
 *  - `up`      ingresos, pedidos, clientes.
 *  - `down`    pendientes, cancelados, agotados.
 *  - `neutral` métricas sin lectura de bueno/malo — la variación se muestra en
 *              tinta secundaria, sin teñirla de verde ni rojo.
 */
export type GoodDirection = 'up' | 'down' | 'neutral'

export interface DeltaBadgeProps {
  delta: PercentDelta
  goodWhen?: GoodDirection
  /** Contra qué se compara. Una variación sin período nombrado no dice nada. */
  comparedTo?: string
  className?: string
}

const ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus } as const

export function DeltaBadge({ delta, goodWhen = 'up', comparedTo, className }: DeltaBadgeProps) {
  const Icon = ICONS[delta.direction]

  const tone =
    goodWhen === 'neutral' || delta.direction === 'flat'
      ? 'text-[var(--c-text-3)]'
      : (delta.direction === 'up') === (goodWhen === 'up')
        ? 'text-[var(--c-success)]'
        : 'text-[var(--c-danger)]'

  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', tone)} aria-hidden="true" />
      <span className={cn('text-[length:var(--text-body-sm)] font-semibold tabular-nums', tone)}>
        {delta.label}
      </span>
      {comparedTo && (
        <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-4)]">{comparedTo}</span>
      )}
    </span>
  )
}
