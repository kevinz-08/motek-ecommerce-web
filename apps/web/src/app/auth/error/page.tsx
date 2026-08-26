import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Error de inicio de sesión',
  robots: { index: false, follow: false },
}

const ERROR_MESSAGES: Record<string, { message: string; hint?: string }> = {
  OAuthAccountNotLinked: {
    message: 'Ya existe una cuenta con este email usando otro método de inicio de sesión.',
    hint: 'Inicia sesión con email y contraseña, o usa el mismo proveedor con el que te registraste.',
  },
  OAuthCallbackError: {
    message: 'No se pudo completar el inicio de sesión con Google.',
    hint: 'Es posible que hayas cancelado el proceso. Intenta de nuevo.',
  },
  CredentialsSignin: {
    message: 'Email o contraseña incorrectos.',
    hint: '¿Olvidaste tu contraseña? Puedes restablecerla desde el inicio de sesión.',
  },
  EMAIL_NOT_VERIFIED: {
    message: 'Debes verificar tu correo electrónico antes de iniciar sesión.',
    hint: 'Revisa tu bandeja de entrada y sigue el enlace que te enviamos al registrarte.',
  },
  AccessDenied: {
    message: 'No tienes permiso para acceder a esta cuenta.',
  },
  Verification: {
    message: 'El enlace de verificación expiró o ya fue usado.',
    hint: 'Solicita un nuevo enlace desde la página de inicio de sesión.',
  },
  Configuration: {
    message: 'Error de configuración del servidor de autenticación.',
    hint: 'Nuestro equipo ha sido notificado. Intenta de nuevo más tarde.',
  },
}

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

const DEFAULT_ERROR = {
  message: 'Ocurrió un error al iniciar sesión.',
  hint: 'Si el problema persiste, intenta más tarde o contáctanos por WhatsApp.',
}

export default async function AuthErrorPage({ searchParams }: PageProps) {
  const { error } = await searchParams
  // Importante: usar `?:` y no `&&` porque `"" && X` retorna `""` y el
  // destructure `.message`/`.hint` rompería sobre un string.
  const { message, hint } = (error ? ERROR_MESSAGES[error] : undefined) ?? DEFAULT_ERROR

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
          <p className="c-text-3 mt-1 text-sm">Error de autenticación</p>
        </div>

        {/* Mensaje de error */}
        <div className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 rounded-xl px-5 py-4 mb-8 text-center">
          <p className="text-2xl mb-3">⚠️</p>
          <p className="text-[var(--c-danger)] text-sm font-medium leading-relaxed">{message}</p>
          {hint && (
            <p className="c-text-3 text-xs leading-relaxed mt-2">{hint}</p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-3">
          <Link
            href="/auth/login"
            className="w-full text-center bg-[var(--c-accent)] text-white font-semibold rounded-lg py-2.5 px-4 text-sm hover:bg-[var(--c-accent-hover)] transition-colors"
          >
            Volver a intentar
          </Link>
          <Link
            href="/"
            className="w-full text-center border c-border rounded-lg py-2.5 px-4 text-sm font-medium c-text hover:border-[var(--c-accent)]/40 hover:bg-[var(--c-surface-2)] transition-colors"
          >
            Ir al inicio
          </Link>
        </div>

      </div>
    </div>
  )
}
