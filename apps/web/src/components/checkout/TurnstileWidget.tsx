'use client'

/**
 * Widget de Cloudflare Turnstile.
 *
 * Solo se usa en los flujos sin sesión (checkout de invitado y recuperación de
 * enlaces de seguimiento): son los únicos endpoints que un bot puede golpear sin
 * credenciales. El token que produce es de un solo uso y lo verifica la API
 * contra Cloudflare — el frontend nunca decide si el captcha pasó.
 *
 * Renderizado explícito en vez del implícito (`class="cf-turnstile"`): el modo
 * implícito escanea el DOM al cargar el script y necesita un callback global,
 * lo que se lleva mal con el montaje/desmontaje de React.
 *
 * Para reintentar tras un envío fallido, el padre cambia la prop `resetKey` —
 * el widget se desmonta y se vuelve a montar limpio. Es necesario porque un
 * token ya consumido no sirve para el segundo intento.
 */

import { useEffect, useRef, useState } from 'react'

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      callback: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
      theme?: 'light' | 'dark' | 'auto'
    },
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/** Carga el script una sola vez por página, aunque haya varios widgets. */
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()

  const existing = document.getElementById(SCRIPT_ID)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('turnstile-script-error')))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('turnstile-script-error'))
    document.head.appendChild(script)
  })
}

interface TurnstileWidgetProps {
  siteKey: string
  /** Recibe el token resuelto, o `''` cuando expira o falla (el padre debe bloquear el envío). */
  onVerify: (token: string) => void
  /** Cambiar este valor fuerza un widget nuevo — úsalo tras un envío fallido. */
  resetKey?: number
}

export function TurnstileWidget({ siteKey, onVerify, resetKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptError, setScriptError] = useState(false)

  // `onVerify` suele ser una función nueva en cada render del padre; guardarla en
  // un ref evita que el efecto se vuelva a ejecutar (y el widget se re-renderice)
  // en cada tecla que el usuario escribe en el formulario.
  const onVerifyRef = useRef(onVerify)
  // La asignación va en un efecto sin deps (corre tras cada render) y no en el
  // cuerpo del componente: escribir un ref durante el render rompe con el React
  // Compiler, que está activado en este proyecto.
  useEffect(() => {
    onVerifyRef.current = onVerify
  })

  useEffect(() => {
    let widgetId: string | null = null
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => onVerifyRef.current(token),
          // Un token expirado o con error vale lo mismo que no tener token: se
          // limpia para que el botón de envío vuelva a quedar deshabilitado.
          'expired-callback': () => onVerifyRef.current(''),
          'error-callback': () => onVerifyRef.current(''),
        })
      })
      .catch(() => {
        if (!cancelled) setScriptError(true)
      })

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId)
        } catch {
          // El widget ya pudo haber sido removido junto con el DOM: no es un error.
        }
      }
    }
  }, [siteKey, resetKey])

  if (scriptError) {
    return (
      <p role="alert" className="text-xs text-red-600">
        No pudimos cargar la verificación de seguridad. Revisa tu conexión o
        inicia sesión con tu cuenta para completar la compra.
      </p>
    )
  }

  return <div ref={containerRef} className="min-h-[65px]" />
}
