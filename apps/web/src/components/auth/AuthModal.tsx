'use client'

/**
 * Modal de autenticación (login/registro).
 *
 * Se abre desde la Navbar ("Iniciar sesión" / "Crear cuenta") en vez de
 * navegar a /auth/login o /auth/register. Las páginas completas siguen
 * existiendo — las usa `proxy.ts` y las páginas server-side (checkout,
 * pedidos) que redirigen ANTES de que corra JS en el cliente, así que no
 * pueden abrir un modal, solo apuntar a una URL.
 *
 * Mismo esqueleto visual/de comportamiento que ProfileModal: backdrop con
 * blur, cierre por click afuera + Escape, scroll-lock del body.
 */
import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuthModal } from '@/lib/auth-modal'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { GoogleSignInButton } from './GoogleSignInButton'

export function AuthModal() {
  const isOpen = useAuthModal((s) => s.isOpen)
  const mode = useAuthModal((s) => s.mode)
  const callbackUrl = useAuthModal((s) => s.callbackUrl)
  const close = useAuthModal((s) => s.close)
  const switchMode = useAuthModal((s) => s.switchMode)

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [isOpen])

  if (!isOpen) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      {/* Panel — `.auth-modal-dark` (ver globals.css) para que LoginForm/
          RegisterForm/GoogleSignInButton, que ahora consumen tokens --c-*, resuelvan
          en oscuro aquí adentro sin necesitar una versión de esos componentes por tema. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        className="auth-modal-dark relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#111] border border-white/10 rounded-2xl shadow-2xl animate-fadeIn"
      >
        {/* Cerrar */}
        <button
          onClick={close}
          aria-label="Cerrar"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/40 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8">
          {/* Encabezado */}
          <div className="text-center mb-6">
            <Link href="/" onClick={close} className="flex items-center gap-2">
              <Image
                src="/assets/logo.webp"
                alt="Motek Store"
                width={80}
                height={60}
                className="object-contain block mx-auto"
              />
            </Link>
            <p className="text-white/50 mt-1 text-sm">
              {mode === 'login' ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta gratuita'}
            </p>
          </div>

          {/* Formulario según el modo */}
          {mode === 'login' ? (
            <LoginForm callbackUrl={callbackUrl ?? undefined} />
          ) : (
            <RegisterForm />
          )}

          {/* Separador */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#111] px-3 text-xs text-white/30">
                {mode === 'login' ? 'o continúa con' : 'o regístrate con'}
              </span>
            </div>
          </div>

          <GoogleSignInButton callbackUrl={callbackUrl ?? undefined} />

          {/* Alternar entre login/registro sin cerrar el modal */}
          <p className="text-sm text-white/40 text-center mt-6">
            {mode === 'login' ? (
              <>
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-[var(--c-accent)] font-semibold hover:underline"
                >
                  Crear cuenta gratis
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-[var(--c-accent)] font-semibold hover:underline"
                >
                  Inicia sesión
                </button>
              </>
            )}
          </p>

          <p className="text-xs text-white/20 text-center mt-3">
            Al ingresar aceptas nuestros términos de uso y política de privacidad.
          </p>
        </div>
      </div>
    </div>
  )
}
