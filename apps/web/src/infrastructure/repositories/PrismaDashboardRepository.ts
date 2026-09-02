/**
 * Agregaciones del dashboard admin que cruzan varios modelos.
 *
 * Vive aparte de `PrismaOrderRepository` porque estas consultas no son acceso a
 * pedidos: combinan pedidos, ítems, productos, usuarios y cupones para responder
 * preguntas de la pantalla principal. Meterlas en el repositorio de pedidos lo
 * convertiría en un cajón de sastre.
 *
 * Convenciones que comparte con el resto del panel:
 *  - «Confirmado» = cualquier estado salvo PENDING y CANCELLED. Un pedido sigue
 *    contando como pagado al pasar a SHIPPED o DELIVERED.
 *  - Todos los montos son centavos COP.
 *  - El rango acota TODAS las cifras, para que los módulos concuerden entre sí.
 */
import { prisma, Prisma } from '@motek/database'
import {
  buildBucketPlan,
  foldIntoBuckets,
  rangeWindow,
  type BucketPlan,
  type RevenueRange,
} from './date-buckets'

/**
 * Filtro de venta confirmada, opcionalmente acotado desde una fecha.
 *
 * Se construye en una función en vez de una constante compartida porque Prisma
 * espera un arreglo mutable de estados: un literal marcado `as const` queda
 * readonly y deja de encajar en `OrderWhereInput`.
 */
function confirmedWhere(since?: Date | null): Prisma.OrderWhereInput {
  return {
    status: { notIn: ['PENDING', 'CANCELLED'] },
    ...(since ? { createdAt: { gte: since } } : {}),
  }
}

export interface PeriodTotals {
  /** Centavos COP. */
  revenue: number
  paidOrders: number
  /** Centavos COP. 0 cuando no hubo pedidos — no se divide por cero. */
  avgTicket: number
}

export interface RangeSummary extends PeriodTotals {
  /** Pedidos creados en el rango que siguen sin pago confirmado. */
  pendingCount: number
  /** Pedidos creados en el rango, en cualquier estado. Base de los porcentajes. */
  createdCount: number
  /**
   * Mismas cifras para la ventana anterior de igual largo, o `null` en el rango
   * histórico, que no tiene período previo contra el cual compararse.
   */
  previous: PeriodTotals | null
}

export interface SeriesPoint {
  label: string
  total: number
}

export interface StatusBreakdown {
  pending: number
  paid: number
  shipped: number
  delivered: number
  cancelled: number
}

export interface TopProduct {
  id: string
  name: string
  sku: string
  /** Centavos COP acumulados en el rango. */
  revenue: number
  units: number
}

export interface AttentionCounts {
  /** Pagados y aún sin despachar — el trabajo pendiente más urgente. */
  paidNotShipped: number
  outOfStock: number
  /** Cupones activos que vencen dentro de los próximos 7 días. */
  couponsExpiringSoon: number
}

export class PrismaDashboardRepository {
  /**
   * Cifras de cabecera del rango más las de la ventana anterior, para las
   * variaciones. Se resuelven en paralelo: son consultas independientes.
   */
  async getRangeSummary(range: RevenueRange): Promise<RangeSummary> {
    const { since, prevSince, prevUntil } = rangeWindow(range)
    const createdInRange: Prisma.OrderWhereInput = since ? { createdAt: { gte: since } } : {}

    const [revenueAgg, paidOrders, pendingCount, createdCount] = await Promise.all([
      prisma.order.aggregate({ where: confirmedWhere(since), _sum: { total: true } }),
      prisma.order.count({ where: confirmedWhere(since) }),
      prisma.order.count({ where: { status: 'PENDING', ...createdInRange } }),
      prisma.order.count({ where: createdInRange }),
    ])

    const revenue = revenueAgg._sum?.total ?? 0

    let previous: PeriodTotals | null = null
    if (prevSince && prevUntil) {
      const prevWhere: Prisma.OrderWhereInput = {
        status: { notIn: ['PENDING', 'CANCELLED'] },
        createdAt: { gte: prevSince, lt: prevUntil },
      }
      const [prevRevenueAgg, prevPaidOrders] = await Promise.all([
        prisma.order.aggregate({ where: prevWhere, _sum: { total: true } }),
        prisma.order.count({ where: prevWhere }),
      ])
      const prevRevenue = prevRevenueAgg._sum?.total ?? 0
      previous = {
        revenue: prevRevenue,
        paidOrders: prevPaidOrders,
        avgTicket: prevPaidOrders > 0 ? Math.round(prevRevenue / prevPaidOrders) : 0,
      }
    }

    return {
      revenue,
      paidOrders,
      avgTicket: paidOrders > 0 ? Math.round(revenue / paidOrders) : 0,
      pendingCount,
      createdCount,
      previous,
    }
  }

