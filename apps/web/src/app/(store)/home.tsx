/**
 * Landing page principal — tienda Motek.
 *
 * Secciones (de arriba a abajo):
 *   1. HERO — Carrusel full-screen con CTA principal + explorar
 *   2. TRUST BAR — Sellos de confianza con iconos SVG
 *   3. CATEGORÍAS — Grid horizontal de categorías con imágenes
 *   4. PRODUCTOS DESTACADOS — 6 productos in-stock, uno por categoría distinta
 *   5. SHOWCASE LLANTAS — 6 productos de la categoría Llantas
 *   6. ACCESORIOS — Banner + carrusel center-mode de los últimos 4 accesorios
 *   7. SHOWCASE REPUESTOS — 6 productos de la categoría Repuestos
 *   8. ACEITES — Banner (sin texto) + 6 productos de la categoría Aceites
 *   9. SHOWCASE SISTEMA ELÉCTRICO — 6 productos, mismo diseño que Repuestos
 */
import Link from 'next/link'
import { ProductCard } from '@/components/store/ProductCard'
import { HeroBannerCarousel } from '@/components/store/HeroBannerCarousel'
import { TrustBadges } from '@/components/store/TrustBadges'
import { CategoryGrid } from '@/components/store/CategoryGrid'
import { CategoryShowcase } from '@/components/store/CategoryShowcase'
import { AccessoriesSpotlight } from '@/components/store/AccessoriesSpotlight'
import { CategoryBannerShowcase } from '@/components/store/CategoryBannerShowcase'
import {
  getCachedFeaturedProducts,
  getCachedHomeCategories,
  getCachedHeroBanners,
  getCachedCategoryShowcase,
} from '@/lib/cache'

/** Categorías destacadas con sección propia en la home — acordado con negocio. */
const SHOWCASE_CATEGORY_SLUGS = ['llantas', 'repuestos', 'sistema-electrico'] as const

/** Cuántos productos se muestran en el carrusel center-mode de Accesorios. */
const ACCESSORIES_SPOTLIGHT_COUNT = 4

/** Cuántos productos se muestran en la sección de Aceites. */
const ACEITES_SHOWCASE_COUNT = 6

/** Copy personalizado por categoría — si no hay entrada, CategoryShowcase usa su default. */
const SHOWCASE_COPY: Record<string, { title?: string; subtitle?: string; ctaLabel?: string }> = {
  llantas: {
    title: 'Las mejores Llantas del mercado',
    subtitle: 'Las encuentras en Motek Store',
    ctaLabel: 'Ver más',
  },
}

export default async function HomePage() {
  const [featuredProducts, categories, heroBanners, accessoriesShowcase, aceitesShowcase, ...showcases] = await Promise.all([
    getCachedFeaturedProducts(),
    getCachedHomeCategories(),
    getCachedHeroBanners(),
    getCachedCategoryShowcase('accesorios', ACCESSORIES_SPOTLIGHT_COUNT),
    getCachedCategoryShowcase('aceites', ACEITES_SHOWCASE_COUNT),
    ...SHOWCASE_CATEGORY_SLUGS.map((slug) => getCachedCategoryShowcase(slug)),
  ])

  const llantasShowcase = showcases.find((s) => s.category?.slug === 'llantas')
  const repuestosShowcase = showcases.find((s) => s.category?.slug === 'repuestos')
  const sistemaElectricoShowcase = showcases.find((s) => s.category?.slug === 'sistema-electrico')

  const banners = heroBanners.map((b) => ({
    id: b.id,
    src: b.imageUrl,
    srcMobile: b.imageUrlMobile ?? undefined,
    alt: b.title,
    href: b.ctaUrl ?? undefined,
  }))

  return (
    <>
      {/* 1. Hero carrusel con CTA — banners administrables desde /admin/banners */}
      <HeroBannerCarousel banners={banners} />

      {/* 2. Trust badges (iconos SVG) */}
      <TrustBadges />

      {/* 3. Categorías */}
      {categories.length > 0 && <CategoryGrid categories={categories} />}

      {/* 4. Productos destacados */}
      {featuredProducts.length > 0 && (
        <section className="py-20 px-4 bg-[var(--c-surface)] border-t border-[var(--c-border)]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10 max-w-6xl">
              <div>
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-[var(--c-text)]">
                  Productos destacados
                </h2>
                <p className="mt-2 text-sm md:text-base font-semibold uppercase tracking-wide text-[var(--c-text-2)]">
                  Explora productos para tu moto!
                </p>
              </div>
              <Link
                href="/catalogo"
                className="hidden sm:inline-flex items-center gap-1 text-[var(--c-accent)] font-semibold hover:text-[var(--c-accent-hover)] text-sm transition-colors"
              >
                Ver todo
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="flex items-stretch gap-4 md:gap-6 overflow-x-auto scrollbar-hide pb-2">
              {featuredProducts.map((product, index) => (
                <div key={product.id} className="shrink-0 w-[45vw] sm:w-[220px] md:w-[240px]">
                  <ProductCard product={product} priority={index < 2} />
                </div>
              ))}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <Link
                href="/catalogo"
                className="inline-flex items-center gap-1 text-[var(--c-accent)] font-semibold hover:text-[var(--c-accent-hover)] text-sm transition-colors"
              >
                Ver todos los productos
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 5. Showcase Llantas */}
      {llantasShowcase?.category && (
        <CategoryShowcase
          categoryName={llantasShowcase.category.name}
          categorySlug={llantasShowcase.category.slug}
          products={llantasShowcase.products}
          {...SHOWCASE_COPY[llantasShowcase.category.slug]}
        />
      )}

      {/* 6. Accesorios — banner + carrusel center-mode */}
      <AccessoriesSpotlight products={accessoriesShowcase.products} />

      {/* 7. Showcase Repuestos */}
      {repuestosShowcase?.category && (
        <CategoryShowcase
          categoryName={repuestosShowcase.category.name}
          categorySlug={repuestosShowcase.category.slug}
          products={repuestosShowcase.products}
          {...SHOWCASE_COPY[repuestosShowcase.category.slug]}
        />
      )}

      {/* 8. Aceites — banner sin texto + 6 productos */}
      <CategoryBannerShowcase
        bannerSrc="/assets/heroLandingBanners/aceitesBanner.png"
        bannerAlt="Aceites para moto"
        bannerAspect="1694/929"
        href="/catalogo?category=aceites"
        products={aceitesShowcase.products}
      />

      {/* 9. Showcase Sistema Eléctrico — mismo diseño que Repuestos, última sección
             antes del Footer (lo renderiza StoreLayout) */}
      {sistemaElectricoShowcase?.category && (
        <CategoryShowcase
          categoryName={sistemaElectricoShowcase.category.name}
          categorySlug={sistemaElectricoShowcase.category.slug}
          products={sistemaElectricoShowcase.products}
          {...SHOWCASE_COPY[sistemaElectricoShowcase.category.slug]}
        />
      )}
    </>
  )
}
