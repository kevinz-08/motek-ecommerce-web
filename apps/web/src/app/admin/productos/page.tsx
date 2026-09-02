import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { PrismaProductRepository } from '@/infrastructure/repositories/PrismaProductRepository'
import { prisma } from '@/infrastructure/database/prisma-client'
import { CategoryFilterSelect } from '@/components/admin/CategoryFilterSelect'
import { ProductosTable } from '@/components/admin/ProductosTable'

interface PageProps {
  searchParams: Promise<{ search?: string; category?: string; page?: string }>
}

export default async function AdminProductosPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page ?? 1)

  const repo = new PrismaProductRepository()
  const [{ items, total, limit }, categories] = await Promise.all([
    repo.findAll({
      search: params.search,
      categorySlug: params.category,
      includeInactive: true,
      page,
      limit: 20,
    }),
    prisma.category.findMany(),
  ])

  const totalPages = Math.ceil(total / limit)

  // Árbol de categorías (padre + subcategorías) para el dropdown de filtro,
  // derivado de la misma consulta plana que ya se usa para mostrar el nombre en la tabla.
  const categoryTree = categories
    .filter((c) => c.parentId === null)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      children: categories
        .filter((c) => c.parentId === p.id)
        .map((c) => ({ slug: c.slug, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--c-text-3)] uppercase mb-1">
            Catálogo
          </p>
          <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight">Productos</h1>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className="inline-flex items-center gap-2 h-11 px-4 rounded-[var(--radius-md)] bg-[var(--c-accent)] text-white text-[length:var(--text-body)] font-medium hover:bg-[var(--c-accent-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo producto
        </Link>
      </div>

      {/* ── Search + filtro de categoría ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <form method="GET" className="flex-1 min-w-[240px] max-w-sm">
          {params.category && <input type="hidden" name="category" value={params.category} />}
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-[var(--c-text-4)] pointer-events-none" />
            <input
              type="text"
              name="search"
              defaultValue={params.search}
              placeholder="Buscar por nombre, SKU..."
              aria-label="Buscar productos"
              className="w-full h-11 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] pl-10 pr-4 text-[length:var(--text-body-sm)] text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
            />
          </div>
        </form>
        <CategoryFilterSelect categories={categoryTree} currentSlug={params.category} />
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────── */}
      <ProductosTable
        products={items}
        categories={categories}
        emptyMessage={
          params.search
            ? `Sin resultados para "${params.search}"`
            : params.category
            ? 'Sin productos en esta categoría'
            : 'No hay productos aún'
        }
      />

      {/* ── Paginación ─────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav aria-label="Paginación de productos" className="flex items-center gap-1.5">
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/productos?${new URLSearchParams({
                ...(params.search ? { search: params.search } : {}),
                ...(params.category ? { category: params.category } : {}),
                page: String(p),
              })}`}
              aria-current={p === page ? 'page' : undefined}
              className={`w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-xs font-semibold transition-colors ${
                p === page
                  ? 'bg-[var(--c-accent)] text-white'
                  : 'text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-hover)]'
              }`}
            >
              {p}
            </a>
          ))}
          {totalPages > 7 && (
            <span className="text-xs text-[var(--c-text-4)] px-2">··· {totalPages} páginas</span>
          )}
        </nav>
      )}
    </div>
  )
}
