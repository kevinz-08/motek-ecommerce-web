/**
 * Capa de caché para las páginas públicas de la tienda.
 *
 * Usa `unstable_cache` de Next.js para cachear queries de Prisma y use cases
 * de dominio. Cada entrada tiene tags para invalidación granular desde el
 * panel admin vía `revalidateTag`.
 *
 * Tags y su semántica:
 *   products   → cualquier listado o detalle de producto
 *   categories → cualquier listado de categorías
 *   home       → datos específicos de la home (featured products)
 *   catalog    → listados del catálogo (grid con y sin filtros)
 *   hero       → banners del carrusel hero de la home
 *
 * TTLs:
 *   300 s (5 min)   — listados de productos y catálogo (cambian con ventas/stock)
 *   1200 s (20 min) — productos destacados de la home (mismo motivo, ventana más laxa)
 *   3600 s (1 h)    — categorías (cambian raramente)
 *   180 s (3 min)   — grid filtrado (búsquedas con filtros activos)
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/infrastructure/database/prisma-client'
import { PrismaProductRepository } from '@/infrastructure/repositories/PrismaProductRepository'
import { ListProducts, GetProductBySlug, type Product } from '@motek/domain'
import { CACHE_TAGS } from './cache-tags'

export { CACHE_TAGS }

// ── Navegación (navbar, todas las páginas del storefront) ──────────────────────

export type NavCategory = {
  id: string
  name: string
  slug: string
  children: { id: string; name: string; slug: string }[]
}

/**
 * Todas las categorías padre con sus subcategorías, para el nivel inferior del
 * Navbar (fila de categorías + dropdown de cada una). A diferencia de
 * `getCachedHomeCategories` (solo home, recortado a 5), esta trae el árbol
 * completo — se usa en el layout global del storefront.
 */
export const getCachedNavCategories = unstable_cache(
  async (): Promise<NavCategory[]> => {
    const parents = await prisma.category.findMany({
      where: { parentId: null },
      include: { children: { select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    })
    return parents.map((p) => ({ id: p.id, name: p.name, slug: p.slug, children: p.children }))
  },
  ['nav-categories'],
  { revalidate: 3600, tags: [CACHE_TAGS.categories] },
)

// ── Buscar por moto (navbar) ────────────────────────────────────────────────

export type MotorcycleBrandGroup = {
  brand: string
  models: string[]
}

/**
 * Marcas y modelos de moto con al menos un producto compatible cargado
 * (`MotorcycleCompatibility`), agrupados para el dropdown "Buscar por moto"
 * del Navbar. Se consulta directo sobre `MotorcycleCompatibility` — no
 * requiere tocar `ListProducts`. Vacío hasta que el admin cargue
 * compatibilidad; en ese caso el dropdown no se renderiza (ver Navbar).
 */
export const getCachedMotorcycleBrands = unstable_cache(
  async (): Promise<MotorcycleBrandGroup[]> => {
    const rows = await prisma.motorcycleCompatibility.findMany({
      select: { brand: true, model: true },
      distinct: ['brand', 'model'],
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    })
    const byBrand = new Map<string, string[]>()
    for (const row of rows) {
      const models = byBrand.get(row.brand) ?? []
      models.push(row.model)
      byBrand.set(row.brand, models)
    }
    return Array.from(byBrand.entries())
      .map(([brand, models]) => ({ brand, models }))
      .sort((a, b) => a.brand.localeCompare(b.brand))
  },
  ['motorcycle-brands'],
  { revalidate: 3600, tags: [CACHE_TAGS.motorcycles] },
)

// ── Home ──────────────────────────────────────────────────────────────────────

/** Cuántas categorías padre se muestran en el grid de categorías de la home. */
const HOME_CATEGORIES_COUNT = 5

/** Categorías raíz (sin hijos) para el grid "¿Qué estás buscando?" de la home. */
export const getCachedHomeCategories = unstable_cache(
  async () => {
    return prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
      take: HOME_CATEGORIES_COUNT,
    })
  },
  ['home-categories'],
  { revalidate: 3600, tags: [CACHE_TAGS.categories] },
)

/**
 * Productos destacados para la home — uno por categoría distinta, con stock.
 * ORDER BY RANDOM() → rotan cada 20 min (revalidate: 1200). Es también el único
 * mecanismo que sincroniza esta lista con ventas: el webhook de pago que
 * decrementa stock (apps/api) no invalida este tag, así que el TTL es el techo
 * real de cuánto puede tardar un producto vendido en dejar de verse "disponible"
 * en la home. No estirar más sin agregar invalidación real desde el webhook.
 */
const FEATURED_PRODUCTS_COUNT = 6

