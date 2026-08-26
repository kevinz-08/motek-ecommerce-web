/**
 * Página de registro de nuevos usuarios.
 *
 * Server Component delgado — la lógica del formulario vive en
 * `RegisterForm` (apps/web/src/components/auth/RegisterForm.tsx), reusada
 * también dentro de `AuthModal`. Esta página sigue existiendo para enlaces
 * directos y como fallback si el modal no aplica (ver comentario en
 * `app/auth/login/page.tsx`).
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Crea tu cuenta gratuita para gestionar tus pedidos y continuar con tus compras.',
  robots: { index: false, follow: false },
}

export default function RegisterPage() {
  return (
    <div className="catalog-light min-h-screen c-bg flex items-center justify-center px-4 py-10">
      <div className="c-surface border c-border rounded-2xl p-8 w-full max-w-md shadow-[var(--shadow-lg)]">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/assets/logo.webp"
              alt="Motek Store"
              width={80}
              height={60}
              className="object-contain block mx-auto"
              priority
            />
          </Link>
          <p className="c-text-3 mt-1 text-sm">Crea tu cuenta gratuita</p>
        </div>

        <RegisterForm />

        {/* Separador */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t c-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="c-surface px-3 text-xs c-text-4">o regístrate con</span>
          </div>
        </div>

        <GoogleSignInButton />

        {/* Link a login */}
        <p className="text-sm c-text-3 text-center mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="text-[var(--c-accent)] font-semibold hover:underline">
            Inicia sesión
          </Link>
        </p>

        <p className="text-sm c-text-3 text-center mt-1">
          <Link href="/">← Volver a el Inicio</Link>
        </p>
      </div>
    </div>
  )
}
