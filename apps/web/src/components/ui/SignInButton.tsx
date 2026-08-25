'use client'

/**
 * Botón de login en el header.
 * Usa `signIn()` del cliente de NextAuth — abre el flujo de autenticación
 * (redirige a /auth/login o muestra el modal según la configuración).
 * Componente cliente porque `next-auth/react` requiere acceso al contexto de sesión.
 */
import { signIn } from 'next-auth/react'

export function SignInButton() {
  return (
    <button
      onClick={() => signIn()}
      className="text-sm bg-white text-black px-3 py-1.5 rounded-md font-semibold hover:bg-[var(--c-accent)] hover:text-white transition-colors"
    >
      Ingresar
    </button>
  )
}
