import type { Metadata } from 'next'
import { prisma } from '@/infrastructure/database/prisma-client'
import { CategoryManager, type CategoryRow } from '@/components/admin/CategoryManager'

export const metadata: Metadata = { title: 'Categorías' }

export default async function AdminCategoriasPage() {
  const rows = await prisma.category.findMany({
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { products: true } },
    },
  })

  const categories: CategoryRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    imageUrl: r.imageUrl,
    parentId: r.parentId,
    parent: r.parent,
    _count: { products: r._count.products },
  }))

  return <CategoryManager categories={categories} />
}
