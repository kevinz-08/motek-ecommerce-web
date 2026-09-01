'use client'

/**
 * Widget de pago Wompi — implementación programática.
 *
 * **Por qué este enfoque:**
 * Wompi expone dos formas de integrar el widget. El método con
 * `<form data-render="button">` requiere que el form esté en el DOM ANTES
 * de que `widget.js` dispare su escaneo en `DOMContentLoaded`. Como en
 * SPAs el usuario navega a /checkout y luego transiciona al paso "payment",
 * el form aparece mucho después de `DOMContentLoaded` y Wompi nunca lo
 * encuentra (síntoma: form vacío y ningún botón).
 *
 * Solución: renderizamos nuestro propio botón y, al click, instanciamos
 * `new window.WidgetCheckout({...})` con los params y llamamos a `.open()`.
 * Wompi maneja el resto (modal, redirect al final).
 *
 * **Fallback automático:**
 * Si `window.WidgetCheckout` no está disponible (script bloqueado, network),
 * el botón redirige a `checkout.wompi.co/p/` con los params en la URL —
 * misma experiencia de pago, sin modal embed.
 *
 * **Navegación tras el pago:**
 * El `redirectUrl` que recibe `WidgetCheckout` solo es usado por Wompi para
 * el flujo de redirección 3DS/PSE dentro del propio modal — no navega la
 * página del comercio al cerrar. Por eso el callback de `.open()` navega
 * manualmente a `redirectUrl` cuando detecta que hubo un intento de
 * transacción (el usuario completó el flujo de pago, sin importar el
 * resultado final). Si el usuario cierra el modal sin intentar pagar, no
 * hay `transaction` en el resultado y se queda en /checkout para reintentar.
 */

import { useEffect, useState, useCallback } from 'react'

interface WompiWidgetProps {
  publicKey: string
  amountInCents: number
  reference: string
  integritySignature: string
  redirectUrl: string
}

interface WompiCheckoutInstance {
  open: (callback?: (result: unknown) => void) => void
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: {
      currency: 'COP'
      amountInCents: number
      reference: string
      publicKey: string
      signature: { integrity: string }
      redirectUrl: string
    }) => WompiCheckoutInstance
  }
}

const WOMPI_SCRIPT_URL = 'https://checkout.wompi.co/widget.js'

export function WompiWidget({ publicKey, amountInCents, reference, integritySignature, redirectUrl }: WompiWidgetProps) {
  const [scriptReady, setScriptReady] = useState(
    typeof window !== 'undefined' && typeof window.WidgetCheckout === 'function',
  )
  const [scriptFailed, setScriptFailed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof window.WidgetCheckout === 'function') {
      setScriptReady(true)
      return
    }

    // Si otro componente ya añadió el script, esperamos su load
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WOMPI_SCRIPT_URL}"]`)
    if (existing) {
      const onLoad = () => setScriptReady(true)
      const onError = () => setScriptFailed(true)
      existing.addEventListener('load', onLoad)
      existing.addEventListener('error', onError)
      return () => {
        existing.removeEventListener('load', onLoad)
        existing.removeEventListener('error', onError)
      }
    }

    const script = document.createElement('script')
    script.src = WOMPI_SCRIPT_URL
    script.async = true
    script.onload = () => setScriptReady(true)
    script.onerror = () => setScriptFailed(true)
    document.body.appendChild(script)
    // No removemos el script en cleanup — otros componentes/visitas pueden necesitarlo.
  }, [])

  const handlePay = useCallback(() => {
    // Fallback: si por alguna razón el SDK no cargó, redirect directo a Wompi.
    // Es la misma transacción, solo sin la UX del modal.
    if (typeof window.WidgetCheckout !== 'function') {
      window.location.href = buildWompiUrl({ publicKey, amountInCents, reference, integritySignature, redirectUrl })
      return
    }

    const checkout = new window.WidgetCheckout({
      currency: 'COP',
      amountInCents,
      reference,
      publicKey,
      signature: { integrity: integritySignature },
      redirectUrl,
    })
    // El callback se invoca cuando Wompi cierra el modal, tanto si el pago
    // se completó (aprobado, pendiente o rechazado) como si el usuario lo
    // cerró manualmente. Solo navegamos a la confirmación si hubo un
    // intento real de transacción; si no, el usuario queda en /checkout
    // para reintentar.
    checkout.open((result) => {
      const transaction = (result as { transaction?: { id?: string } } | undefined)?.transaction
      if (transaction?.id) {
        window.location.href = redirectUrl
      }
    })
  }, [publicKey, amountInCents, reference, integritySignature, redirectUrl])

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handlePay}
        disabled={!scriptReady && !scriptFailed}
        className="flex items-center justify-center gap-3 w-full bg-[#00b1eb] hover:bg-[#0099cc] text-white py-3.5 rounded-xl font-bold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
        </svg>
        {!scriptReady && !scriptFailed ? 'Cargando pasarela...' : 'Pagar con Wompi'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        🔒 Pago procesado por Wompi · Certificado PCI DSS
      </p>
    </div>
  )
}

function buildWompiUrl(p: WompiWidgetProps): string {
  const url = new URL('https://checkout.wompi.co/p/')
  url.searchParams.set('public-key', p.publicKey)
  url.searchParams.set('currency', 'COP')
  url.searchParams.set('amount-in-cents', String(p.amountInCents))
  url.searchParams.set('reference', p.reference)
  url.searchParams.set('signature:integrity', p.integritySignature)
  url.searchParams.set('redirect-url', p.redirectUrl)
  return url.toString()
}
