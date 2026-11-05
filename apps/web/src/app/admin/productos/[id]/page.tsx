import { notFound } from 'next/navigation'
import { PrismaProductRepository } from '@/infrastructure/repositories/PrismaProductRepository'
import { prisma } from '@/infrastructure/database/prisma-client'
import { ProductEditForm } from '@/components/admin/ProductEditForm'
import { AdminHelpButton } from '@/components/admin/AdminHelpButton'
import { productoNuevoHelpContent, productoEditarHelpContent } from '@/components/admin/help-content/producto'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ duplicado?: string }>
}

export default async function EditProductPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { duplicado } = await searchParams
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
      compareAtPrice: raw.compareAtPrice,
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
      {duplicado === '1' && foundProduct && (
        <div
          role="status"
          className="mb-6 max-w-2xl rounded-[var(--radius-md)] border border-[var(--c-warning)] bg-[var(--c-surface)] p-4 text-[length:var(--text-body-sm)] text-[var(--c-text-2)]"
        >
          <p className="font-semibold text-[var(--c-text)]">Copia creada. Antes de publicarla:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            <li>Está <strong>inactiva</strong>: marca &ldquo;Producto activo&rdquo; y guarda cuando esté lista.</li>
            <li>El <strong>stock es 0</strong>: ajústalo al real.</li>
            <li>Cambia el <strong>SKU y el slug</strong> provisionales por los definitivos.</li>
          </ul>
        </div>
      )}
      <ProductEditForm
        product={foundProduct ?? undefined}
        categories={categories}
        initialBenefits={initialBenefits}
        initialCompatibility={initialCompatibility}
      />
    </div>
  )
}
