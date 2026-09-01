'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getOrderStatus } from '@/app/(store)/checkout/confirmacion/actions'

interface OrderStatusPollerProps {
  orderId: string
}

const POLL_INTERVAL_MS = 5_000
const MAX_ATTEMPTS = 36 // 3 minutos máximo (36 × 5s)

/**
 * Consulta el estado del pedido cada 5 segundos mientras sea PENDING.
 * Cuando detecta un cambio (PAID o CANCELLED), llama a router.refresh()
 * para que el Server Component se re-renderice con los datos actualizados.
 * Se detiene automáticamente tras 3 minutos o cuando el estado cambia.
 */
export function OrderStatusPoller({ orderId }: OrderStatusPollerProps) {
  const router = useRouter()
  const attemptsRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(async () => {
      attemptsRef.current += 1

      if (attemptsRef.current >= MAX_ATTEMPTS) {
        clearInterval(interval)
        return
      }

      const status = await getOrderStatus(orderId)

      if (status && status !== 'PENDING') {
        clearInterval(interval)
        router.refresh()
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [orderId, router])

  return null
}
