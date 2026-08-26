'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { z } from 'zod'

const schema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  })

type FieldErrors = { password?: string; confirm?: string }
type State = 'idle' | 'loading' | 'success' | 'error'

interface ResetPasswordFormProps {
  token: string
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [state, setState] = useState<State>('idle')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setServerError(null)

    const parsed = schema.safeParse({ password, confirm })
    if (!parsed.success) {
      const errs: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        if (!errs[field]) errs[field] = issue.message
      }
      setFieldErrors(errs)
      return
    }

    setState('loading')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (res.status === 429) {
        setServerError('Demasiados intentos. Espera un momento e intenta de nuevo.')
        setState('error')
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg: string = body?.message ?? ''
        setServerError(
          msg.includes('válido') || msg.includes('expiró')
            ? 'El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.'
            : 'Ocurrió un error. Intenta de nuevo.',
        )
        setState('error')
        return
      }

      setState('success')
      setTimeout(() => router.push('/auth/login'), 2500)
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
        <p className="c-text font-semibold">¡Contraseña actualizada!</p>
        <p className="c-text-3 text-sm">Redirigiendo al inicio de sesión...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {serverError && (
        <div className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-sm rounded-lg px-4 py-3">
          {serverError}
          {serverError.includes('expiró') || serverError.includes('válido') ? (
            <span>
              {' '}
              <Link href="/auth/forgot-password" className="underline font-semibold">
                Solicitar nuevo enlace
              </Link>
            </span>
          ) : null}
        </div>
      )}

      {/* Nueva contraseña */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="block text-sm font-medium c-text-2">
            Nueva contraseña
          </label>
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-xs text-[var(--c-text-4)] hover:c-text-2 transition-colors"
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })) }}
          placeholder="Mínimo 8 caracteres"
          className={`w-full bg-[var(--c-surface-2)] border rounded-lg px-4 py-2.5 text-sm c-text placeholder:text-[var(--c-text-4)]
            focus:outline-none transition-colors
            ${fieldErrors.password ? 'border-[var(--c-danger)] focus:border-[var(--c-danger)]' : 'c-border focus:border-[var(--c-accent)]'}`}
        />
        {fieldErrors.password && (
          <p className="text-[var(--c-danger)] text-xs mt-1">{fieldErrors.password}</p>
        )}
      </div>

      {/* Confirmar contraseña */}
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium c-text-2 mb-1">
          Confirmar contraseña
        </label>
        <input
          id="confirm"
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setFieldErrors((p) => ({ ...p, confirm: undefined })) }}
          placeholder="Repite tu nueva contraseña"
          className={`w-full bg-[var(--c-surface-2)] border rounded-lg px-4 py-2.5 text-sm c-text placeholder:text-[var(--c-text-4)]
            focus:outline-none transition-colors
            ${fieldErrors.confirm ? 'border-[var(--c-danger)] focus:border-[var(--c-danger)]' : 'c-border focus:border-[var(--c-accent)]'}`}
        />
        {fieldErrors.confirm && (
          <p className="text-[var(--c-danger)] text-xs mt-1">{fieldErrors.confirm}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={state === 'loading'}
        className="w-full bg-[var(--c-accent)] text-white py-2.5 rounded-lg text-sm font-bold
          hover:bg-[var(--c-accent)] active:scale-95 transition-all disabled:opacity-60"
      >
        {state === 'loading' ? 'Guardando...' : 'Guardar nueva contraseña'}
      </button>
    </form>
  )
}
