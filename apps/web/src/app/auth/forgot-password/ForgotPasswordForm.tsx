'use client'

import { useState } from 'react'
import { z } from 'zod'

const schema = z.object({
  email: z.email('Ingresa un correo válido'),
})

type State = 'idle' | 'loading' | 'success' | 'error'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError(null)
    setServerError(null)

    const parsed = schema.safeParse({ email })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Correo inválido')
      return
    }

    setState('loading')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok && res.status !== 429) {
        setServerError('Ocurrió un error. Intenta nuevamente.')
        setState('error')
        return
      }

      if (res.status === 429) {
        setServerError('Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.')
        setState('error')
        return
      }

      setState('success')
    } catch {
      setServerError('Error de conexión. Verifica tu internet e intenta de nuevo.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[var(--c-success-bg)] flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-[var(--c-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="c-text font-semibold">Revisa tu correo</p>
        <p className="c-text-3 text-sm leading-relaxed">
          Si el correo está registrado, recibirás el enlace en los próximos minutos.
          Recuerda revisar tu carpeta de spam.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {serverError && (
        <div role="alert" className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-sm rounded-lg px-4 py-3">
          {serverError}
        </div>
      )}

      <div>
        <label htmlFor="forgot-email" className="block text-sm font-medium c-text-2 mb-1">
          Correo electrónico
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          aria-required="true"
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? 'forgot-email-error' : undefined}
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFieldError(null) }}
          placeholder="tu@correo.com"
          className={`w-full bg-[var(--c-surface-2)] border rounded-lg px-4 py-2.5 text-sm c-text placeholder:text-[var(--c-text-4)]
            focus:outline-none transition-colors
            ${fieldError ? 'border-[var(--c-danger)] focus:border-[var(--c-danger)]' : 'c-border focus:border-[var(--c-accent)]'}`}
        />
        {fieldError && (
          <p id="forgot-email-error" role="alert" className="text-[var(--c-danger)] text-xs mt-1">{fieldError}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={state === 'loading'}
        className="w-full bg-[var(--c-accent)] text-white py-2.5 rounded-lg text-sm font-bold
          hover:bg-[var(--c-accent)] active:scale-95 transition-all disabled:opacity-60"
      >
        {state === 'loading' ? 'Enviando...' : 'Enviar enlace de recuperación'}
      </button>
    </form>
  )
}
