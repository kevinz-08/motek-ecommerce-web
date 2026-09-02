import Link from 'next/link'
import { ShoppingBag, Receipt, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import { PrismaOrderRepository } from '@/infrastructure/repositories/PrismaOrderRepository'
import { PrismaProductRepository } from '@/infrastructure/repositories/PrismaProductRepository'
import { PrismaDashboardRepository } from '@/infrastructure/repositories/PrismaDashboardRepository'
import {
  getCachedRangeSummary,
  getCachedRevenueSeries,
  getCachedOrdersSeries,
  getCachedNewCustomersSeries,
  getCachedStatusBreakdown,
  getCachedTopProducts,
} from '@/lib/admin-dashboard'
import { RangeFilter, parseRange, rangeLabel } from '@/components/admin/RangeFilter'
import { AttentionBand } from '@/components/admin/AttentionBand'
import { HeroStat } from '@/components/admin/HeroStat'
import { StatCard } from '@/components/admin/StatCard'
import { Sparkline } from '@/components/admin/Sparkline'
import { RevenueChart } from '@/components/admin/RevenueChart'
import { TrendChart } from '@/components/admin/TrendChart'
import { OrderLifecycle } from '@/components/admin/OrderLifecycle'
import { TopProducts } from '@/components/admin/TopProducts'
import { ChartCard, ChartEmpty } from '@/components/admin/charts/ChartCard'
import { RecentOrdersTable } from '@/components/admin/RecentOrdersTable'
import { Card } from '@/components/ui/Card'
import { formatCOP, formatPercentDelta } from '@/lib/format'

interface PageProps {
  searchParams: Promise<{ range?: string }>
}

export default async function AdminDashboard({ searchParams }: PageProps) {
  const params = await searchParams
  const range = parseRange(params.range)
  const label = rangeLabel(range)

  const orderRepo = new PrismaOrderRepository()
  const productRepo = new PrismaProductRepository()
  const dashboardRepo = new PrismaDashboardRepository()

  const [
    summary,
    revenueSeries,
    ordersSeries,
    customersSeries,
    statusBreakdown,
    topProducts,
    attention,
    lowStockProducts,
    recentOrders,
  ] = await Promise.all([
    // Analítico — cacheado 60 s.
    getCachedRangeSummary(range),
    getCachedRevenueSeries(range),
    getCachedOrdersSeries(range),
    getCachedNewCustomersSeries(range),
    getCachedStatusBreakdown(range),
    getCachedTopProducts(range),
    // Operativo — siempre en vivo.
    dashboardRepo.getAttentionCounts(),
    productRepo.findLowStock(5),
    orderRepo.findAll({ limit: 6 }),
  ])

  const previous = summary.previous
  const comparedTo = 'vs. período anterior'

  const peak = revenueSeries.reduce(
    (best, point) => (point.total > best.total ? point : best),
    { label: '—', total: 0 },
  )

  const pendingShare = summary.createdCount > 0
    ? (summary.pendingCount / summary.createdCount) * 100
    : 0

  return (
    <div className="space-y-4">

      {/* ── Encabezado + filtro de rango ───────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-[var(--c-text-3)] uppercase">
            Panel de control
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--c-text)]">Dashboard</h1>
        </div>
        <RangeFilter current={range} />
      </div>

      {/* ── Lo accionable, antes que lo analítico ──────────────────────── */}
      <AttentionBand counts={attention} />

      {/* ── KPIs: una cifra héroe + tres de apoyo ──────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1fr]">
        <HeroStat
          label={`Ingresos · ${label}`}
          value={formatCOP(summary.revenue)}
          delta={previous ? formatPercentDelta(summary.revenue, previous.revenue) : null}
          comparedTo={comparedTo}
          fallbackNote="El histórico no tiene período previo"
          trend={
            revenueSeries.length > 1 ? (
              <Sparkline
                values={revenueSeries.map((point) => point.total)}
                label={`Tendencia de ingresos, ${label}`}
              />
            ) : undefined
          }
        />

        <StatCard
          label="Pedidos pagados"
          value={String(summary.paidOrders)}
          icon={<ShoppingBag className="h-4 w-4" />}
          delta={previous ? formatPercentDelta(summary.paidOrders, previous.paidOrders) : null}
          sub={previous ? undefined : label}
        />

        <StatCard
          label="Ticket promedio"
          value={formatCOP(summary.avgTicket)}
          icon={<Receipt className="h-4 w-4" />}
          delta={previous ? formatPercentDelta(summary.avgTicket, previous.avgTicket) : null}
          sub={previous ? undefined : label}
        />

        <StatCard
          label="Pendientes de pago"
          value={String(summary.pendingCount)}
          icon={<Clock className="h-4 w-4" />}
          tone={summary.pendingCount > 0 ? 'alert' : 'default'}
          sub={
            summary.createdCount > 0
              ? `${pendingShare.toLocaleString('es-CO', { maximumFractionDigits: 1 })} % de lo creado`
              : 'Sin pedidos en el período'
          }
        />
      </div>

      {/* ── Ingresos por bucket + ciclo del pedido ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          eyebrow="Ingresos"
          subtitle={`${label} · pedidos pagados`}
          aside={
            peak.total > 0 ? (
              <>
                <p className="text-[length:var(--text-body-sm)] font-bold text-[var(--c-text)] tabular-nums">
                  {formatCOP(peak.total)}
                </p>
                <p className="text-xs text-[var(--c-text-4)]">mejor día · {peak.label}</p>
              </>
            ) : undefined
          }
        >
          {revenueSeries.length === 0 ? (
            <ChartEmpty>Aún no hay pedidos pagados</ChartEmpty>
          ) : (
            <RevenueChart data={revenueSeries} />
          )}
        </ChartCard>

        <ChartCard eyebrow="Ciclo del pedido" subtitle={label}>
          <OrderLifecycle counts={statusBreakdown} />
        </ChartCard>
      </div>

      {/* ── Tendencia + top de productos ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard eyebrow="Tendencia" subtitle={`Por día · ${label}`}>
          {ordersSeries.length === 0 ? (
            <ChartEmpty>Sin actividad en este período</ChartEmpty>
          ) : (
            <TrendChart orders={ordersSeries} customers={customersSeries} />
          )}
        </ChartCard>

        <ChartCard
          eyebrow="Top productos"
          subtitle={`Por ingresos · ${label}`}
          action={
            <Link
              href="/admin/productos"
              className="flex items-center gap-1 text-xs text-[var(--c-text-3)] transition-colors hover:text-[var(--c-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
            >
              Ver todos <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          <TopProducts products={topProducts} />
        </ChartCard>
      </div>

      {/* ── Pedidos recientes + stock crítico ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card padding="none" className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--c-border)] px-6 py-5">
            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--c-text-3)] uppercase">
                Actividad reciente
              </p>
              <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">Últimos pedidos</p>
            </div>
            <Link
              href="/admin/pedidos"
              className="flex items-center gap-1 text-xs text-[var(--c-text-3)] transition-colors hover:text-[var(--c-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
            >
              Ver todos <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          <RecentOrdersTable
            orders={recentOrders.map((order) => ({
              id: order.id,
              createdAt: order.createdAt,
              status: order.status,
              deliveryMethod: order.deliveryMethod,
              total: order.total,
            }))}
            className="rounded-none border-0"
          />
        </Card>

        <ChartCard
          eyebrow="Stock crítico"
          subtitle="Menos de 5 unidades"
          aside={
            lowStockProducts.length > 0 ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--c-warning)]" aria-hidden="true" />
            ) : undefined
          }
          footer={
            <Link
              href="/admin/stock"
              className="flex items-center gap-1 text-xs text-[var(--c-text-3)] transition-colors hover:text-[var(--c-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
            >
              Gestionar inventario <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          {lowStockProducts.length === 0 ? (
            <ChartEmpty>Todo el inventario está en niveles normales</ChartEmpty>
          ) : (
            <div className="flex flex-col gap-3">
              {lowStockProducts.slice(0, 5).map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[length:var(--text-body-sm)] leading-tight text-[var(--c-text-2)]">
                      {product.name}
                    </p>
                    <p className="font-mono text-xs text-[var(--c-text-4)]">{product.sku}</p>
                  </div>
                  <span
                    className={`shrink-0 text-[length:var(--text-body-sm)] font-bold tabular-nums ${
                      product.stock === 0 ? 'text-[var(--c-danger)]' : 'text-[var(--c-warning)]'
                    }`}
                  >
                    {product.stock === 0 ? 'Agotado' : `${product.stock} u`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

    </div>
  )
}
