import type { Metadata } from 'next'
import { prisma } from '@/infrastructure/database/prisma-client'
import { BannerManager, type BannerRow, type CategoryOption } from '@/components/admin/BannerManager'

export const metadata: Metadata = { title: 'Banners' }

export default async function AdminBannersPage() {
  const [rows, categoryRows] = await Promise.all([
    prisma.heroBanner.findMany({ orderBy: { order: 'asc' } }),
    prisma.category.findMany({ orderBy: [{ parentId: 'asc' }, { name: 'asc' }] }),
  ])

  const banners: BannerRow[] = rows.map((r) => ({
    id: r.id,
    imageUrl: r.imageUrl,
    imagePublicId: r.imagePublicId,
    imageUrlMobile: r.imageUrlMobile,
    imagePublicIdMobile: r.imagePublicIdMobile,
    title: r.title,
    description: r.description,
    ctaLabel: r.ctaLabel,
    ctaUrl: r.ctaUrl,
    order: r.order,
    isActive: r.isActive,
  }))

  // Categorías padre seguidas de sus subcategorías, en el mismo orden en que
  // se muestran en el dropdown "¿Cuál categoría?" del formulario del banner.
  const categories: CategoryOption[] = categoryRows
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((parent) => [
      { slug: parent.slug, name: parent.name, isChild: false },
      ...categoryRows
        .filter((c) => c.parentId === parent.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((child) => ({ slug: child.slug, name: child.name, isChild: true })),
    ])

  return <BannerManager banners={banners} categories={categories} />
}
