import { notFound } from 'next/navigation'
import { PrismaProductRepository } from '@/infrastructure/repositories/PrismaProductRepository'
import { prisma } from '@/infrastructure/database/prisma-client'
import { ProductEditForm } from '@/components/admin/ProductEditForm'
import { AdminHelpButton } from '@/components/admin/AdminHelpButton'
import { productoNuevoHelpContent, productoEditarHelpContent } from '@/components/admin/help-content/producto'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params
  const repo = new PrismaProductRepository()
  const product = id === 'nuevo'
    ? null
    : await repo.findBySku(id) ?? await repo.findBySlug(id)

  let foundProduct = product
  if (!foundProduct && id !== 'nuevo') {
    const raw = await prisma.product.findUnique({
      where: { id },
      include: { compatible: true },
    })
    if (!raw) notFound()
    foundProduct = {
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      description: raw.description,
      price: raw.price,
      stock: raw.stock,
      sku: raw.sku,
      images: raw.images,
      isActive: raw.isActive,
      weightKg: raw.weightKg,
      heightCm: raw.heightCm,
      widthCm: raw.widthCm,
      lengthCm: raw.lengthCm,
      categoryId: raw.categoryId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      compatible: raw.compatible,
    }
  }

  const [categories, structuredDescription] = await Promise.all([
    prisma.category.findMany(),
    foundProduct
      ? prisma.productDescription.findUnique({
          where: { productId: foundProduct.id },
          include: {
            benefits: { orderBy: { order: 'asc' } },
          },
        })
      : Promise.resolve(null),
  ])

  const initialBenefits = structuredDescription?.benefits.map((b) => ({
    body: b.body,
    order: b.order,
  })) ?? []

  const initialCompatibility = (foundProduct?.compatible ?? []).map((c) => ({
    brand: c.brand,
    model: c.model,
    year: c.year != null ? String(c.year) : '',
  }))

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight">
          {foundProduct ? `Editar: ${foundProduct.name}` : 'Nuevo producto'}
        </h1>
        <AdminHelpButton content={foundProduct ? productoEditarHelpContent : productoNuevoHelpContent} />
      </div>
      <ProductEditForm
        product={foundProduct ?? undefined}
        categories={categories}
        initialBenefits={initialBenefits}
        initialCompatibility={initialCompatibility}
      />
    </div>
  )
}
