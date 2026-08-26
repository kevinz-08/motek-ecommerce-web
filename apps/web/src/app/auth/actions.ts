'use server'

/**
 * Server actions de autenticación.
 *
 * Extraído a su propio archivo (en vez de vivir inline en `login/page.tsx`)
 * para que un Client Component (el modal de auth, o cualquier botón de
 * Google reusable) pueda importarlo — un Server Component puede definir un
 * server action inline dentro de un `<form action={async () => {...}}>`,
 * pero un Client Component no puede declarar `'use server'` en línea.
 */
import { signIn } from '@/lib/auth'

/** Inicia el flujo de Google OAuth y vuelve a `callbackUrl` con `?google_auth=1`. */
export async function signInWithGoogle(callbackUrl: string) {
  const base = callbackUrl || '/'
  const sep = base.includes('?') ? '&' : '?'
  await signIn('google', { redirectTo: `${base}${sep}google_auth=1` })
}
