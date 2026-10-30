'use client'

/**
 * Toggle switch para activar o desactivar la compra sin registro (guest checkout).
 *
 * Estado persistido en la BD (tabla Settings, clave GUEST_CHECKOUT_ENABLED).
 * Por defecto DESACTIVADO (sin fila = apagado): es el kill-switch del flujo de
 * invitados — si aparece abuso se apaga sin redeploy y sin afectar a los
 * clientes con cuenta.
 *
 * Cuando se activa:
 *   - El checkout ofrece "Comprar sin registrarme" (con captcha Turnstile)
 *   - POST /orders/guest acepta pedidos de invitados
 *
 * Reglas que se mantienen aunque esté activo (viven en el dominio):
 *   - Pago contra entrega y cupones restringidos exigen cuenta
 *
 * Mismo patrón que CodToggle: estado inicial por SSR, PATCH optimista,
 * deshabilitado mientras la petición está en curso.
 */
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api-client'

interface GuestCheckoutToggleProps {
  /** Estado inicial del toggle, leído desde la BD al cargar la página */
  enabled: boolean
}

export function GuestCheckoutToggle({ enabled: initial }: GuestCheckoutToggleProps) {
  const { data: session } = useSession()
  const [enabled, setEnabled] = useState(initial)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    setLoading(true)
    try {
      const res = await apiClient(session?.user?.accessToken).patch<void>(
        '/admin/settings/guest-checkout',
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
      aria-label="Compra sin registro"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
