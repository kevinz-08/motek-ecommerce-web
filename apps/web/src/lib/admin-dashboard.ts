/**
 * Capa de caché del dashboard admin.
 *
 * Se cachea SOLO lo analítico: las series, el resumen del rango, el reparto por
 * estado y el top de productos. Son agregaciones que recorren toda la ventana de
 * pedidos y se recalculan en cada recarga del panel, lo que castiga sin
 * necesidad al pool de conexiones de Neon.
 *
 * NO se cachea lo operativo — la banda de atención, el stock crítico y los
 * pedidos recientes. Son conteos baratos, y son justo las cifras sobre las que
 * el admin acaba de actuar: si despacha un pedido y vuelve al panel, el contador
 * tiene que haber bajado. Servirle un número de hace un minuto haría parecer que
 * su acción no surtió efecto.
 *
 * El TTL corto es la garantía real, no las etiquetas: los cambios de estado de
 * pedido pasan por NestJS, que no puede llamar al `revalidateTag` de Next. Las
 * etiquetas sí ayudan donde la mutación sí ocurre del lado de Next (stock).
 */
import { unstable_cache } from 'next/cache'
import {
  PrismaDashboardRepository,
  type RangeSummary,
  type SeriesPoint,
  type StatusBreakdown,
  type TopProduct,
} from '@/infrastructure/repositories/PrismaDashboardRepository'
import { PrismaOrderRepository } from '@/infrastructure/repositories/PrismaOrderRepository'
import type { RevenueRange } from '@/infrastructure/repositories/date-buckets'
import { CACHE_TAGS } from './cache-tags'

/** Ventana corta: el panel debe seguir sintiéndose actual. */
const DASHBOARD_TTL = 60

const ANALYTICS_TAGS = [CACHE_TAGS.orders, CACHE_TAGS.products]

export const getCachedRangeSummary = unstable_cache(
  (range: RevenueRange): Promise<RangeSummary> =>
    new PrismaDashboardRepository().getRangeSummary(range),
  ['admin-dashboard-summary'],
  { revalidate: DASHBOARD_TTL, tags: ANALYTICS_TAGS },
)

export const getCachedRevenueSeries = unstable_cache(
  (range: RevenueRange): Promise<SeriesPoint[]> =>
    new PrismaOrderRepository().getRevenueSeries(range),
  ['admin-dashboard-revenue-series'],
  { revalidate: DASHBOARD_TTL, tags: ANALYTICS_TAGS },
)

export const getCachedOrdersSeries = unstable_cache(
  (range: RevenueRange): Promise<SeriesPoint[]> =>
    new PrismaDashboardRepository().getOrdersSeries(range),
  ['admin-dashboard-orders-series'],
  { revalidate: DASHBOARD_TTL, tags: ANALYTICS_TAGS },
)

export const getCachedNewCustomersSeries = unstable_cache(
  (range: RevenueRange): Promise<SeriesPoint[]> =>
    new PrismaDashboardRepository().getNewCustomersSeries(range),
  ['admin-dashboard-customers-series'],
  { revalidate: DASHBOARD_TTL, tags: ANALYTICS_TAGS },
)

export const getCachedStatusBreakdown = unstable_cache(
  (range: RevenueRange): Promise<StatusBreakdown> =>
    new PrismaDashboardRepository().getStatusBreakdown(range),
  ['admin-dashboard-status'],
  { revalidate: DASHBOARD_TTL, tags: ANALYTICS_TAGS },
)

export const getCachedTopProducts = unstable_cache(
  (range: RevenueRange): Promise<TopProduct[]> =>
    new PrismaDashboardRepository().getTopProducts(range, 5),
  ['admin-dashboard-top-products'],
  { revalidate: DASHBOARD_TTL, tags: ANALYTICS_TAGS },
)
