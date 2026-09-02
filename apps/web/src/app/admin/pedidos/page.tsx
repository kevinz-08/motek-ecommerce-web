import { PrismaOrderRepository } from '@/infrastructure/repositories/PrismaOrderRepository'
import { OrderStatus } from '@motek/domain'
import { AdminHelpButton } from '@/components/admin/AdminHelpButton'
import { pedidosHelpContent } from '@/components/admin/help-content/pedidos'
import { getPaginationPages } from '@/lib/pagination'
import { PedidosTable } from '@/components/admin/PedidosTable'

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export default async function AdminPedidosPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page ?? 1)

  const repo = new PrismaOrderRepository()
  const status = params.status as OrderStatus | undefined
  const limit = 20
  const [orders, total] = await Promise.all([
    repo.findAll({ status, page, limit }),
    repo.countAll({ status }),
  ])
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight">Pedidos</h1>
        <AdminHelpButton content={pedidosHelpContent} />
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-2 mb-6 flex-wrap" role="group" aria-label="Filtrar pedidos por estado">
        {[undefined, 'PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => (
          <a
            key={s ?? 'all'}
            href={s ? `/admin/pedidos?status=${s}` : '/admin/pedidos'}
            aria-current={params.status === s || (!params.status && !s) ? 'true' : undefined}
            className={`px-3 py-1.5 rounded-[var(--radius-md)] text-[length:var(--text-body-sm)] font-medium transition-colors ${
              params.status === s || (!params.status && !s)
                ? 'bg-[var(--c-accent)] text-white'
                : 'bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-text-3)] hover:border-[var(--c-accent)] hover:text-[var(--c-text)]'
            }`}
          >
            {s ? STATUS_LABELS[s] : 'Todos'}
          </a>
        ))}
      </div>

      <PedidosTable orders={orders} />

      {/* ── Paginación ─────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav aria-label="Paginación de pedidos" className="flex items-center gap-1.5 mt-6 flex-wrap">
          {getPaginationPages(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-[var(--c-text-4)] select-none">
                ···
              </span>
            ) : (
              <a
                key={p}
                href={`/admin/pedidos?${new URLSearchParams({
                  ...(params.status ? { status: params.status } : {}),
                  page: String(p),
                })}`}
                aria-current={p === page ? 'page' : undefined}
                className={`w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-xs font-semibold transition-colors ${
                  p === page
                    ? 'bg-[var(--c-accent)] text-white'
                    : 'text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-hover)]'
                }`}
              >
                {p}
              </a>
            ),
          )}
        </nav>
      )}
    </div>
  )
}
