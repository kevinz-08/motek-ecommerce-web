'use client'

/**
 * FilterDrawer — botón "Seleccionar filtros" + panel lateral deslizante.
 *
 * Filtros soportados:
 *   - Categoría (radio) — jerarquía padre → subcategorías expandible
 *   - Disponibilidad / Solo en stock (checkbox)
 *   - Rango de precio en COP pesos (inputs)
 *
 * La sección de categorías muestra las 5 categorías padre. Cada padre tiene
 * un chevron que despliega sus subcategorías. Seleccionar el padre filtra
 * todos sus productos (el repositorio expande el ID padre + hijos).
 * Seleccionar una subcategoría filtra solo esa subcategoría.
 *
 * Al hacer "Aplicar" se navega a /catalogo?...params.
 * Al hacer "Limpiar" se navega a /catalogo (sin params).
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Badge } from '@/components/ui'

interface FilterChild {
  id: string
  name: string
  slug: string
}

interface FilterCategory {
  id: string
  name: string
  slug: string
  children?: FilterChild[]
}

interface Props {
  categories: FilterCategory[]
  currentCategory?: string
  currentInStock?: string
  currentSearch?: string
  currentMinPrice?: string
  currentMaxPrice?: string
}

function buildUrl(filters: {
  category?: string
  inStock?: string
  search?: string
  minPrice?: string
  maxPrice?: string
}) {
  const entries = Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
  const qs = new URLSearchParams(Object.fromEntries(entries) as Record<string, string>).toString()
  return `/catalogo${qs ? `?${qs}` : ''}`
}

/** Devuelve el slug del padre que contiene el slug activo */
function findParentSlug(categories: FilterCategory[], activeSlug: string): string {
  // Si el slug es un padre, devuelve él mismo
  if (categories.some((c) => c.slug === activeSlug)) return activeSlug
  // Si es un hijo, devuelve el padre
  for (const cat of categories) {
    if (cat.children?.some((ch) => ch.slug === activeSlug)) return cat.slug
  }
  return ''
}

