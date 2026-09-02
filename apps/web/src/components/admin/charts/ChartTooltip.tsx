'use client'

import type { ReactNode } from 'react'

export interface ChartTooltipProps {
  /** Categoría o fecha del punto — va arriba, en versalitas. */
  label: ReactNode
  /** El valor manda: es lo que el lector vino a buscar. */
  value: ReactNode
  /** Detalle secundario opcional (p. ej. «21 pedidos pagados»). */
  detail?: ReactNode
  /**
   * Color de la serie. Se pinta como un trazo corto junto al valor: a esta
   * densidad un cuadro relleno es tinta de peso de dato haciendo el trabajo de
   * una etiqueta.
   */
  seriesColor?: string
}

/**
 * Cuerpo compartido de los tooltips del dashboard.
 *
 * Antes vivía dentro de `RevenueChart` y se habría duplicado en cada gráfico
 * nuevo. La jerarquía va invertida respecto a la leyenda: aquí el lector ya
 * sabe qué serie mira y lo que quiere es el número.
 */
export function ChartTooltip({ label, value, detail, seriesColor }: ChartTooltipProps) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 shadow-[var(--shadow-lg)]">
      <p className="mb-1 text-[11px] tracking-widest text-[var(--c-text-3)] uppercase">{label}</p>
      <div className="flex items-center gap-2">
        {seriesColor && (
          <span
            aria-hidden="true"
            className="h-0.5 w-3 shrink-0 rounded-full"
            style={{ background: seriesColor }}
          />
        )}
        <p className="text-base font-bold text-[var(--c-text)] tabular-nums">{value}</p>
      </div>
      {detail && <p className="mt-1 text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">{detail}</p>}
    </div>
  )
}
