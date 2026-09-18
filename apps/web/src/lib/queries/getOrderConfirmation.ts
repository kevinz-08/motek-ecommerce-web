import { prisma } from '@motek/database'

export type OrderConfirmationItem = {
  id: string
  productName: string
  productSlug: string
  productImage: string | null
  quantity: number
  priceAtPurchase: number
}

export type OrderConfirmation = {
  id: string
  status: string
  total: number
  createdAt: Date
  paymentProvider: string
  shippingAddress: {
    fullName: string
    address: string
    city: string
    department: string
    phone: string
    postalCode?: string
    notes?: string
  }
  items: OrderConfirmationItem[]
}

/**
 * Cómo se autoriza la lectura del pedido.
 *   { userId }        → dueño registrado; el pedido debe ser suyo.
 *   { trackingToken } → comprador invitado; el token de 256 bits ES la
 *                       autorización. Se exige junto con el orderId para que un
 *                       token válido no sirva para leer otro pedido.
 */
export type OrderConfirmationAccess =
  | { userId: string }
  | { trackingToken: string }

export async function getOrderConfirmation(
  orderId: string,
  access: OrderConfirmationAccess,
): Promise<OrderConfirmation | null> {
  const order = await prisma.order.findUnique({
    where: 'userId' in access
      ? { id: orderId, userId: access.userId }
      : { id: orderId, trackingToken: access.trackingToken },
    include: {
      items: {
        include: {
          product: { select: { name: true, slug: true, images: true } },
        },
      },
    },
  })

  if (!order) return null

  const addr = order.shippingAddress as {
    fullName?: string
    address?: string
    city?: string
    department?: string
    phone?: string
    postalCode?: string
    notes?: string
  }

  return {
    id: order.id,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    paymentProvider: order.paymentProvider,
    shippingAddress: {
      fullName: addr.fullName ?? '',
      address: addr.address ?? '',
      city: addr.city ?? '',
      department: addr.department ?? '',
      phone: addr.phone ?? '',
      postalCode: addr.postalCode,
      notes: addr.notes,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.product.name,
      productSlug: item.product.slug,
      productImage: item.product.images[0] ?? null,
      quantity: item.quantity,
      priceAtPurchase: item.priceAtPurchase,
    })),
  }
}
