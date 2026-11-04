/**
 * POST /api/admin/vendelo/orders/[id]/shipment
 *
 * Crea el envío (la guía) en Vendelo para un pedido que ya existe allá.
 * Envuelve `POST /admin/vendelo/create-shipments` con un solo orderId — la
 * creación en Vendelo es asincrónica: el `Shipment` local lo escribe después
 * el webhook o `VendeloShipmentPollerCron`.
 *
 * Autorización: solo ADMIN.
 */
import { NextRequest } from 'next/server'
import { requireAdmin, proxyJson } from '@/lib/admin-vendelo-proxy'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const { id } = await params
  return proxyJson('/admin/vendelo/create-shipments', guard.accessToken, {
    method: 'POST',
    body: { orderIds: [id] },
  })
}
