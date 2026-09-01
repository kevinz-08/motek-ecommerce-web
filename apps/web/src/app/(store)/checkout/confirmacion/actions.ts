'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@motek/database'

export async function getOrderStatus(orderId: string): Promise<string | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const order = await prisma.order.findUnique({
    where: { id: orderId, userId: session.user.id },
    select: { status: true },
  })

  return order?.status ?? null
}
