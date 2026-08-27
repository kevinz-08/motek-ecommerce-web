import Image from 'next/image'
import Link from 'next/link'
import { Product } from '@motek/domain'
import { ProductCard } from '@/components/store/ProductCard'

interface CategoryBannerShowcaseProps {
  bannerSrc: string
  /** Texto alternativo de la imagen (accesibilidad) — no se muestra visualmente. */
  bannerAlt: string
  /** Aspect ratio del archivo de banner, ej. "1694/929" — evita que object-cover recorte. */
  bannerAspect: string
  /** Destino al hacer click en el banner. */
  href: string
  products: Product[]
}

/**
 * Banner clickeable (sin texto superpuesto) + fila de productos debajo.
 * Reutilizable — mismo layout en mobile y desktop (a diferencia de
 * AccessoriesSpotlight, acá no hay reordenamiento responsive porque el
 * banner siempre va arriba de los productos en ambos breakpoints).
 */
export function CategoryBannerShowcase({
  bannerSrc, bannerAlt, bannerAspect, href, products,
}: CategoryBannerShowcaseProps) {
  if (products.length === 0) return null

  return (
    <section className="py-20 px-4 bg-[var(--c-surface)] border-t border-[var(--c-border)]">
      <div className="max-w-7xl mx-auto">
        <Link
          href={href}
          aria-label={bannerAlt}
          className="group relative block w-full rounded-[var(--radius-lg)] overflow-hidden mb-10"
          style={{ aspectRatio: bannerAspect }}
        >
          <Image
            src={bannerSrc}
            alt={bannerAlt}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="100vw"
          />
        </Link>

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
