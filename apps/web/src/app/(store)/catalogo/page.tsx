/**
 * Catálogo de productos — vista única (grid).
 *
 * Breadcrumb + trust strip + sidebar + grid de productos + paginación.
 * El FilterDrawer muestra las 5 categorías padre con sus subcategorías.
 * Sin filtros activos, `/catalogo` muestra el catálogo completo.
 *
 * Server Component. Tema claro/oscuro → CatalogThemeWrapper (client).
 */
import Link from 'next/link'
import type { Metadata } from 'next'
import { ProductCard } from '@/components/store/ProductCard'
import { CatalogThemeWrapper } from '@/components/store/CatalogThemeWrapper'
import { FilterDrawer } from '@/components/store/FilterDrawer'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { prisma } from '@/infrastructure/database/prisma-client'
import type { Product } from '@motek/domain'
import { getCachedCatalogGrid } from '@/lib/cache'
import { EmptyState, Badge, Button } from '@/components/ui'
import { getPaginationPages } from '@/lib/pagination'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{
    category?: string
    search?: string
    page?: string
    inStock?: string
    minPrice?: string
    maxPrice?: string
    motoMarca?: string
    motoModelo?: string
  }>
}

type ChildCatRef = { id: string; name: string; slug: string }

/** Categoría padre con hijos — usada para el FilterDrawer en vista Grid */
type ParentCategorySlim = {
  id: string; name: string; slug: string
  children: ChildCatRef[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUrl(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
) {
  const merged = { ...base, ...overrides }
  const clean = Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== undefined && v !== ''),
  ) as Record<string, string>
  const qs = new URLSearchParams(clean).toString()
  return `/catalogo${qs ? `?${qs}` : ''}`
}

// ── Metadata de categorías (padres) ──────────────────────────────────────────

const CAT: Record<string, { icon: string; desc: string }> = {
  'sistema-electrico': {
    icon: '',
    desc: 'Ramales, reguladores, CDI, bobinas y baterías. Todo para mantener el sistema eléctrico de tu moto en perfectas condiciones.',
  },
  'repuestos': {
    icon: '',
    desc: 'Filtros de aire, bujías, frenos y repuestos de motor. Piezas originales y de calidad para tu moto.',
  },
  'aceites': {
    icon: '',
    desc: 'Aceites Liquimoly y SKY de alta calidad para proteger y alargar la vida útil del motor de tu moto.',
  },
  'llantas': {
    icon: '',
    desc: 'Llantas para asfalto, campo y todo tipo de terreno. Agarre, durabilidad y seguridad en cada kilómetro.',
  },
  'accesorios': {
    icon: '',
    desc: 'Espejos, exploradores, bombillas LED, equipamiento y más accesorios para personalizar tu moto.',
  },
}

