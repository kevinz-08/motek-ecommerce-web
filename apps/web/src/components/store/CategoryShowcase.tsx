import Link from 'next/link'
import { Product } from '@motek/domain'
import { ProductCard } from '@/components/store/ProductCard'

interface CategoryShowcaseProps {
  categoryName: string
  categorySlug: string
  products: Product[]
  /** Override del título — si no viene, usa `categoryName`. */
  title?: string
  /** Override del subtítulo — si no viene, usa un texto genérico con `categoryName`. */
  subtitle?: string
  /** Override del texto del link — por defecto "Ver más". */
  ctaLabel?: string
}

/**
 * Sección dedicada a una categoría padre en la home: título + subtítulo +
 * link, en bloque apilado (mayúsculas, negrita), y hasta 6 productos de esa
 * categoría (y sus subcategorías) debajo. Reutilizable — se instancia una
 * vez por categoría destacada (ver home.tsx), con copy propio opcional.
 */
export function CategoryShowcase({
  categoryName, categorySlug, products, title, subtitle, ctaLabel,
}: CategoryShowcaseProps) {
  if (products.length === 0) return null

  return (
    <section className="py-20 px-4 bg-[var(--c-surface)] border-t border-[var(--c-border)]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-[var(--c-text)]">
            {title ?? categoryName}
          </h2>
          <p className="mt-2 text-sm md:text-base font-semibold uppercase tracking-wide text-[var(--c-text-2)]">
            {subtitle ?? `Lo mejor en ${categoryName.toLowerCase()} para tu moto`}
          </p>
          <Link
            href={`/catalogo?category=${categorySlug}`}
            className="mt-3 inline-block text-sm font-bold uppercase tracking-wide text-[var(--c-accent)] hover:text-[var(--c-accent-hover)] transition-colors"
          >
            {ctaLabel ?? 'Ver más'}
          </Link>
        </div>
        <div className="flex items-stretch gap-4 md:gap-6 overflow-x-auto scrollbar-hide pb-2">
          {products.map((product) => (
            <div key={product.id} className="shrink-0 w-[45vw] sm:w-[220px] md:w-[240px]">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
