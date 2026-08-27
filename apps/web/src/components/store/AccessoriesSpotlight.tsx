import Image from 'next/image'
import Link from 'next/link'
import { Product } from '@motek/domain'
import { CenterModeCarousel } from '@/components/store/CenterModeCarousel'

interface AccessoriesSpotlightProps {
  products: Product[]
}

/**
 * Sección "Accesorios" — banner estático + carrusel center-mode de los
 * accesorios más recientes (ver getCachedCategoryShowcase, orderBy createdAt
 * desc: siempre refleja lo último que el admin haya cargado).
 *
 * Orden responsive vía `order-*` sobre los mismos dos elementos (sin duplicar
 * nada, mismo truco que ya usamos para reordenar el Navbar en mobile):
 *   Mobile:  banner arriba, carrusel abajo (1 columna)
 *   Desktop: banner a la izquierda, carrusel a la derecha (2 columnas)
 */
export function AccessoriesSpotlight({ products }: AccessoriesSpotlightProps) {
  if (products.length === 0) return null

  return (
    <section className="py-20 px-4 bg-[var(--c-surface)] border-t border-[var(--c-border)]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 lg:items-center">

        {/* Columna banner — arriba en mobile, izquierda en desktop.
            aspect-[800/654] coincide con las dimensiones reales del archivo
            (accesoriosBanner.jpg) para que object-cover nunca tenga que
            recortar — el texto que trae la imagen queda siempre completo. */}
        <Link
          href="/catalogo?category=accesorios"
          aria-label="Ver catálogo de Accesorios"
          className="order-1 group relative block w-full aspect-[800/654] rounded-[var(--radius-lg)] overflow-hidden"
        >
          <Image
            src="/assets/heroLandingBanners/accesoriosBanner.jpg"
            alt="Accesorios para moto"
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </Link>

        {/* Columna carrusel — abajo en mobile, derecha en desktop */}
        <div className="order-2 flex flex-col justify-center">
          <div className="mb-10">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-[var(--c-text)]">
              Accesorios para tu moto
            </h2>
            <Link
              href="/catalogo?category=accesorios"
              className="mt-3 inline-block text-sm font-bold uppercase tracking-wide text-[var(--c-accent)] hover:text-[var(--c-accent-hover)] transition-colors"
            >
              Ver más
            </Link>
          </div>

          <CenterModeCarousel products={products} />
        </div>

      </div>
    </section>
  )
}
