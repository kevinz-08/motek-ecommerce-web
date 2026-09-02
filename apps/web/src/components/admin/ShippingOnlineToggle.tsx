'use client'

/**
 * Toggle switch que decide si el flete cotizado se suma al cobro online
 * (Wompi/Mercado Pago) de los pedidos pagados en línea (WOMPI/MERCADO_PAGO).
 *
 * Estado persistido en la BD (tabla Settings, clave SHIPPING_ONLINE_ENABLED).
 * Por defecto DESACTIVADO (si no existe la fila aún, orders.controller.ts lo
 * trata como inactivo) — deliberado: no empezar a cobrar flete extra sin
 * opt-in explícito del admin.
 *
 * Cuando se activa:
 *   - El flete cotizado (vía Vendelo) se suma al monto que cobra Wompi/Mercado
 *     Pago — el cliente paga producto + envío en un solo cargo online.
 *   - El negocio le sigue pagando a Vendelo el flete desde su billetera al
 *     despachar (sin cambios ahí) — ahora recupera ese costo del cliente.
 *   - Política global calculada por orders.controller.ts, no una elección
 *     del cliente — no hay checkbox en el checkout, solo una nota informativa.
 *
 * Cuando se desactiva (default):
 *   - Comportamiento legado: el negocio absorbe el flete desde su billetera
 *     de Vendelo sin cobrarlo al cliente.
 *
 * Mismo patrón que CodToggle/MercadoPagoToggle: estado inicial por SSR,
 * PATCH optimista, deshabilitado mientras la petición está en curso.
 */
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api-client'

interface ShippingOnlineToggleProps {
  /** Estado inicial del toggle, leído desde la BD al cargar la página */
  enabled: boolean
}

export function ShippingOnlineToggle({ enabled: initial }: ShippingOnlineToggleProps) {
  const { data: session } = useSession()
  const [enabled, setEnabled] = useState(initial)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    setLoading(true)
    try {
      const res = await apiClient(session?.user?.accessToken).patch<void>(
        '/admin/settings/shipping-online',
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
