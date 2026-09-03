import type { MetadataRoute } from 'next'
import { prisma } from '@motek/database'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://motek-store.vercel.app'

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  {
    url: BASE_URL,
    changeFrequency: 'daily',
    priority: 1.0,
  },
  {
    url: `${BASE_URL}/catalogo`,
    changeFrequency: 'daily',
    priority: 0.9,
  },
  {
    url: `${BASE_URL}/auth/login`,
    changeFrequency: 'monthly',
    priority: 0.3,
  },
  {
    url: `${BASE_URL}/auth/register`,
    changeFrequency: 'monthly',
    priority: 0.3,
  },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/producto/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...STATIC_ROUTES, ...productRoutes]
}
