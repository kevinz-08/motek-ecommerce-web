/**
 * Página de detalle de producto.
 *
 * Ruta: /producto/[slug]
 * Ejemplo: /producto/pastillas-freno-brembo-yamaha-fz25
 *
 * Es un Server Component que obtiene el producto por su slug único.
 * Si el producto no existe o no está activo (isActive=false), Next.js
 * muestra la página 404 automáticamente via `notFound()`.
 *
 * Incluye generateMetadata para SEO dinámico:
 *   - title: nombre del producto
 *   - description: primeros 160 caracteres de la descripción
 *
 * Layout separa la zona "comprar" (arriba, above the fold) de la zona
 * "informarse" (ProductInfoSection, debajo, fondo c-surface-2):
 *
 * Zona "comprar":
 *   - ProductImageGallery (Client Component): miniaturas verticales a la
 *     izquierda + zoom hover (desktop) / lightbox a pantalla completa (tap).
 *   - SKU, nombre, precio, TrustBadgeRow y UrgencyStockCounter (umbral ≤5).
 *   - AddToCartWithQuantity + PayWithAddiButton — ocultos en mobile
 *     (`hidden md:block`), reemplazados por StickyBuyBar (fixed bottom-0).
 *
 * Zona "informarse" (ProductInfoSection):
 *   - Descripción y beneficios (editable desde el admin).
 *   - ProductCompatibilityTable — tabla estructurada Marca/Modelo/Año a
 *     partir de MotorcycleCompatibility (product.compatible), ya no texto libre.
 *   - Políticas de envíos y cambios/devoluciones.
 */
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@motek/database'
import { getCachedProductBySlug } from '@/lib/cache'
import { AddToCartWithQuantity } from '@/components/store/AddToCartWithQuantity'
import { PayWithAddiButton } from '@/components/store/PayWithAddiButton'
import { ProductImageGallery } from '@/components/store/ProductImageGallery'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { TrustBadgeRow } from '@/components/store/TrustBadgeRow'
import { UrgencyStockCounter } from '@/components/store/UrgencyStockCounter'
import { LiveViewersCounter } from '@/components/store/LiveViewersCounter'
import { PaymentMethodsRow } from '@/components/store/PaymentMethodsRow'
import { StickyBuyBar } from '@/components/store/StickyBuyBar'
import { ProductInfoSection } from '@/components/store/ProductInfoSection'
import {
  RecommendedProducts,
  RecommendedProductsSkeleton,
} from '@/components/store/RecommendedProducts'
import { Badge } from '@/components/ui'
import type { Metadata } from 'next'

export const revalidate = 300

export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    select: { slug: true },
  })
  return products.map((p) => ({ slug: p.slug }))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getCachedProductBySlug(slug)
  if (!result.ok) return { title: 'Producto no encontrado' }
  return {
    title: result.value.name,
    description: result.value.description.slice(0, 160),
  }
}

function formatCOP(cents: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params
  const result = await getCachedProductBySlug(slug)

  if (!result.ok) notFound()

  const product = result.value

  const [freshProduct, structuredDescription, category] = await Promise.all([
    prisma.product.findUnique({ where: { id: product.id }, select: { description: true } }),
    prisma.productDescription.findUnique({
      where: { productId: product.id },
      include: {
        benefits: { orderBy: { order: 'asc' } },
      },
    }),
    prisma.category.findUnique({ where: { id: product.categoryId }, select: { name: true, slug: true } }),
  ])
  const description =
    structuredDescription?.generalDescription ||
    freshProduct?.description ||
    product.description

  return (
    <div className="catalog-light min-h-screen c-bg">
    <div className="max-w-5xl md:max-w-6xl lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-28 md:pb-10">
      <Breadcrumb
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Catálogo', href: '/catalogo' },
          ...(category ? [{ label: category.name, href: `/catalogo?category=${category.slug}` }] : []),
          { label: product.name },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-8 md:gap-10 items-start">

        {/* ── Galería de imágenes (hasta 4) — zona "comprar" ── */}
        <ProductImageGallery
          images={product.images}
          productName={product.name}
        />

        {/* Detalle — zona "comprar": precio, trustbars, prueba social, urgencia y CTA.
            Panel compacto a propósito — la galería es la protagonista en desktop. */}
        <div>
          <p className="text-sm md:text-[13px] c-text-4 mb-1">SKU: {product.sku}</p>
          <h1 className="text-3xl md:text-[28px] lg:text-[32px] font-bold c-text mb-3">{product.name}</h1>
          <p className="text-4xl md:text-[38px] font-bold c-text mb-3">{formatCOP(product.price)}</p>

          <div className="mb-2">
            <TrustBadgeRow />
          </div>

          <div className="mb-2">
            <LiveViewersCounter />
          </div>

          <div className="mb-4">
            <UrgencyStockCounter stock={product.stock} />
          </div>

          <div className="mb-6">
            {product.stock === 0 && <Badge variant="danger" className="md:text-[12px] md:px-2.5 md:py-1">Agotado</Badge>}
            {product.stock > 0 && product.stock > 5 && (
              <Badge variant="success" className="md:text-[12px] md:px-2.5 md:py-1">
                ¡Solo quedan {product.stock} productos en stock, apúrate!
              </Badge>
            )}
          </div>

          {/* CTA principal — oculto en mobile, reemplazado por StickyBuyBar */}
          <div className="hidden md:block">
            <AddToCartWithQuantity product={product} />

            {/* Alternativa de pago — texto que conduce a WhatsApp con consulta pre-armada. */}
            <div className="mt-3">
              <PayWithAddiButton product={product} className="text-sm md:text-[13px] c-text-2" />
            </div>

            <PaymentMethodsRow />
          </div>
        </div>
      </div>

      {/* ── Zona "informarse" — descripción, beneficios, compatibilidad, políticas ── */}
      <ProductInfoSection
        description={description}
        benefits={structuredDescription?.benefits ?? []}
        compatible={product.compatible ?? []}
      />

      {/* ── Productos relacionados ── */}
      <Suspense fallback={<RecommendedProductsSkeleton />}>
        <RecommendedProducts
          categoryId={product.categoryId}
          excludeSlug={product.slug}
        />
      </Suspense>
    </div>

    {/* Sticky bottom bar — solo mobile */}
    <StickyBuyBar product={product} formattedPrice={formatCOP(product.price)} />
    </div>
  )
}
