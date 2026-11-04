/**
 * GET /api/admin/vendelo/orders/[id]
 *
 * Estado consolidado del despacho de un pedido (cola Vendelo + pedido en Vendelo
 * + guía). Alimenta la sección "Guía Vendelo" del modal de `/admin/pedidos`.
 *
 * Autorización: solo ADMIN.
 */
import { NextRequest } from 'next/server'
import { requireAdmin, proxyJson } from '@/lib/admin-vendelo-proxy'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const { id } = await params
  return proxyJson(`/admin/vendelo/orders/${encodeURIComponent(id)}/shipping-status`, guard.accessToken)
}
