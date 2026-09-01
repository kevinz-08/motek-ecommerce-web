'use client'

import { useEffect } from 'react'
import { useCart } from '@/lib/cart'

interface CartCleanerProps {
  orderId: string
}

/**
 * Limpia el carrito cuando el usuario llega a la página de confirmación
 * tras un pago aprobado. Se monta como Client Component dentro del Server
 * Component de la página de confirmación, donde Zustand está disponible.
 *
 * No renderiza nada visible — solo ejecuta el efecto de limpieza.
 */
export function CartCleaner({ orderId }: CartCleanerProps) {
  const { clearCart } = useCart()

  useEffect(() => {
    clearCart()
  }, [orderId, clearCart])

  return null
}
