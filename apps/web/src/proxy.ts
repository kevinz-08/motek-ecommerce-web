/**
 * Proxy de protección de rutas.
 *
 * En Next.js 16, este archivo reemplaza al antiguo middleware.ts.
 * Cambios importantes respecto a versiones anteriores:
 *   - El archivo se llama proxy.ts (antes: middleware.ts)
 *   - El export se llama `proxy` (antes: export default function middleware)
 *   - Corre en Node.js runtime (antes: Edge Runtime)
 *
 * Por qué Node.js runtime importa:
 *   El Edge Runtime tiene restricciones — no permite usar módulos de Node.js
 *   como `node:crypto`, `node:fs`, etc. Prisma y NextAuth usan estos módulos.
 *   Con Node.js runtime, podemos importar `auth` de NextAuth directamente
 *   sin ningún workaround.
 *
 * Rutas protegidas:
 *   /admin/*     → Solo usuarios con role === 'ADMIN'
 *                  Sin sesión → redirect /auth/login
 *                  Con sesión pero no ADMIN → redirect /
 *
 *   /checkout/*  → YA NO se protege. Con guest checkout, un visitante sin sesión
 *                  tiene que poder llegar al formulario. Quien decide si el flujo
 *                  de invitado está abierto es el backend (Settings
 *                  GUEST_CHECKOUT_ENABLED), y `CheckoutForm` muestra el CTA de
 *                  login cuando no lo está. Las reglas que sí dependen de tener
 *                  cuenta (COD, cupones restringidos) las impone el dominio, no
 *                  este proxy.
 *
 * El matcher en `config.matcher` limita el proxy a solo las rutas necesarias,
 * evitando que corra en cada request (incluyendo assets estáticos, imágenes, etc.)
 */
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
export const proxy = auth((request) => {
  const { nextUrl, auth: session } = request
  const isAdminRoute = nextUrl.pathname.startsWith('/admin')

  if (isAdminRoute) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/auth/login', nextUrl))
    }
    const user = session.user as typeof session.user & { role?: string }
    if (user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/admin/:path*'],
}
