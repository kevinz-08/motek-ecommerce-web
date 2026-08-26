/**
 * Página de inicio de sesión.
 *
 * Opciones:
 *  1. Email + contraseña (CredentialsProvider) — gestionado por LoginForm (client component)
 *  2. Google OAuth — vía GoogleSignInButton (server action compartido en app/auth/actions.ts)
 *
 * Si ya hay sesión activa, redirige al destino (callbackUrl) o a la raíz.
 * Si no tiene cuenta, el link "Crear cuenta" lleva a /auth/register.
 *
 * Esta página sigue existiendo como fallback de los flujos server-side
 * (proxy.ts, checkout, pedidos) que redirigen con `?callbackUrl=` ANTES de
 * que corra JS en el cliente — no pueden abrir el `AuthModal`. Para el resto
 * de los casos (click en "Iniciar sesión" desde la Navbar), se usa el modal,
 * que reusa el mismo `LoginForm`.
 */
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Accede a tu cuenta para gestionar tus pedidos y continuar con tus compras.',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string; verified?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await auth()
  const { callbackUrl, error, verified } = await searchParams

  if (session?.user) redirect(callbackUrl ?? '/')

  return (
    <div className="catalog-light min-h-screen c-bg flex items-center justify-center px-4">
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
          <p className="c-text-3 mt-1 text-sm">Inicia sesión en tu cuenta</p>
        </div>

        {verified && (
          <div className="bg-[var(--c-success-bg)] border border-[var(--c-success)]/30 text-[var(--c-success)] text-sm rounded-lg px-4 py-3 mb-6">
            ✅ Correo verificado correctamente. Ya puedes iniciar sesión.
          </div>
        )}

        {error && (
          <div className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-sm rounded-lg px-4 py-3 mb-6">
            {error === 'CredentialsSignin'
              ? 'Correo o contraseña incorrectos.'
              : 'Error de autenticación. Intenta de nuevo.'}
          </div>
        )}

        {/* Formulario email + contraseña (cliente) */}
        <LoginForm callbackUrl={callbackUrl} />

        {/* Separador */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t c-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="c-surface px-3 text-xs c-text-4">o continúa con</span>
          </div>
        </div>

        <GoogleSignInButton callbackUrl={callbackUrl} />

        {/* Link a registro */}
        <p className="text-sm c-text-3 text-center mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/auth/register" className="text-[var(--c-accent)] font-semibold hover:underline">
            Crear cuenta gratis
          </Link>
        </p>
        <p className='text-sm c-text-3 text-center mt-2'>
          <Link href="/">
            ← Volver a el Inicio
          </Link>
        </p>

        <p className="text-xs c-text-4 text-center mt-3">
          Al ingresar aceptas nuestros términos de uso y política de privacidad.
        </p>
      </div>
    </div>
  )
}
