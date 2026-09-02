'use client'

import type { SyncReport } from '@motek/domain'

interface Props {
  report: SyncReport
}

function formatCOP(cents: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

export function SyncResultTable({ report }: Props) {
  const totalProcessed = report.updated + report.unchanged + report.notFound.length

  return (
    <div className="space-y-6">

      {/* ── Resumen general ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Actualizados" value={report.updated} color="success" />
        <StatCard label="Sin cambios"  value={report.unchanged} color="neutral" />
        <StatCard label="No encontrados" value={report.notFound.length} color="danger" />
        <StatCard label="Total procesados" value={totalProcessed} color="neutral" />
      </div>

      {/* ── Metadata ──────────────────────────────────────────────────── */}
      <p className="text-xs text-[var(--c-text-4)]">
        Calculado en {report.durationMs} ms ·{' '}
        {new Date(report.executedAt).toLocaleString('es-CO')}
      </p>

      {/* ── Productos a actualizar ───────────────────────────────────────── */}
      <Section title={`Productos a actualizar (${report.updatedItems.length})`} color="success" defaultOpen>
        {report.updatedItems.length === 0 ? (
          <p className="text-xs text-[var(--c-text-3)]">Ningún producto tiene cambios de stock o precio.</p>
        ) : (
          <table className="w-full text-[length:var(--text-body-sm)]">
            <thead>
              <tr className="border-b border-[var(--c-border)]">
                <Th>SKU</Th>
                <Th>Producto</Th>
                <Th>Stock</Th>
                <Th>Precio</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--c-divider)]">
              {report.updatedItems.map((item) => (
                <tr key={item.productId} className="hover:bg-[var(--c-surface-hover)]">
                  <td className="px-3 py-2 font-mono text-xs text-[var(--c-text-3)]">{item.sku}</td>
                  <td className="px-3 py-2 text-[var(--c-text-2)]">{item.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {item.oldStock === item.newStock ? (
                      <span className="text-[var(--c-text-4)]">{item.newStock}</span>
                    ) : (
                      <span>
                        <span className="text-[var(--c-text-4)] line-through">{item.oldStock}</span>{' '}
                        <span className="text-[var(--c-success)] font-semibold">→ {item.newStock}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {item.newPrice === null || item.oldPrice === item.newPrice ? (
                      <span className="text-[var(--c-text-4)]">{formatCOP(item.oldPrice)}</span>
                    ) : (
                      <span>
                        <span className="text-[var(--c-text-4)] line-through">{formatCOP(item.oldPrice)}</span>{' '}
                        <span className="text-[var(--c-success)] font-semibold">→ {formatCOP(item.newPrice)}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── Corregidos por nombre ──────────────────────────────────────── */}
      <Section title={`Resueltos por nombre (${report.fixedByNombre.length})`} color="warning">
        <p className="text-xs text-[var(--c-text-3)] mb-3">
          El código llegó corrupto desde Optimun y se encontró el producto por nombre.
        </p>
        {report.fixedByNombre.length === 0 ? (
          <p className="text-xs text-[var(--c-text-3)]">Ningún producto necesitó resolverse por nombre.</p>
        ) : (
          <table className="w-full text-[length:var(--text-body-sm)]">
            <thead>
              <tr className="border-b border-[var(--c-border)]">
                <Th>Código corrupto</Th>
                <Th>Nombre encontrado</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--c-divider)]">
              {report.fixedByNombre.map((r, i) => (
                <tr key={i} className="hover:bg-[var(--c-surface-hover)]">
                  <td className="px-3 py-2 font-mono text-xs text-[var(--c-warning)]">{r.codigoCorrupto}</td>
                  <td className="px-3 py-2 text-[var(--c-text-2)]">{r.nombreMatch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── Precio omitido (DETAL = 0) ────────────────────────────────── */}
      <Section title={`Precio no actualizado — DETAL 0 en Optimun (${report.skippedPrice.length})`} color="info">
        <p className="text-xs text-[var(--c-text-3)] mb-3">
          Estos productos no tienen precio configurado en el sistema local.
          El precio de la web no se modificará.
        </p>
        {report.skippedPrice.length === 0 ? (
          <p className="text-xs text-[var(--c-text-3)]">Ningún producto tiene DETAL en 0.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {report.skippedPrice.map(sku => (
              <span key={sku} className="font-mono text-xs bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded px-2 py-1 text-[var(--c-text-3)]">
                {sku}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* ── No encontrados ────────────────────────────────────────────── */}
      <Section title={`No encontrados en la tienda (${report.notFound.length})`} color="danger">
        <p className="text-xs text-[var(--c-text-3)] mb-3">
          Estos productos existen en Optimun pero no en la tienda web. No se crearán.
        </p>
        {report.notFound.length === 0 ? (
          <p className="text-xs text-[var(--c-text-3)]">Todos los productos del export existen en la tienda.</p>
        ) : (
          <table className="w-full text-[length:var(--text-body-sm)]">
            <thead>
              <tr className="border-b border-[var(--c-border)]">
                <Th>Código</Th>
                <Th>Nombre en Optimun</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--c-divider)]">
              {report.notFound.map((r, i) => (
                <tr key={i} className="hover:bg-[var(--c-surface-hover)]">
                  <td className="px-3 py-2 font-mono text-xs text-[var(--c-text-4)]">{r.codigo}</td>
                  <td className="px-3 py-2 text-[var(--c-text-2)]">{r.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

type StatusColor = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

function StatCard({ label, value, color }: { label: string; value: number; color: StatusColor }) {
  const valueColor: Record<StatusColor, string> = {
    success: 'text-[var(--c-success)]',
    danger: value > 0 ? 'text-[var(--c-danger)]' : 'text-[var(--c-text-3)]',
    warning: 'text-[var(--c-warning)]',
    info: 'text-[var(--c-info)]',
    neutral: 'text-[var(--c-text)]',
  }

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-lg)] px-4 py-4 flex flex-col gap-1">
      <span className={`text-2xl font-bold ${valueColor[color]}`}>{value}</span>
      <span className="text-xs text-[var(--c-text-3)]">{label}</span>
    </div>
  )
}

function Section({
  title,
  color,
  children,
  defaultOpen = false,
}: {
  title: string
  color: 'success' | 'danger' | 'warning' | 'info'
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const border: Record<typeof color, string> = {
    success: 'border-[var(--c-success)]/20',
    danger: 'border-[var(--c-danger)]/20',
    warning: 'border-[var(--c-warning)]/20',
    info: 'border-[var(--c-info)]/20',
  }

  const titleColor: Record<typeof color, string> = {
    success: 'text-[var(--c-success)]',
    danger: 'text-[var(--c-danger)]',
    warning: 'text-[var(--c-warning)]',
    info: 'text-[var(--c-info)]',
  }

  return (
    <details className={`bg-[var(--c-surface-2)] border ${border[color]} rounded-[var(--radius-lg)] p-4 group`} open={defaultOpen}>
      <summary className={`text-[length:var(--text-body-sm)] font-semibold ${titleColor[color]} cursor-pointer select-none list-none flex items-center gap-2`}>
        <svg
          className="w-3.5 h-3.5 transition-transform group-open:rotate-90 shrink-0"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="text-left px-3 py-2 text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-wide">
      {children}
    </th>
  )
}
