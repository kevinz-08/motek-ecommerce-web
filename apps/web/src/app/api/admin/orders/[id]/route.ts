/**
 * GET /api/admin/orders/[id]
 *
 * Retorna el detalle completo de un pedido para mostrarlo en el modal de
 * "Información" del panel admin. Lectura directa contra Prisma (mismo
 * patrón de los Server Components), sin pasar por NestJS — es solo
 * lectura sin efectos secundarios.
 *
 * Autorización: solo ADMIN.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/infrastructure/database/prisma-client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { select: { sku: true, name: true } } },
      },
      payment: true,
      shipment: { select: { status: true, trackingNumber: true, carrier: true, updatedAt: true } },
      user: { select: { email: true, name: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    id: order.id,
    createdAt: order.createdAt,
    status: order.status,
    total: order.total,
    paymentProvider: order.paymentProvider,
    shippingTotal: order.shippingTotal,
    vendeloOrderId: order.vendeloOrderId,
    policiesAcceptedAt: order.policiesAcceptedAt,
    buyer: {
      idType: order.buyerIdType,
      idNumber: order.buyerIdNumber,
      businessName: order.buyerBusinessName,
    },
    shippingAddress: order.shippingAddress,
    user: {
      email: order.user.email,
      name: order.user.name,
    },
    items: order.items.map((it) => ({
      sku: it.product.sku,
      name: it.product.name,
      quantity: it.quantity,
      unitPrice: it.priceAtPurchase,
      subtotal: it.priceAtPurchase * it.quantity,
    })),
    payment: order.payment
      ? {
          provider: order.payment.provider,
          status: order.payment.status,
          externalId: order.payment.externalId,
          amount: order.payment.amount,
          createdAt: order.payment.createdAt,
        }
      : null,
    shipment: order.shipment ?? null,
  })
}
