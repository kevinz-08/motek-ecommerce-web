'use client'

/**
 * Ofrece vincular a la cuenta los pedidos que se hicieron como invitado con el
 * mismo correo.
 *
 * Es una acción explícita del usuario, no algo automático en el checkout: un
 * email escrito en un formulario no prueba identidad, y vincular por él metería
 * la dirección y el comprobante de un comprador en el panel de otra persona. Acá
 * hay sesión activa, así que la propiedad del correo ya está probada.
 *
 * El backend ignora cualquier email que venga del cliente — usa el del JWT — así
 * que este componente no envía ninguno.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api-client'

interface ClaimGuestOrdersBannerProps {
  /** Cuántos pedidos de invitado hay con el email de esta cuenta. */
  count: number
}

export function ClaimGuestOrdersBanner({ count }: ClaimGuestOrdersBannerProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (count === 0) return null

  const handleClaim = async () => {
    setLoading(true)
    setError(null)
    const res = await apiClient(session?.user?.accessToken).post<{ claimed: number }>('/orders/claim')
    setLoading(false)

    if (!res.ok) {
      setError(res.error ?? 'No pudimos vincular tus pedidos. Intenta de nuevo.')
      return
    }
    // El historial es un Server Component: refresh para que vuelva a consultarse.
    router.refresh()
  }

  return (
    <div className="mb-6 bg-[var(--c-active-bg)] border border-[var(--c-accent)] rounded-xl px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900">
            Tienes {count} {count === 1 ? 'pedido hecho' : 'pedidos hechos'} sin cuenta
          </p>
          <p className="text-sm text-gray-600">
            Los hiciste con este mismo correo. Vincúlalos para verlos siempre acá.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClaim}
          disabled={loading}
          className="bg-[var(--c-accent)] text-[var(--c-text-on-accent)] px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[var(--c-accent-hover)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? 'Vinculando...' : 'Vincular a mi cuenta'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