const catIcon = (slug: string) => CAT[slug]?.icon ?? '📦'
const catDesc = (slug: string) => CAT[slug]?.desc ?? 'Repuestos de alta calidad para tu moto.'

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { category, search, motoMarca, motoModelo } = await searchParams

  if (motoMarca) {
    const label = `${motoMarca}${motoModelo ? ` ${motoModelo}` : ''}`
    return {
      title: `Repuestos para ${label}`,
      description: `Repuestos y accesorios compatibles con ${label}. Envío a todo Colombia.`,
    }
  }

  if (search) {
    return {
      title: `Resultados para "${search}"`,
      description: `Productos que coinciden con "${search}" en el catálogo de repuestos para motos.`,
    }
  }

  if (category) {
    const cat = await prisma.category.findUnique({ where: { slug: category } })
    if (cat) {
      return {
        title: cat.name,
        description: cat.description ?? catDesc(cat.slug),
      }
    }
  }

  return {
    title: 'Catálogo de repuestos para motos',
    description:
      'Explora nuestro catálogo completo de repuestos, aceites, llantas y accesorios para motos. Envío a todo Colombia.',
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CatalogPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page ?? 1)

  const { result, parentCategories } = await getCachedCatalogGrid({
    categorySlug: params.category,
    search: params.search,
    page,
    inStock: params.inStock === 'true' ? true : undefined,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    motorcycleBrand: params.motoMarca,
    motorcycleModel: params.motoModelo,
  })

  const { items, total, limit } = result.ok
    ? result.value
    : { items: [], total: 0, limit: 12 }

  const totalPages = Math.ceil(total / limit)

  // Busca el nombre de la categoría activa en padres e hijos
  let activeCat: { name: string; slug: string } | undefined
  if (params.category) {
    const parentMatch = parentCategories.find((p) => p.slug === params.category)
    if (parentMatch) {
      activeCat = { name: parentMatch.name, slug: parentMatch.slug }
    } else {
      for (const parent of parentCategories) {
        const child = parent.children.find((c) => c.slug === params.category)
        if (child) { activeCat = { name: child.name, slug: child.slug }; break }
      }
    }
  }

  return (
    <CatalogThemeWrapper>
      <GridView
        items={items}
        parentCategories={parentCategories}
        activeCat={activeCat}
        params={params}
        total={total}
        page={page}
        totalPages={totalPages}
      />
    </CatalogThemeWrapper>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA GRID
// ─────────────────────────────────────────────────────────────────────────────

function GridView({
  items, parentCategories, activeCat, params, total, page, totalPages,
}: {
  items: Product[]
  parentCategories: ParentCategorySlim[]
  activeCat: { name: string; slug: string } | undefined
  params: Record<string, string | undefined>
  total: number
  page: number
  totalPages: number
}) {
  const url = (overrides: Record<string, string | undefined>) =>
    buildUrl(params, overrides)

  const motoLabel = params.motoMarca
    ? `${params.motoMarca}${params.motoModelo ? ` ${params.motoModelo}` : ''}`
    : undefined

  const activeChips: { label: string; removeUrl: string }[] = []
  if (params.category && activeCat) {
    activeChips.push({ label: activeCat.name, removeUrl: url({ category: undefined, page: undefined }) })
  }
  if (motoLabel) {
    activeChips.push({ label: `🏍️ ${motoLabel}`, removeUrl: url({ motoMarca: undefined, motoModelo: undefined, page: undefined }) })
  }
  if (params.search) {
    activeChips.push({ label: `"${params.search}"`, removeUrl: url({ search: undefined, page: undefined }) })
  }
  if (params.inStock === 'true') {
    activeChips.push({ label: 'Solo en stock', removeUrl: url({ inStock: undefined, page: undefined }) })
  }
  if (params.minPrice || params.maxPrice) {
    const label = params.minPrice && params.maxPrice
      ? `$${Number(params.minPrice).toLocaleString('es-CO')} – $${Number(params.maxPrice).toLocaleString('es-CO')}`
      : params.minPrice
        ? `Desde $${Number(params.minPrice).toLocaleString('es-CO')}`
        : `Hasta $${Number(params.maxPrice).toLocaleString('es-CO')}`
    activeChips.push({ label, removeUrl: url({ minPrice: undefined, maxPrice: undefined, page: undefined }) })
  }

  return (
    <div className="catalog-light c-bg min-h-screen">

      {/* ── Breadcrumb + título ── */}
      <div className="border-b c-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <Breadcrumb
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Catálogo', href: '/catalogo' },
              ...(motoLabel ? [{ label: motoLabel }] : activeCat ? [{ label: activeCat.name }] : params.search ? [{ label: 'Búsqueda' }] : []),
            ]}
          />
          <h1 className="text-2xl md:text-3xl font-black c-text">
            {motoLabel
              ? <>Repuestos para {motoLabel}</>
              : activeCat
                ? <>{catIcon(activeCat.slug)} {activeCat.name}</>
                : params.search
                  ? <>Resultados para &ldquo;{params.search}&rdquo;</>
                  : 'Todo el catálogo'}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <FilterDrawer
              categories={parentCategories}
              currentCategory={params.category}
              currentInStock={params.inStock}
              currentSearch={params.search}
              currentMinPrice={params.minPrice}
              currentMaxPrice={params.maxPrice}
            />

            {activeChips.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 flex-wrap">
                {activeChips.map((chip) => (
                  <Link key={chip.label} href={chip.removeUrl}>
                    <Badge variant="info" className="!text-xs px-3 py-1.5 rounded-full gap-1.5 hover:opacity-80 transition-opacity">
                      {chip.label}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Badge>
                  </Link>
                ))}
                <Link href="/catalogo" className="text-xs c-text-3 hover:c-text underline transition-colors">
                  Limpiar todo
                </Link>
              </div>
            )}
          </div>

          <p className="text-sm c-text-3 shrink-0">
            {total} {total === 1 ? 'producto' : 'productos'}
          </p>
        </div>

        {/* Chips en móvil */}
        {activeChips.length > 0 && (
          <div className="sm:hidden flex flex-wrap gap-2 mb-5">
            {activeChips.map((chip) => (
              <Link key={chip.label} href={chip.removeUrl}>
                <Badge variant="info" className="!text-xs px-3 py-1.5 rounded-full gap-1.5">
                  {chip.label}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* ── Grid de productos ── */}
        {items.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="Sin resultados"
            description="No encontramos productos con esos filtros."
            action={{ label: 'Ver todo el catálogo', href: '/catalogo' }}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {items.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 4} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-12 flex-wrap">
                {page > 1 && (
                  <Link href={url({ page: String(page - 1) })}>
                    <Button variant="secondary" size="sm" leftIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                    }>
                      Anterior
                    </Button>
                  </Link>
                )}
                {getPaginationPages(page, totalPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="w-10 h-10 flex items-center justify-center text-sm c-text-3 select-none">
                      …
                    </span>
                  ) : (
                    <Link key={p} href={url({ page: String(p) })}>
                      <Button variant={p === page ? 'primary' : 'secondary'} size="sm" className="!w-10 !px-0">
                        {p}
                      </Button>
                    </Link>
                  )
                )}
                {page < totalPages && (
                  <Link href={url({ page: String(page + 1) })}>
                    <Button variant="secondary" size="sm" rightIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    }>
                      Siguiente
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
