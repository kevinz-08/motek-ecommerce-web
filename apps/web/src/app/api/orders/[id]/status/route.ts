import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const VALID_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
type Status = typeof VALID_STATUSES[number]

/**
 * Cambio de estado de un pedido desde el admin.
 *
 * Se delega a NestJS (`PATCH /orders/:id/status`, guard `@Roles('ADMIN')`) en
 * vez de escribir Prisma directo: anular un pedido que ya está en Vendelo debe
 * anularlo también allá (use case CancelOrder) y rechazarse si el envío ya salió.
 * Escribir aquí directo dejaría el pedido anulado en Motek y vivo en Vendelo.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { status } = body as { status?: string }

  if (!status || !VALID_STATUSES.includes(status as Status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const upstream = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.user.accessToken}`,
    },
    body: JSON.stringify({ status }),
  }).catch(() => null)

  if (!upstream) {
    return NextResponse.json({ error: 'No se pudo contactar la API' }, { status: 502 })
  }

  const data = await upstream.json().catch(() => ({})) as { message?: string; error?: string }
  if (!upstream.ok) {
    // Mensaje legible para el admin (ej. "El pedido ya fue despachado...")
    return NextResponse.json(
      { error: data.message ?? data.error ?? 'No se pudo actualizar el estado' },
      { status: upstream.status },
    )
  }

  return NextResponse.json(data)
}
