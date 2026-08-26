'use client'

/**
 * Wrapper del SessionProvider de NextAuth para el layout raíz.
 *
 * Por qué existe este archivo:
 *   SessionProvider (de next-auth/react) es un Client Component — usa context
 *   de React para distribuir la sesión a todos los componentes hijos.
 *   El layout raíz (app/layout.tsx) es un Server Component y no puede importar
 *   Client Components directamente con JSX.
 *
 *   La solución estándar es crear este thin wrapper 'use client' que simplemente
 *   re-exporta el SessionProvider. El Server Component importa este wrapper.
 *
 * Para qué sirve en este proyecto:
 *   Permite usar `useSession()` de next-auth/react en cualquier Client Component,
 *   específicamente en `src/lib/cart.ts` para obtener el userId del usuario
 *   autenticado y usar una clave de localStorage separada por usuario.
 *   Así cada usuario tiene su propio carrito independiente.
 */
import { SessionProvider } from 'next-auth/react'

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
