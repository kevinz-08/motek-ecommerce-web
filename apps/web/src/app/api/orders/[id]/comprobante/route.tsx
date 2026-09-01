/**
 * GET /api/orders/[id]/comprobante
 *
 * Genera el PDF del comprobante de venta on-demand a partir de los datos
 * persistidos del pedido. No se almacena el PDF — si el formato cambia,
 * los comprobantes históricos lo reflejan automáticamente.
 *
 * Autorización:
 *   - El dueño del pedido (session.user.id === order.userId)
 *   - Cualquier usuario con role === 'ADMIN'
 */
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { auth } from '@/lib/auth'
import { prisma } from '@/infrastructure/database/prisma-client'
import { ReceiptPdf, type ReceiptData } from '@/lib/receipt/ReceiptPdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { sku: true, name: true } } } },
      payment: true,
      user: { select: { id: true, email: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const isAdmin = session.user.role === 'ADMIN'
  const isOwner = session.user.id === order.userId
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ShippingAddress está como JSON; lo casteamos al shape que conocemos.
  const shipping = order.shippingAddress as unknown as {
    fullName: string
    address: string
    city: string
    phone: string
  }

  const data: ReceiptData = {
    orderId: order.id,
    orderDate: order.createdAt,
    buyer: {
      name: shipping.fullName,
      idType: order.buyerIdType,
      idNumber: order.buyerIdNumber,
      businessName: order.buyerBusinessName ?? undefined,
      email: order.user.email,
      phone: shipping.phone,
      address: shipping.address,
      city: shipping.city,
    },
    items: order.items.map((it) => ({
      sku: it.product.sku,
      name: it.product.name,
      quantity: it.quantity,
      unitPrice: it.priceAtPurchase,
      subtotal: it.priceAtPurchase * it.quantity,
    })),
    total: order.total,
    shippingTotal: order.shippingTotal,
    payment: {
      provider: order.paymentProvider,
      externalId: order.payment?.externalId ?? null,
      reference: null,
    },
  }

  const buffer = await renderToBuffer(<ReceiptPdf data={data} />)
  const filename = `comprobante-${order.id.slice(-8).toUpperCase()}.pdf`

  return new NextResponse(buffer as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
