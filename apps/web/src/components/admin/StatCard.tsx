import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Card } from '@/components/ui/Card'
import { DeltaBadge, type GoodDirection } from '@/components/admin/DeltaBadge'
import type { PercentDelta } from '@/lib/format'

export interface StatCardProps {
  label: string
  value: string
  /** Nota al pie. Se muestra junto a la variación cuando ambas están presentes. */
  sub?: string
  icon?: ReactNode
  /** `alert` resalta la métrica en color de advertencia (p. ej. pedidos pendientes). */
  tone?: 'default' | 'alert'
  /** Variación contra el período anterior, o `null` si no hay base de comparación. */
  delta?: PercentDelta | null
  /** Hacia dónde es bueno que se mueva esta métrica — ver `DeltaBadge`. */
  goodWhen?: GoodDirection
}

/**
 * Métrica de apoyo del dashboard: subordinada a `HeroStat` en tamaño, misma
 * anatomía (etiqueta, valor, variación). Usa `tabular-nums` porque a 28 px
 * estas tarjetas se leen en fila y sus dígitos deben alinearse.
 */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  delta,
  goodWhen = 'up',
}: StatCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--c-text-3)] uppercase">
          {label}
        </p>
        {icon && (
          <span className={cn('shrink-0', tone === 'alert' ? 'text-[var(--c-warning)]' : 'text-[var(--c-text-4)]')}>
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          'text-[28px] leading-none font-bold tracking-[-0.02em] tabular-nums',
          tone === 'alert' ? 'text-[var(--c-warning)]' : 'text-[var(--c-text)]',
        )}
      >
        {value}
      </p>

      {(delta || sub) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {delta && <DeltaBadge delta={delta} goodWhen={goodWhen} />}
          {sub && (
            <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-4)]">{sub}</span>
          )}
        </div>
      )}
    </Card>
  )
}