export function FilterDrawer({
  categories,
  currentCategory,
  currentInStock,
  currentSearch,
  currentMinPrice,
  currentMaxPrice,
}: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  // Estado local de los filtros dentro del drawer
  const [selCategory, setSelCategory] = useState(currentCategory ?? '')
  const [inStock, setInStock]         = useState(currentInStock === 'true')
  const [minPrice, setMinPrice]       = useState(currentMinPrice ?? '')
  const [maxPrice, setMaxPrice]       = useState(currentMaxPrice ?? '')

  // Qué padre está expandido — al abrir se auto-expande el que contiene el filtro activo
  const [expandedParent, setExpandedParent] = useState<string>(() =>
    currentCategory ? findParentSlug(categories, currentCategory) : ''
  )

  // Sincronizar si los params externos cambian (navegación back/forward)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setSelCategory(currentCategory ?? '')
    setInStock(currentInStock === 'true')
    setMinPrice(currentMinPrice ?? '')
    setMaxPrice(currentMaxPrice ?? '')
    if (currentCategory) {
      setExpandedParent(findParentSlug(categories, currentCategory))
    }
  }, [currentCategory, currentInStock, currentMinPrice, currentMaxPrice, categories])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen])

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  /** Selecciona categoría padre y auto-expande sus hijos */
  const selectParent = useCallback((slug: string) => {
    setSelCategory(slug)
    setExpandedParent((prev) => (prev === slug ? prev : slug))
  }, [])

  /** Alterna la expansión de un padre sin cambiar el filtro seleccionado */
  const toggleExpand = useCallback((slug: string) => {
    setExpandedParent((prev) => (prev === slug ? '' : slug))
  }, [])

  const apply = useCallback(() => {
    router.push(buildUrl({
      category:  selCategory || undefined,
      inStock:   inStock ? 'true' : undefined,
      search:    currentSearch || undefined,
      minPrice:  minPrice ? String(Number(minPrice) * 100) : undefined,
      maxPrice:  maxPrice ? String(Number(maxPrice) * 100) : undefined,
    }))
    setIsOpen(false)
  }, [router, selCategory, inStock, minPrice, maxPrice, currentSearch])

  const clear = useCallback(() => {
    setSelCategory('')
    setInStock(false)
    setMinPrice('')
    setMaxPrice('')
    setExpandedParent('')
    router.push('/catalogo')
    setIsOpen(false)
  }, [router])

  const activeCount = [
    !!currentCategory,
    currentInStock === 'true',
    !!currentMinPrice || !!currentMaxPrice,
  ].filter(Boolean).length

  return (
    <>
      {/* ── Botón trigger ── */}
      <Button
        variant="secondary"
        onClick={() => setIsOpen(true)}
        leftIcon={
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
        }
      >
        Seleccionar filtros
        {activeCount > 0 && (
          <Badge variant="info" className="ml-1">
            {activeCount}
          </Badge>
        )}
      </Button>

      {/* ── Backdrop ── */}
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden
      />

      {/* ── Drawer ── */}
      <aside
        aria-label="Panel de filtros"
        className={`fixed top-0 left-0 h-full w-80 z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            <h2 className="text-base font-bold text-gray-900">Filtros</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar filtros"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* ── Categoría ── */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Categoría</h3>
            <ul className="space-y-0.5">

              {/* "Todas" */}
              <li>
                <button
                  onClick={() => { setSelCategory(''); setExpandedParent('') }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selCategory === '' ? 'c-active-bg c-active-text font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  Todas las categorías
                </button>
              </li>

              {/* Categorías padre con hijos colapsables */}
              {categories.map((cat) => {
                const isExpanded = expandedParent === cat.slug
                const isParentActive = selCategory === cat.slug
                const hasChildren = (cat.children?.length ?? 0) > 0

                return (
                  <li key={cat.id}>
                    {/* Fila del padre */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => selectParent(cat.slug)}
                        className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${isParentActive ? 'c-active-bg c-active-text font-semibold' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
                      >
                        {cat.name}
                      </button>
                      {hasChildren && (
                        <button
                          onClick={() => toggleExpand(cat.slug)}
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                        >
                          <svg
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Subcategorías (expandibles) */}
                    {hasChildren && isExpanded && (
                      <ul className="ml-3 mt-0.5 mb-1 border-l-2 border-gray-100 pl-3 space-y-0.5">
                        {cat.children!.map((child) => (
                          <li key={child.id}>
                            <button
                              onClick={() => setSelCategory(child.slug)}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${selCategory === child.slug ? 'c-active-bg c-active-text font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
                            >
                              {child.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* ── Disponibilidad ── */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Disponibilidad</h3>
            <label className="flex items-center gap-3 cursor-pointer group">
              <span
                onClick={() => setInStock((v) => !v)}
                className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors cursor-pointer ${inStock ? 'bg-[var(--c-accent)] border-[var(--c-accent)]' : 'border-gray-300 group-hover:border-[var(--c-accent)]'}`}
              >
                {inStock && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span
                onClick={() => setInStock((v) => !v)}
                className={`text-sm ${inStock ? 'c-active-text font-semibold' : 'text-gray-600'}`}
              >
                Solo productos en stock
              </span>
            </label>
          </div>

          {/* ── Rango de precio ── */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Precio (COP)</h3>
            <div className="flex items-start gap-2">
              <Input
                type="number"
                min={0}
                placeholder="0"
                label="Mínimo"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="!h-9"
              />
              <span className="text-gray-300 mt-9">—</span>
              <Input
                type="number"
                min={0}
                placeholder="∞"
                label="Máximo"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="!h-9"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Ingresa el valor en pesos colombianos</p>
          </div>

        </div>

        {/* Footer con acciones */}
        <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
          <Button variant="secondary" onClick={clear} className="flex-1">
            Limpiar
          </Button>
          <Button variant="primary" onClick={apply} className="flex-1">
            Aplicar filtros
          </Button>
        </div>
      </aside>
    </>
  )
}
