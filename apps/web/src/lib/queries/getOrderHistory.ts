import { unstable_cache } from 'next/cache'
import { prisma } from '@motek/database'
import { CACHE_TAGS } from '@/lib/cache-tags'

export type OrderHistoryItem = {
  id: string
  productId: string
  productName: string
  productSlug: string
  productImage: string | null
  quantity: number
  priceAtPurchase: number
}

export type OrderHistoryEntry = {
  id: string
  status: string
  total: number
  createdAt: Date
  paymentProvider: string
  shippingCity: string
  shippingDepartment: string
  items: OrderHistoryItem[]
}

export type OrderHistoryResult = {
  orders: OrderHistoryEntry[]
  total: number
  page: number
  totalPages: number
}

const ORDERS_PER_PAGE = 8

/** TTL corto — el estado de los pedidos cambia con webhooks de Vendelo */
const TTL = 60

export const getOrderHistory = (userId: string, page = 1) =>
  unstable_cache(
    () => _getOrderHistory(userId, page),
    [`order-history-${userId}-${page}`],
    // Tag global 'orders' para invalidación masiva (admin).
    // Tag per-usuario 'orders:{userId}' para invalidación quirúrgica desde el webhook de Vendelo.
    { revalidate: TTL, tags: [CACHE_TAGS.orders, `${CACHE_TAGS.orders}:${userId}`] },
  )()

async function _getOrderHistory(
  userId: string,
  page = 1,
): Promise<OrderHistoryResult> {
  const skip = (page - 1) * ORDERS_PER_PAGE

  const [rows, total] = await prisma.$transaction([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: ORDERS_PER_PAGE,
      include: {
        items: {
          include: {
            product: { select: { name: true, slug: true, images: true } },
          },
        },
      },
    }),
    prisma.order.count({ where: { userId } }),
  ])

  const orders: OrderHistoryEntry[] = rows.map((o) => {
    const addr = o.shippingAddress as { city?: string; department?: string }
    return {
      id: o.id,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
      paymentProvider: o.paymentProvider,
      shippingCity: addr.city ?? '',
      shippingDepartment: addr.department ?? '',
      items: o.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSlug: item.product.slug,
        productImage: item.product.images[0] ?? null,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase,
      })),
    }
  })

  return {
    orders,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / ORDERS_PER_PAGE)),
  }
}
