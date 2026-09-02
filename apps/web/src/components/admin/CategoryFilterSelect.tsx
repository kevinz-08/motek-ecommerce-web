'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface CategoryOption {
  slug: string
  name: string
}

interface CategoryNode extends CategoryOption {
  children: CategoryOption[]
}

interface CategoryFilterSelectProps {
  categories: CategoryNode[]
  currentSlug?: string
}

export function CategoryFilterSelect({ categories, currentSlug }: CategoryFilterSelectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // El slug actual puede ser una categoría padre o una de sus subcategorías —
  // se resuelve cuál padre está activo para poder mostrar el segundo dropdown.
  const selectedParent =
    categories.find((p) => p.slug === currentSlug) ??
    categories.find((p) => p.children.some((c) => c.slug === currentSlug))

  const selectedChildSlug =
    selectedParent && selectedParent.slug !== currentSlug ? currentSlug : ''

  const navigate = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (slug) {
      params.set('category', slug)
    } else {
      params.delete('category')
    }
    params.delete('page')
    router.push(`/admin/productos?${params.toString()}`)
  }

  const selectClass =
    'bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-4 h-11 text-[length:var(--text-body-sm)] text-[var(--c-text)] focus:outline-none focus:border-[var(--c-accent)] transition-colors cursor-pointer'

  return (
    <div className="flex items-center gap-3">
      <select
        aria-label="Filtrar por categoría"
        value={selectedParent?.slug ?? ''}
        onChange={(e) => navigate(e.target.value)}
        className={selectClass}
      >
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>

      {selectedParent && selectedParent.children.length > 0 && (
        <select
          aria-label="Filtrar por subcategoría"
          value={selectedChildSlug}
          onChange={(e) => navigate(e.target.value || selectedParent.slug)}
          className={selectClass}
        >
          <option value="">Todas las subcategorías</option>
          {selectedParent.children.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
