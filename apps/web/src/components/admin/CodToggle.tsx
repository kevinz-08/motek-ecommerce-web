'use client'

/**
 * Toggle switch para activar o desactivar el pago contra entrega (COD).
 *
 * Estado persistido en la BD (tabla Settings, clave COD_ENABLED). Por defecto
 * habilitado (si no existe la fila aún, orders.controller.ts lo trata como activo).
 *
 * Cuando se activa:
 *   - Los clientes ven la opción "Pago contra entrega" en el checkout
 *   - El endpoint POST /api/orders acepta paymentProvider='COD'
 *
 * Cuando se desactiva:
 *   - Solo aparece "Pago en línea" en el checkout
 *   - El endpoint rechaza pedidos COD (403) — ninguna funcionalidad se elimina,
 *     solo deja de ofrecerse hasta que el admin lo reactive.
 *
 * Mismo patrón que MercadoPagoToggle: estado inicial por SSR, PATCH optimista,
 * deshabilitado mientras la petición está en curso.
 */
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api-client'

interface CodToggleProps {
  /** Estado inicial del toggle, leído desde la BD al cargar la página */
  enabled: boolean
}

export function CodToggle({ enabled: initial }: CodToggleProps) {
  const { data: session } = useSession()
  const [enabled, setEnabled] = useState(initial)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    setLoading(true)
    try {
      const res = await apiClient(session?.user?.accessToken).patch<void>(
        '/admin/settings/cod',
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
