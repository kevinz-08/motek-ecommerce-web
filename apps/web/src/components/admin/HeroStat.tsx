import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { DeltaBadge, type GoodDirection } from '@/components/admin/DeltaBadge'
import type { PercentDelta } from '@/lib/format'

export interface HeroStatProps {
  label: string
  /** Ya formateado. Va a 48 px con cifras proporcionales. */
  value: string
  delta?: PercentDelta | null
  goodWhen?: GoodDirection
  comparedTo?: string
  /** Sparkline u otro acompañante gráfico, alineado a la derecha del pie. */
  trend?: ReactNode
  /** Texto de reemplazo cuando no hay variación que mostrar. */
  fallbackNote?: string
}

/**
 * La cifra que manda el dashboard.
 *
 * Debe haber exactamente una por pantalla: si todo es grande, nada lo es. Usa
 * las cifras proporcionales por defecto de la fuente en vez de `tabular-nums`
 * — a 48 px las tabulares dejan huecos visibles entre dígitos.
 */
export function HeroStat({
  label,
  value,
  delta,
  goodWhen = 'up',
  comparedTo,
  trend,
  fallbackNote,
}: HeroStatProps) {
  return (
    <Card className="flex flex-col gap-3.5">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--c-text-3)] uppercase">
        {label}
      </p>

      <p className="text-[48px] leading-none font-bold tracking-[-0.03em] text-[var(--c-text)]">
        {value}
      </p>

      <div className="flex items-center justify-between gap-4">
        {delta ? (
          <DeltaBadge delta={delta} goodWhen={goodWhen} comparedTo={comparedTo} />
        ) : (
          <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-4)]">
            {fallbackNote ?? 'Sin período anterior para comparar'}
          </span>
        )}
        {trend && <div className="shrink-0">{trend}</div>}
      </div>
    </Card>
  )
}
