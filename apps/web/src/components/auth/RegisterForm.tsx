'use client'

/**
 * Formulario de registro de nuevos usuarios.
 *
 * Extraído de `app/auth/register/page.tsx` para poder reusarlo tanto en la
 * página completa como dentro de `AuthModal`.
 *
 * Flujo:
 *  1. Usuario llena nombre, correo, contraseña y confirmación.
 *  2. Se llama POST {API}/auth/register (valida y crea el usuario en BD con bcrypt).
 *  3. Si es exitoso, redirige a /auth/verify-email con el correo en query string.
 *  4. Si el correo ya existe, muestra error inline.
 *
 * Los usuarios registrados aquí reciben rol CUSTOMER.
 * Para obtener rol ADMIN, un administrador debe cambiarlo desde Prisma Studio o BD.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthModal } from '@/lib/auth-modal'

export function RegisterForm() {
  const router = useRouter()
  const closeAuthModal = useAuthModal((s) => s.close)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedMarketing, setAcceptedMarketing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setLoading(true)

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      })

      const data = (await res.json()) as { error?: string; message?: string }

      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Error al crear la cuenta. Intenta de nuevo.')
        return
      }

      closeAuthModal()
      router.push(`/auth/verify-email?email=${encodeURIComponent(form.email)}`)
    } catch {
      setError('Error de red. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error inline */}
      {error && (
        <div role="alert" className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Nombre completo */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium c-text-2 mb-1">
          Nombre completo *
        </label>
        <input
          id="name"
          type="text"
          required
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Juan Pérez"
          className="w-full bg-[var(--c-surface-2)] border c-border rounded-lg px-4 py-2.5 text-sm c-text placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
        />
      </div>

      {/* Correo electrónico */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium c-text-2 mb-1">
          Correo electrónico *
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="tu@correo.com"
          className="w-full bg-[var(--c-surface-2)] border c-border rounded-lg px-4 py-2.5 text-sm c-text placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
        />
      </div>

      {/* Contraseña */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="block text-sm font-medium c-text-2">
            Contraseña *{' '}
            <span className="text-[var(--c-text-4)] font-normal">(mín. 8 caracteres)</span>
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
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="••••••••"
          className="w-full bg-[var(--c-surface-2)] border c-border rounded-lg px-4 py-2.5 text-sm c-text placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
        />
      </div>

      {/* Confirmar contraseña */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium c-text-2 mb-1">
          Confirmar contraseña *
        </label>
        <input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          placeholder="••••••••"
          className={`w-full bg-[var(--c-surface-2)] rounded-lg px-4 py-2.5 text-sm c-text placeholder:text-[var(--c-text-4)] focus:outline-none transition-colors border ${
            form.confirmPassword && form.password !== form.confirmPassword
              ? 'border-[var(--c-danger)] focus:border-[var(--c-danger)]'
              : 'c-border focus:border-[var(--c-accent)]'
          }`}
        />
        {form.confirmPassword && form.password !== form.confirmPassword && (
          <p className="text-xs text-[var(--c-danger)] mt-1">Las contraseñas no coinciden</p>
        )}
      </div>

      {/* Consentimientos legales */}
      <div className="space-y-3 pt-1">
        {/* Obligatorio: T&C + Privacidad */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            required
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            aria-required="true"
            aria-describedby="terms-description"
            className="mt-0.5 w-4 h-4 shrink-0 rounded c-border bg-[var(--c-surface-2)] text-[var(--c-accent)] focus:ring-[var(--c-accent)] focus:ring-offset-[var(--c-surface)] accent-[var(--c-accent)]"
          />
          <span id="terms-description" className="text-xs c-text-3 leading-relaxed group-hover:c-text-2 transition-colors">
            He leído y acepto los{' '}
            <Link
              href="/legal/terminos-y-condiciones"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
              onClick={(e) => e.stopPropagation()}
            >
              Términos y condiciones
            </Link>{' '}
            y la{' '}
            <Link
              href="/legal/politica-de-privacidad"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
              onClick={(e) => e.stopPropagation()}
            >
              Política de privacidad
            </Link>
            . <span className="text-[var(--c-text-4)]">(Obligatorio)</span>
          </span>
        </label>

        {/* Opcional: marketing */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={acceptedMarketing}
            onChange={(e) => setAcceptedMarketing(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 rounded c-border bg-[var(--c-surface-2)] text-[var(--c-accent)] focus:ring-[var(--c-accent)] focus:ring-offset-[var(--c-surface)] accent-[var(--c-accent)]"
          />
          <span className="text-xs c-text-3 leading-relaxed group-hover:c-text-2 transition-colors">
            Acepto recibir promociones y novedades por correo electrónico.{' '}
            <span className="text-[var(--c-text-4)]">(Opcional)</span>
          </span>
        </label>
      </div>

      {/* Botón de registro */}
      <button
        type="submit"
        disabled={loading || !acceptedTerms}
        aria-disabled={!acceptedTerms}
        className="w-full bg-[var(--c-accent)] text-white py-2.5 rounded-lg text-sm font-bold hover:bg-[var(--c-accent-hover)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
      >
        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>
    </form>
  )
}
