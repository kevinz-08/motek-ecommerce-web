import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://motek-store.vercel.app'

/**
 * robots.txt — permite indexar la tienda pública y bloquea lo que no debe
 * aparecer en buscadores: panel admin, rutas API, carrito/checkout, pedidos
 * (el seguimiento lleva un token en la URL) y páginas de cuenta.
 * Coherente con sitemap.ts: nada de lo bloqueado aquí aparece en el sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/checkout', '/carrito', '/pedidos', '/auth/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
