import { XCircle } from 'lucide-react'
import type { StatusBreakdown } from '@/infrastructure/repositories/PrismaDashboardRepository'

/**
 * Etapas en su orden real. La rampa es de un solo tono y luminosidad monótona:
 * el orden es información, así que lo lleva el color. Reordenarlas cambiaría el
 * significado, que es justo lo que distingue una escala ordinal de una
 * categórica.
 */
const STAGES = [
  { key: 'pending', label: 'Pendiente', token: 'var(--c-chart-step-1)' },
  { key: 'paid', label: 'Pagado', token: 'var(--c-chart-step-2)' },
  { key: 'shipped', label: 'Enviado', token: 'var(--c-chart-step-3)' },
  { key: 'delivered', label: 'Entregado', token: 'var(--c-chart-step-4)' },
] as const

export function OrderLifecycle({ counts }: { counts: StatusBreakdown }) {
  const stages = STAGES.map((s) => ({ ...s, count: counts[s.key] }))
  const max = Math.max(...stages.map((s) => s.count), 1)
  const total = stages.reduce((sum, s) => sum + s.count, 0) + counts.cancelled

  if (total === 0) {
    return (
      <p className="py-10 text-center text-[length:var(--text-body-sm)] text-[var(--c-text-4)]">
        Sin pedidos en este período
      </p>
    )
  }

  const cancelledShare = total > 0 ? (counts.cancelled / total) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      {stages.map((stage) => (
        <div key={stage.key} className="flex flex-col gap-[7px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">{stage.label}</span>
            <span className="text-[length:var(--text-body-sm)] font-bold text-[var(--c-text)] tabular-nums">
              {stage.count}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--c-chart-track)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(stage.count / max) * 100}%`, background: stage.token }}
            />
          </div>
        </div>
      ))}

      {/*
        CANCELLED no entra en la rampa: es un estado, no una etapa del recorrido.
        Va con icono y etiqueta, nunca solo por color.
      */}
      <div className="mt-1 flex items-center gap-2 border-t border-[var(--c-border)] pt-4">
        <XCircle className="h-3.5 w-3.5 shrink-0 text-[var(--c-danger)]" aria-hidden="true" />
        <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">
          {counts.cancelled} {counts.cancelled === 1 ? 'cancelado' : 'cancelados'}
        </span>
        <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-4)] tabular-nums">
          · {cancelledShare.toLocaleString('es-CO', { maximumFractionDigits: 1 })} % de lo creado
        </span>
      </div>
    </div>
  )
}
