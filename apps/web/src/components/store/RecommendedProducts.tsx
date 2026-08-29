/**
 * Sección "Productos relacionados" para la página de detalle.
 *
 * RecommendedProducts — async Server Component que se monta dentro de un
 * <Suspense> con RecommendedProductsSkeleton como fallback.
 *
 * Lógica de filtrado:
 *   - Misma categoría que el producto actual (categoryId)
 *   - Excluye el producto actual por su slug
 *   - Solo productos activos con stock > 0
 *   - Máximo 4 resultados, ordenados por más recientes
 *
 * Si no hay productos relacionados, el componente retorna null sin dejar
 * espacio en blanco (la sección desaparece limpiamente).
 */
import { getCachedRelatedProducts } from '@/lib/cache'
import { ProductCard } from './ProductCard'
import { SkeletonBlock, SkeletonLine } from '@/components/ui/Skeleton'

// ── Skeleton ──────────────────────────────────────────────────────────────────

/** Fallback para el <Suspense> que envuelve a RecommendedProducts. */
export function RecommendedProductsSkeleton() {
  return (
    <section className="mt-8 pt-6 border-t c-border" aria-hidden="true">
      {/* Título skeleton */}
      <SkeletonBlock className="h-7 w-52 mb-6" />

      {/* Grid de 4 tarjetas skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-2xl overflow-hidden border c-border"
          >
            {/* Imagen */}
            <SkeletonBlock className="aspect-square w-full rounded-none" />

            {/* Info */}
            <div className="px-4 pt-3 pb-4 flex flex-col gap-2">
              <SkeletonLine className="w-14 h-3" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-3/4" />
              <SkeletonBlock className="w-24 h-5 mt-1 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface RecommendedProductsProps {
  /** ID de categoría del producto actual — base del filtrado */
  categoryId: string
  /** Slug del producto actual — excluido del resultado */
  excludeSlug: string
}

export async function RecommendedProducts({
  categoryId,
  excludeSlug,
}: RecommendedProductsProps) {
  const products = await getCachedRelatedProducts(categoryId, excludeSlug)

  if (products.length === 0) return null

  return (
    <section className="mt-8 pt-6 border-t border-gray-100">
      <h2 className="text-xl font-bold c-text mb-6">
        Productos relacionados
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            priority={index < 2}
          />
        ))}
      </div>
    </section>
  )
}