  /** Pedidos confirmados por bucket. Mismas etiquetas que la serie de ingresos. */
  async getOrdersSeries(range: RevenueRange): Promise<SeriesPoint[]> {
    const plan = await this.planForConfirmedOrders(range)
    if (!plan) return []

    const orders = await prisma.order.findMany({
      where: confirmedWhere(plan.since),
      select: { createdAt: true },
    })
    return foldIntoBuckets(plan, orders, (o) => o.createdAt, () => 1)
  }

  /** Cuentas creadas por bucket — la métrica de crecimiento que sí se puede calcular hoy. */
  async getNewCustomersSeries(range: RevenueRange): Promise<SeriesPoint[]> {
    const { since } = rangeWindow(range)

    let earliest: Date | null = null
    if (range === 'all') {
      const agg = await prisma.user.aggregate({ _min: { createdAt: true } })
      earliest = agg._min?.createdAt ?? null
      if (!earliest) return []
    }

    const plan = buildBucketPlan(range, earliest)
    const users = await prisma.user.findMany({
      where: since ? { createdAt: { gte: since } } : {},
      select: { createdAt: true },
    })
    return foldIntoBuckets(plan, users, (u) => u.createdAt, () => 1)
  }

  /** Reparto de pedidos por estado dentro del rango. */
  async getStatusBreakdown(range: RevenueRange): Promise<StatusBreakdown> {
    const { since } = rangeWindow(range)
    const rows = await prisma.order.groupBy({
      by: ['status'],
      where: since ? { createdAt: { gte: since } } : {},
      _count: { _all: true },
    })

    const counts: StatusBreakdown = { pending: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0 }
    for (const row of rows) {
      const total = row._count?._all ?? 0
      switch (row.status) {
        case 'PENDING': counts.pending = total; break
        case 'PAID': counts.paid = total; break
        case 'SHIPPED': counts.shipped = total; break
        case 'DELIVERED': counts.delivered = total; break
        case 'CANCELLED': counts.cancelled = total; break
      }
    }
    return counts
  }

  /**
   * Productos que más facturaron en el rango.
   *
   * El ingreso por producto es `priceAtPurchase * quantity`, que Prisma no sabe
   * agregar en un `groupBy`. Se pliega en JS, igual que la serie de ingresos, en
   * vez de bajar a SQL crudo.
   */
  async getTopProducts(range: RevenueRange, limit = 5): Promise<TopProduct[]> {
    const { since } = rangeWindow(range)

    const items = await prisma.orderItem.findMany({
      where: { order: confirmedWhere(since) },
      select: { productId: true, quantity: true, priceAtPurchase: true },
    })
    if (items.length === 0) return []

    const totals = new Map<string, { revenue: number; units: number }>()
    for (const item of items) {
      const current = totals.get(item.productId) ?? { revenue: 0, units: 0 }
      current.revenue += item.priceAtPurchase * item.quantity
      current.units += item.quantity
      totals.set(item.productId, current)
    }

    const top = Array.from(totals.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, limit)

    const products = await prisma.product.findMany({
      where: { id: { in: top.map(([id]) => id) } },
      select: { id: true, name: true, sku: true },
    })
    const byId = new Map(products.map((p) => [p.id, p]))

    return top.flatMap(([id, agg]) => {
      const product = byId.get(id)
      // Un producto borrado en duro dejaría ítems huérfanos: se omite la fila en
      // vez de mostrarla sin nombre.
      if (!product) return []
      return [{ id, name: product.name, sku: product.sku, revenue: agg.revenue, units: agg.units }]
    })
  }

  /**
   * Lo accionable de la banda superior. No se acota al rango a propósito: un
   * pedido sin despachar de hace dos meses sigue sin despacharse.
   */
  async getAttentionCounts(): Promise<AttentionCounts> {
    const now = new Date()
    const inAWeek = new Date(now)
    inAWeek.setDate(inAWeek.getDate() + 7)

    const [paidNotShipped, outOfStock, couponsExpiringSoon] = await Promise.all([
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.product.count({ where: { stock: 0, isActive: true, deletedAt: null } }),
      prisma.coupon.count({ where: { isActive: true, expiresAt: { gte: now, lte: inAWeek } } }),
    ])

    return { paidNotShipped, outOfStock, couponsExpiringSoon }
  }

  /**
   * Plan de buckets del rango. En 'all' necesita saber cuándo empezó todo, lo
   * que exige una consulta extra; devuelve `null` si no hay nada que graficar.
   */
  private async planForConfirmedOrders(range: RevenueRange): Promise<BucketPlan | null> {
    if (range !== 'all') return buildBucketPlan(range)

    const agg = await prisma.order.aggregate({
      where: confirmedWhere(),
      _min: { createdAt: true },
    })
    const earliest = agg._min?.createdAt
    if (!earliest) return null
    return buildBucketPlan(range, earliest)
  }
}
