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
 *   /checkout/*  → Requiere sesión activa (cualquier usuario autenticado)
 *                  Sin sesión → redirect /auth/login?callbackUrl=/checkout
 *                  El callbackUrl permite volver al checkout después de login.
 *
 * El matcher en `config.matcher` limita el proxy a solo las rutas necesarias,
 * evitando que corra en cada request (incluyendo assets estáticos, imágenes, etc.)
 */
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
export const proxy = auth((request) => {
  const { nextUrl, auth: session } = request
  const isAdminRoute = nextUrl.pathname.startsWith('/admin')
  const isCheckoutRoute = nextUrl.pathname.startsWith('/checkout')

  if (isAdminRoute) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/auth/login', nextUrl))
    }
    const user = session.user as typeof session.user & { role?: string }
    if (user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
  }

  if (isCheckoutRoute && !session?.user) {
    const loginUrl = new URL('/auth/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/admin/:path*', '/checkout/:path*'],
}
