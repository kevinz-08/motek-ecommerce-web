import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
  description: 'Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <div className="catalog-light min-h-screen c-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <Link href="/" className="c-text font-bold text-lg hover:text-[var(--c-accent)] transition-colors">
            Motek Store
          </Link>
          <h1 className="text-2xl font-black c-text mt-6 mb-2">Recuperar contraseña</h1>
          <p className="c-text-3 text-sm">
            Ingresa tu correo y te enviaremos un enlace de acceso.
          </p>
        </div>

        <div className="c-surface border c-border rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <ForgotPasswordForm />
        </div>

        <p className="text-center text-sm c-text-4 mt-6">
          ¿Recordaste tu contraseña?{' '}
          <Link href="/auth/login" className="text-[var(--c-accent)] hover:underline">
            Inicia sesión
          </Link>
        </p>

      </div>
    </div>
  )
}
