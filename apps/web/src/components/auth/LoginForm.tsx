'use client'

/**
 * Formulario de login con email + contraseña.
 *
 * Se usa tanto en la página completa `/auth/login` (con `callbackUrl` leído
 * de la query string en el servidor y pasado por prop) como dentro de
 * `AuthModal` (donde no hay query string — el `callbackUrl` vive en
 * `useAuthModal`, capturado en el momento del click). Por eso la prioridad
 * de resolución es: prop explícita → store del modal → '/'.
 *
 * Es un Client Component porque necesita manejar estado de error inline
 * (sin redirigir a /auth/error) y mostrar el spinner de carga.
 *
 * Usa `signIn('credentials', ...)` de next-auth/react.
 * Si las credenciales son incorrectas, NextAuth retorna error 'CredentialsSignin'
 * que capturamos y mostramos directamente en el formulario.
 */
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuthModal } from '@/lib/auth-modal'

interface LoginFormProps {
  callbackUrl?: string
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter()
  const modalCallbackUrl = useAuthModal((s) => s.callbackUrl)
  const closeAuthModal = useAuthModal((s) => s.close)
  const resolvedCallbackUrl = callbackUrl ?? modalCallbackUrl ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.code === 'EMAIL_NOT_VERIFIED') {
      closeAuthModal()
      router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`)
      return
    }

    if (result?.error) {
      setError('Correo o contraseña incorrectos. Verifica tus datos.')
      return
    }

    toast.success('¡Bienvenido de nuevo!')
    closeAuthModal()
    router.push(resolvedCallbackUrl)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error inline */}
      {error && (
        <div role="alert" className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium c-text-2 mb-1">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          required
          aria-required="true"
          aria-invalid={!!error}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="w-full bg-[var(--c-surface-2)] border c-border rounded-lg px-4 py-2.5 text-sm c-text placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
        />
      </div>

      {/* Contraseña */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="block text-sm font-medium c-text-2">
            Contraseña
          </label>
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
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
          aria-required="true"
          aria-invalid={!!error}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full bg-[var(--c-surface-2)] border c-border rounded-lg px-4 py-2.5 text-sm c-text placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
        />
      </div>

      {/* Botón */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[var(--c-accent)] text-white py-2.5 rounded-lg text-sm font-bold hover:bg-[var(--c-accent-hover)] active:scale-95 transition-all disabled:opacity-60"
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <p className="text-xs text-center text-[var(--c-text-4)]">
        ¿Olvidaste tu contraseña?{' '}
        <Link href="/auth/forgot-password" className="text-[var(--c-accent)] hover:underline" onClick={closeAuthModal}>
          Recuperar por correo
        </Link>
      </p>
    </form>
  )
}
