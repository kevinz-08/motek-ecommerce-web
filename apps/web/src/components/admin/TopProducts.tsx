import Link from 'next/link'
import type { TopProduct } from '@/infrastructure/repositories/PrismaDashboardRepository'
import { formatCOPCompact } from '@/lib/format'

/**
 * Productos que más facturaron en el rango.
 *
 * Barras horizontales porque los nombres de repuesto son largos y en vertical
 * habría que rotarlos. Un solo tono para todas: son una sola serie nominal y la
 * longitud ya codifica el valor — teñir cada barra de un color distinto gastaría
 * el canal de identidad repitiendo lo que la barra ya dice.
 */
export function TopProducts({ products }: { products: TopProduct[] }) {
  if (products.length === 0) {
    return (
      <p className="py-10 text-center text-[length:var(--text-body-sm)] text-[var(--c-text-4)]">
        Sin ventas en este período
      </p>
    )
  }

  const max = products[0].revenue || 1

  return (
    <div className="flex flex-col gap-4">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/admin/productos/${product.id}`}
          className="group flex flex-col gap-[7px] rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[length:var(--text-body-sm)] text-[var(--c-text-2)] group-hover:text-[var(--c-text)]">
              {product.name}
            </span>
            <span className="shrink-0 text-[length:var(--text-body-sm)] font-bold text-[var(--c-text)] tabular-nums">
              {formatCOPCompact(product.revenue)}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--c-chart-track)]">
              <div
                className="h-full rounded-[var(--radius-sm)] bg-[var(--c-chart-1)]"
                style={{ width: `${(product.revenue / max) * 100}%` }}
              />
            </div>
            <span className="w-11 shrink-0 text-right text-xs text-[var(--c-text-4)] tabular-nums">
              {product.units} u
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
