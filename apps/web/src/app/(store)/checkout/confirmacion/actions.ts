'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@motek/database'

/**
 * Estado actual de un pedido, para el poller de la pantalla de confirmación.
 *
 * Dos vías de autorización, nunca una sola sin la otra:
 *   - Sesión: el pedido tiene que ser del usuario logueado.
 *   - `trackingToken`: la llave del comprador invitado. Se exige junto con el
 *     orderId, así un token válido no sirve para consultar otro pedido.
 *
 * Devuelve `null` ante cualquier fallo de autorización — el poller no distingue
 * "no autorizado" de "no existe", y así tampoco lo hace quien lo llame.
 */
export async function getOrderStatus(orderId: string, trackingToken?: string): Promise<string | null> {
  if (trackingToken) {
    const order = await prisma.order.findUnique({
      where: { id: orderId, trackingToken },
      select: { status: true },
    })
    return order?.status ?? null
  }

  const session = await auth()
  if (!session?.user?.id) return null

  const order = await prisma.order.findUnique({
    where: { id: orderId, userId: session.user.id },
    select: { status: true },
  })

  return order?.status ?? null
}
