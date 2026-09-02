'use client'

/**
 * Toggle switch para activar o desactivar Mercado Pago como pasarela de pago.
 *
 * Estado persistido en la BD (tabla Settings, clave MERCADOPAGO_ENABLED).
 * Cuando se activa:
 *   - Los clientes ven la opción "Pagar con Mercado Pago" en el checkout
 *   - El endpoint POST /api/orders acepta paymentProvider='MERCADO_PAGO'
 *
 * Cuando se desactiva:
 *   - Solo aparece Wompi en el checkout
 *   - El endpoint rechaza pedidos con Mercado Pago (403)
 *
 * Comportamiento del componente:
 *   - Recibe el estado inicial (enabled) desde el servidor (SSR)
 *   - Al hacer click, llama PATCH /api/admin/settings/mercadopago
 *   - Actualiza el estado local optimistamente si la respuesta es OK
 *   - Deshabilita el botón mientras la petición está en curso (evita doble click)
 */
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api-client'

interface MercadoPagoToggleProps {
  /** Estado inicial del toggle, leído desde la BD al cargar la página */
  enabled: boolean
}

export function MercadoPagoToggle({ enabled: initial }: MercadoPagoToggleProps) {
  const { data: session } = useSession()
  const [enabled, setEnabled] = useState(initial)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    setLoading(true)
    try {
      const res = await apiClient(session?.user?.accessToken).patch<void>(
        '/admin/settings/mercadopago',
        { enabled: !enabled },
      )
      if (res.ok) setEnabled(!enabled)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-[var(--dur-hover)] focus-visible:outline-none disabled:opacity-50 ${
        enabled ? 'bg-[var(--c-success)]' : 'bg-[var(--c-text-4)]'
      }`}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
