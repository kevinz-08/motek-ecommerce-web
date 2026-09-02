import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

export interface ChartCardProps {
  /** Versalitas de 11 px — nombra la métrica. */
  eyebrow: string
  /** Línea de apoyo: el período, la unidad o el corte aplicado. */
  subtitle?: ReactNode
  /** Controles del módulo (pestañas, enlaces) alineados a la derecha del encabezado. */
  action?: ReactNode
  /** Dato de contexto que acompaña al encabezado (p. ej. el mejor día). */
  aside?: ReactNode
  children: ReactNode
  className?: string
  /** Pie separado por una regla — enlaces del tipo «Gestionar inventario». */
  footer?: ReactNode
}

/**
 * Contenedor común de los módulos del dashboard.
 *
 * Existe para que el encabezado (versalitas + subtítulo + ranura de acción) se
 * declare una sola vez: antes cada tarjeta de `admin/page.tsx` repetía el mismo
 * bloque de markup y las tres se iban desincronizando.
 */
export function ChartCard({
  eyebrow,
  subtitle,
  action,
  aside,
  children,
  className,
  footer,
}: ChartCardProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--c-text-3)] uppercase">
            {eyebrow}
          </p>
          {subtitle && (
            <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">{subtitle}</p>
          )}
        </div>
        {aside && <div className="shrink-0 text-right">{aside}</div>}
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="flex-1">{children}</div>

      {footer && (
        <div className="mt-5 border-t border-[var(--c-border)] pt-4">{footer}</div>
      )}
    </Card>
  )
}

/**
 * Estado vacío de un módulo. Se usa cuando la consulta funcionó pero no hay
 * nada que mostrar — es el caso normal de una tienda recién abierta, no un error.
 */
export function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
      <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-4)]">{children}</p>
    </div>
  )
}