export const getCachedFeaturedProducts = unstable_cache(
  async () => {
    const repo = new PrismaProductRepository()

    // Pool aleatorio amplio de donde elegir — se filtra en JS por categoría distinta
    // en vez de con una segunda query, para no depender de un IN(...) con ids dinámicos.
    const pool = await prisma.$queryRaw<{ id: string; categoryId: string }[]>`
      SELECT id, "categoryId" FROM "Product"
      WHERE stock > 0 AND "isActive" = true AND "deletedAt" IS NULL
      ORDER BY RANDOM() LIMIT 60
    `
    if (pool.length === 0) return []

    // 1 producto por categoría distinta, hasta completar el cupo.
    const seenCategories = new Set<string>()
    const diverse: typeof pool = []
    for (const row of pool) {
      if (diverse.length >= FEATURED_PRODUCTS_COUNT) break
      if (seenCategories.has(row.categoryId)) continue
      seenCategories.add(row.categoryId)
      diverse.push(row)
    }

    // Si hay menos de FEATURED_PRODUCTS_COUNT categorías con stock disponible, se
    // completa con el resto del pool (única situación en la que se repite categoría).
    if (diverse.length < FEATURED_PRODUCTS_COUNT) {
      const usedIds = new Set(diverse.map((r) => r.id))
      for (const row of pool) {
        if (diverse.length >= FEATURED_PRODUCTS_COUNT) break
        if (usedIds.has(row.id)) continue
        diverse.push(row)
        usedIds.add(row.id)
      }
    }

    return Promise.all(diverse.map((r) => repo.findById(r.id).then((p) => p!)))
  },
  ['home-featured-products'],
  { revalidate: 1200, tags: [CACHE_TAGS.products, CACHE_TAGS.home] },
)

/** Banners activos del carrusel hero, en el orden definido desde /admin/banners. */
export const getCachedHeroBanners = unstable_cache(
  async () => {
    return prisma.heroBanner.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })
  },
  ['home-hero-banners'],
  { revalidate: 3600, tags: [CACHE_TAGS.hero] },
)

/** Cuántos productos se muestran en cada showcase de categoría de la home. */
const CATEGORY_SHOWCASE_PRODUCTS_COUNT = 6

export type CategoryShowcaseData = {
  category: { id: string; name: string; slug: string } | null
  products: Product[]
}

/**
 * Showcase de una categoría padre para la home (título + productos más recientes).
 * Incluye productos de las subcategorías de `slug`, igual que el catálogo. Ordenados
 * por `createdAt desc` — siempre los últimos que el admin haya cargado en esa categoría.
 * `slug` y `limit` forman parte de la clave de caché (Next serializa los argumentos),
 * así que cada combinación categoría+cantidad tiene su propia entrada.
 */
export const getCachedCategoryShowcase = unstable_cache(
  async (slug: string, limit: number = CATEGORY_SHOWCASE_PRODUCTS_COUNT): Promise<CategoryShowcaseData> => {
    const category = await prisma.category.findUnique({ where: { slug } })
    if (!category) return { category: null, products: [] }

    const children = await prisma.category.findMany({
      where: { parentId: category.id },
      select: { id: true },
    })
    const categoryIds = [category.id, ...children.map((c) => c.id)]

    const rows = await prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 }, categoryId: { in: categoryIds } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true },
    })

    const repo = new PrismaProductRepository()
    const products = await Promise.all(rows.map((r) => repo.findById(r.id).then((p) => p!)))

    return {
      category: { id: category.id, name: category.name, slug: category.slug },
      products,
    }
  },
  ['home-category-showcase'],
  { revalidate: 300, tags: [CACHE_TAGS.products, CACHE_TAGS.home, CACHE_TAGS.categories] },
)

// ── Catalog grid (parameterized) ──────────────────────────────────────────────

export type CatalogGridParams = {
  categorySlug?: string
  search?: string
  page: number
  inStock?: boolean
  minPrice?: number
  maxPrice?: number
  motorcycleBrand?: string
  motorcycleModel?: string
}

type ParentCategorySlim = {
  id: string; name: string; slug: string
  children: Array<{ id: string; name: string; slug: string }>
}

/**
 * Datos para la vista grid del catálogo (con filtros activos).
 * El parámetro `params` forma parte de la clave de caché — cada combinación
 * única de filtros tiene su propia entrada.
 */
export const getCachedCatalogGrid = unstable_cache(
  async (params: CatalogGridParams) => {
    const repo = new PrismaProductRepository()
    const [result, parentCategories] = await Promise.all([
      new ListProducts(repo).execute({ ...params, limit: 12 }),
      prisma.category.findMany({
        where: { parentId: null },
        include: { children: { select: { id: true, name: true, slug: true } } },
        orderBy: { name: 'asc' },
      }) as Promise<ParentCategorySlim[]>,
    ])
    return { result, parentCategories }
  },
  ['catalog-grid'],
  { revalidate: 180, tags: [CACHE_TAGS.products, CACHE_TAGS.catalog, CACHE_TAGS.categories, CACHE_TAGS.motorcycles] },
)

// ── Product detail ────────────────────────────────────────────────────────────

/**
 * Detalle de producto por slug.
 * Se invalida con `revalidateTag('products')` cuando cualquier producto es
 * modificado desde el panel admin.
 */
export const getCachedProductBySlug = unstable_cache(
  async (slug: string) => {
    const repo = new PrismaProductRepository()
    return new GetProductBySlug(repo).execute(slug)
  },
  ['product-by-slug'],
  { revalidate: 300, tags: [CACHE_TAGS.products] },
)

// ── Related products ──────────────────────────────────────────────────────────

/**
 * Hasta 4 productos de la misma categoría, excluyendo el producto actual.
 * Usado en la sección "Productos relacionados" al pie de la página de detalle.
 * Los argumentos (categoryId + excludeSlug) forman parte de la clave de caché.
 */
export const getCachedRelatedProducts = unstable_cache(
  async (categoryId: string, excludeSlug: string) => {
    const repo = new PrismaProductRepository()
    return repo.findRelatedByCategory(categoryId, excludeSlug)
  },
  ['related-products'],
  { revalidate: 300, tags: [CACHE_TAGS.products] },
)
