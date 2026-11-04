/**
 * POST /api/admin/vendelo/orders/[id]/requeue
 *
 * Reintenta el despacho de un pedido cuya fila de `VendeloOrderQueue` quedó en
 * FAILED. NestJS responde 422 con el motivo cuando reintentar sería incorrecto
 * (el pedido ya existe en Vendelo, es retiro en tienda, o ya está en cola).
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
  return proxyJson(
    `/admin/vendelo/orders/${encodeURIComponent(id)}/requeue`,
    guard.accessToken,
    { method: 'POST' },
  )
}
