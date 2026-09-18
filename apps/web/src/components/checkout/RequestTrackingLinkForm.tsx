'use client'

/**
 * "Perdí el enlace de mi pedido".
 *
 * Envía el email a `POST /orders/track/request-link`. La API responde SIEMPRE lo
 * mismo, exista o no ese correo, así que este formulario también muestra siempre
 * el mismo mensaje de éxito: si dijera "no encontramos pedidos", cualquiera
 * podría averiguar quién ha comprado en la tienda probando correos.
 */

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { TurnstileWidget } from './TurnstileWidget'

interface RequestTrackingLinkFormProps {
  /** Site key de Turnstile. Vacía = captcha sin configurar; el formulario se bloquea. */
  turnstileSiteKey: string
}

export function RequestTrackingLinkForm({ turnstileSiteKey }: RequestTrackingLinkFormProps) {
  const [email, setEmail] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaNonce, setCaptchaNonce] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!turnstileSiteKey) {
    return (
      <p role="alert" className="text-sm text-gray-500">
        Esta función no está disponible en este momento. Escríbenos desde la
        página de contacto y te ayudamos a ubicar tu pedido.
      </p>
    )
  }

  if (sent) {
    return (
      <div role="status" className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
        <p className="text-sm font-bold text-green-900 mb-1">Revisa tu correo</p>
        <p className="text-sm text-green-800">
          Si hay pedidos asociados a ese correo, te enviamos los enlaces de
          seguimiento. Puede tardar un par de minutos en llegar.
        </p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !captchaToken) return

    setLoading(true)
    setError(null)
    try {
      const res = await apiClient().post('/orders/track/request-link', {
        email: email.trim().toLowerCase(),
        captchaToken,
      })
      if (!res.ok) {
        // El token de captcha es de un solo uso: sin widget nuevo, el reintento
        // fallaría siempre igual.
        setCaptchaToken('')
        setCaptchaNonce((n) => n + 1)
        setError(res.error ?? 'No pudimos procesar la solicitud. Intenta de nuevo.')
        return
      }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="tracking-email" className="block text-sm font-medium text-gray-700 mb-1">
          Correo electrónico
        </label>
        <input
          id="tracking-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--c-accent)]"
          placeholder="tucorreo@ejemplo.com"
        />
        <p className="mt-1 text-xs text-gray-500">
          El mismo que usaste al hacer el pedido.
        </p>
      </div>

      <TurnstileWidget
        siteKey={turnstileSiteKey}
        resetKey={captchaNonce}
        onVerify={setCaptchaToken}
      />

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email.trim() || !captchaToken}
        className="w-full bg-[var(--c-accent)] text-[var(--c-text-on-accent)] py-3 rounded-xl font-bold hover:bg-[var(--c-accent-hover)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Enviando...' : 'Enviarme mis enlaces'}
      </button>
    </form>
  )
}
