'use client'

/**
 * Reintento del pago del anticipo de un pedido contraentrega que sigue en AWAITING_DEPOSIT
 * (pago rechazado, widget cerrado, regreso desde la pasarela). Pide a la API una transacción
 * Wompi nueva y muestra el widget. Solo el dueño con sesión: COD exige cuenta.
 */

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api-client'
import { WompiWidget } from './WompiWidget'

interface WompiParams {
  publicKey: string
  amountInCents: number
  reference: string
  integritySignature: string
}

export function PayDepositSection({ orderId }: { orderId: string }) {
  const { data: session } = useSession()
  const [params, setParams] = useState<WompiParams | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setLoading(true)
    setError(null)
    const res = await apiClient(session?.user?.accessToken).post<{ payment: WompiParams }>(
      `/orders/${orderId}/deposit-transaction`,
    )
    setLoading(false)
    if (!res.ok) {
      setError(res.error || 'No pudimos iniciar el pago del anticipo. Intenta de nuevo.')
      return
    }
    setParams(res.data.payment)
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
  const redirectUrl = `${origin}/checkout/confirmacion?orderId=${orderId}`

  return (
    <div className="mt-6 bg-white border border-amber-200 rounded-2xl p-6">
      <h2 className="font-bold text-gray-900 mb-1">Paga tu anticipo para confirmar el envío</h2>
      <p className="text-sm text-gray-500 mb-4">
        Tu pedido contraentrega se despacha cuando recibimos el anticipo. Ese valor se descuenta de lo que pagas al recibir.
      </p>
      {params ? (
        <WompiWidget {...params} redirectUrl={redirectUrl} />
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          disabled={loading}
          className="w-full bg-[var(--c-accent)] text-white py-3 rounded-xl font-bold hover:bg-[var(--c-accent-hover)] disabled:opacity-60 transition-colors"
        >
          {loading ? 'Preparando pago...' : 'Pagar anticipo'}
        </button>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  )
}
