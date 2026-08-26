'use client'

/**
 * Navbar — barra de navegación principal.
 *
 * ── Corrección de bug (sesión perdida tras 404) ─────────────────────────────
 * El Navbar vive dentro de un <Suspense> (requerido por useSearchParams).
 * Al navegar a una ruta inexistente (/perfil) y volver con Atrás, el boundary
 * suspende brevemente y el componente remonta desde cero.  En ese intervalo
 * useSession() parte de status:"loading" → session=null → firstName="Mi cuenta"
 * y los event-handlers aún no están conectados.
 *
 * Dos correcciones:
 *   1. Cachear el firstName en sessionStorage.  Al remontar, el useEffect
 *      lee el valor guardado → no hay flash de "Mi cuenta".
 *   2. Reemplazar el link a /perfil (ruta inexistente) por ProfileModal.
 *      Esto elimina la fuente del 404 y evita que el ciclo se repita.
 *
 * ── Layouts ─────────────────────────────────────────────────────────────────
 *   isCatalog  → barra compacta con buscador central
 *   default    → barra de DOS niveles: superior (logo/búsqueda/cuenta/carrito)
 *                + inferior (todas las categorías reales + "Ver todo el catálogo")
 *
 * ── Categorías ──────────────────────────────────────────────────────────────
 * Vienen del árbol real de la base de datos (`getCachedNavCategories` en
 * lib/cache.ts), pasadas como prop desde `(store)/layout.tsx` — un Server
 * Component las trae una sola vez y las inyecta en este client component.
 * Cada categoría con subcategorías abre un dropdown angosto (solo texto,
 * alineado justo debajo del trigger); sin subcategorías es un link plano.
 *
 * ── Tema ────────────────────────────────────────────────────────────────────
 * Storefront público en modo claro fijo (docs/design-system.md §1.1):
 * fondo blanco, texto negro/gris, acento rojo solo en CTA/estado activo.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { toast } from 'sonner'
import { CartIcon } from '@/components/ui/CartIcon'
import { ProfileModal } from '@/components/nav/ProfileModal'
import { useAuthModal } from '@/lib/auth-modal'
import type { NavCategory, MotorcycleBrandGroup } from '@/lib/cache'

/** Sentinel de `openCategory`/`mobileCatOpen` para el dropdown "Buscar por moto" (no es un slug de categoría real). */
const MOTO_KEY = '__moto__'

function motoUrl(brand: string, model?: string): string {
  const params = new URLSearchParams({ motoMarca: brand })
  if (model) params.set('motoModelo', model)
  return `/catalogo?${params.toString()}`
}

interface Suggestion {
  id: string
  name: string
  slug: string
  price: number
  priceLabel: string
  image: string | null
  stock: number
  categoryName: string | null
  categorySlug: string | null
}

const SESSION_KEY = 'motek-store-user-firstname'

interface NavbarProps {
  categories: NavCategory[]
  motorcycleBrands: MotorcycleBrandGroup[]
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export function Navbar({ categories, motorcycleBrands }: NavbarProps) {
  const { data: session, status } = useSession()
  const user = session?.user as
    | { name?: string | null; email?: string | null; role?: string }
    | undefined
  const isAdmin = user?.role === 'ADMIN'

  // ── Corrección: caché del nombre en sessionStorage ────────────────────────
  // Arranca con "Mi cuenta" para evitar mismatch SSR/cliente.
  // En el primer useEffect del cliente carga el valor cacheado,
  // y cuando la sesión resuelve actualiza el caché para futuros remounts.
  const [cachedName, setCachedName] = useState<string>('Mi cuenta')

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) setCachedName(saved)
  }, [])

  useEffect(() => {
    const name = user?.name?.split(' ')[0]
    if (name) {
      setCachedName(name)
      sessionStorage.setItem(SESSION_KEY, name)
    }
  }, [user?.name])

  // Durante "loading" usar el nombre cacheado → evita flash de "Mi cuenta"
  const firstName = status === 'loading'
    ? cachedName
    : (user?.name?.split(' ')[0] ?? cachedName)

  // ── Navegación y buscador ─────────────────────────────────────────────────
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const isCatalog    = pathname === '/catalogo' || pathname.startsWith('/catalogo')
  const openAuthModal = useAuthModal((s) => s.open)

  const [catalogSearch, setCatalogSearch] = useState(searchParams.get('search') ?? '')

  const handleCatalogSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (catalogSearch.trim()) {
      params.set('search', catalogSearch.trim())
    } else {
      params.delete('search')
    }
    params.delete('page')
    router.push(`/catalogo?${params.toString()}`)
  }

  useEffect(() => {
    setCatalogSearch(searchParams.get('search') ?? '')
  }, [searchParams])

  // ── Estados de UI ─────────────────────────────────────────────────────────
  // openCategory: slug de la categoría cuyo dropdown está abierto en el nivel
  // inferior (null = ninguno). Solo uno puede estar abierto a la vez.
  const [openCategory,  setOpenCategory]  = useState<string | null>(null)
  const [userOpen,       setUserOpen]       = useState(false)
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [mobileOpen,     setMobileOpen]     = useState(false)
  const [mobileCatOpen,  setMobileCatOpen]  = useState<string | null>(null)
  // Marca activa en el flyout desktop de "Buscar por moto" (columna derecha de modelos).
  const [activeMotoBrand, setActiveMotoBrand] = useState<string | null>(null)
  // Marca expandida en el acordeón mobile de "Buscar por moto".
  const [mobileMotoBrandOpen, setMobileMotoBrandOpen] = useState<string | null>(null)
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [suggestions,    setSuggestions]    = useState<Suggestion[]>([])
  const [selectedIdx,    setSelectedIdx]    = useState(-1)
  const searchInputRef   = useRef<HTMLInputElement>(null)
  const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestRef       = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSearchOpen(false); setSuggestions([]) }
    }
    if (searchOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [searchOpen])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setSuggestions([])
      }
    }
    if (suggestions.length > 0) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [suggestions.length])

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setSuggestions([]); return }
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      setSuggestions(data.results ?? [])
    } catch {
      setSuggestions([])
    }
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setSelectedIdx(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearchOpen(false)
    setSuggestions([])
    setSearchQuery('')
    router.push(`/catalogo?search=${encodeURIComponent(searchQuery.trim())}`)
  }

  const goToProduct = (slug: string) => {
    setSearchOpen(false)
    setSuggestions([])
    setSearchQuery('')
    router.push(`/producto/${slug}`)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault()
      goToProduct(suggestions[selectedIdx]!.slug)
    }
  }

  // Toast de logout y Google OAuth
  useEffect(() => {
    if (sessionStorage.getItem('motek-store-logout') === '1') {
      sessionStorage.removeItem('motek-store-logout')
      toast.info('Cerraste sesión correctamente')
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get('google_auth') === '1') {
      toast.success('¡Bienvenido! Iniciaste sesión con Google')
      params.delete('google_auth')
      const newSearch = params.toString()
      const cleanUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '')
      window.history.replaceState({}, '', cleanUrl)
    }
  }, [])

  // Cerrar dropdowns al cambiar de ruta
  useEffect(() => {
    setOpenCategory(null)
    setUserOpen(false)
    setMobileOpen(false)
    setMobileMotoBrandOpen(null)
  }, [pathname])

  // Menú mobile: cerrar con Escape y bloquear scroll del body mientras está abierto
  // (mismo comportamiento que CartDrawer).
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
  }, [mobileOpen])

  // ── Click fuera → cerrar dropdowns ────────────────────────────────────────
  // panelRef apunta al panel de categoría abierto para que el mousedown al
  // hacer clic en un link dentro del panel NO cierre el menú antes del click.
  const catRowRef = useRef<HTMLDivElement>(null)
  const panelRef  = useRef<HTMLDivElement>(null)
  const userRef   = useRef<HTMLDivElement>(null)
  const catLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const t = e.target as Node
    const inCatRow   = catRowRef.current?.contains(t)
    const inCatPanel = panelRef.current?.contains(t)
    if (!inCatRow && !inCatPanel) setOpenCategory(null)
    if (userRef.current && !userRef.current.contains(t)) setUserOpen(false)
  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  const handleCatEnter = (slug: string) => {
    if (catLeaveTimer.current) clearTimeout(catLeaveTimer.current)
    setOpenCategory(slug)
  }
  const handleCatLeave = () => {
    catLeaveTimer.current = setTimeout(() => setOpenCategory(null), 120)
  }

  const openProfile = useCallback(() => {
    setUserOpen(false)
    setProfileOpen(true)
  }, [])

  // ── Iniciales para el mini-avatar ─────────────────────────────────────────
  const initials = (user?.name ?? firstName)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'U'

  // ─────────────────────────────────────────────────────────────────────────
  // Dropdown de usuario reutilizado en ambos layouts
  // ─────────────────────────────────────────────────────────────────────────
  function UserDropdown() {
    return (
      <div className="absolute top-full right-0 mt-2 w-56 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl shadow-lg overflow-hidden z-50">
        {session?.user ? (
          <>
            {/* Cabecera clicable → abre modal de perfil */}
            <button
              onClick={openProfile}
              className="w-full text-left px-4 py-3 border-b border-[var(--c-border)] hover:bg-[var(--c-surface-2)] transition-colors group"
            >
              <p className="text-sm font-semibold text-[var(--c-text)] truncate group-hover:text-[var(--c-accent)] transition-colors">
                {firstName}
              </p>
              <p className="text-xs text-[var(--c-text-3)] truncate">{user?.email}</p>
            </button>

            <div className="p-1.5 space-y-0.5">
              {/* Mi cuenta → modal (sin navegar a /perfil) */}
              <button
                onClick={openProfile}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Mi cuenta
              </button>

              <Link
                href="/pedidos"
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                onClick={() => setUserOpen(false)}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Mis pedidos
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                  onClick={() => setUserOpen(false)}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Panel admin
                </Link>
              )}

              <div className="my-1 border-t border-[var(--c-border)]" />
              <button
                onClick={() => { sessionStorage.setItem('motek-store-logout', '1'); signOut({ callbackUrl: '/' }); setUserOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-accent)] hover:bg-[var(--c-active-bg)] rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </>
        ) : (
          <div className="p-1.5 space-y-0.5">
            <button
              type="button"
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
              onClick={() => { setUserOpen(false); openAuthModal('register', pathname) }}
            >
              Crear cuenta
            </button>
            <button
              type="button"
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[var(--c-accent)] hover:bg-[var(--c-active-bg)] rounded-lg transition-colors"
              onClick={() => { setUserOpen(false); openAuthModal('login', pathname) }}
            >
              Iniciar sesión
            </button>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layout catálogo (compacto — se unifica visualmente con la Fase 10)
  // ─────────────────────────────────────────────────────────────────────────
  if (isCatalog) {
    return (
      <>
        <header className="sticky top-0 z-50 bg-[var(--c-bg)] border-b border-[var(--c-border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 h-16 md:h-20">

              {/* Logo — tamaño mayor solo en desktop (md:), mobile sin cambios */}
              <Link href="/" className="shrink-0">
                <Image src="/assets/logo.webp" alt="Motek Store" width={70} height={52} className="object-contain w-[70px] md:w-[100px]" style={{ height: 'auto' }} priority />
              </Link>

              {/* Buscador central */}
              <form onSubmit={handleCatalogSearch} className="flex-1 flex items-center max-w-2xl mx-auto">
                <div className="flex w-full rounded-full overflow-hidden border border-[var(--c-border)] bg-[var(--c-surface)] focus-within:border-[var(--c-accent)] transition-colors">
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Buscar productos..."
                    className="flex-1 bg-transparent text-[var(--c-text)] placeholder-[var(--c-text-3)] text-sm px-5 py-2.5 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="shrink-0 bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-hover)] transition-colors px-5 flex items-center justify-center"
                    aria-label="Buscar"
                  >
                    <svg className="w-4 h-4 text-[var(--c-text-2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>

              {/* Iconos derecha */}
              <div className="shrink-0 flex items-center gap-1">
                <div ref={userRef} className="relative">
                  <button
                    onClick={() => setUserOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors text-sm"
                    aria-label="Mi cuenta"
                    aria-expanded={userOpen}
                  >
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="hidden sm:inline text-xs font-medium">{firstName}</span>
                  </button>
                  {userOpen && <UserDropdown />}
                </div>
                <CartIcon />
              </div>
            </div>
          </div>
        </header>

        {/* Modal de perfil — fuera del <header> para evitar conflictos de z-index/overflow */}
        <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} user={user} />
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layout estándar — DOS NIVELES
  //   Nivel superior: Logo | Búsqueda | Mi cuenta | Carrito
  //   Nivel inferior: 4 dropdowns de categoría | Ver todo el catálogo
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <header className="sticky top-0 z-50 bg-[var(--c-bg)] border-b border-[var(--c-border)]">

        {/* ── Nivel superior ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Orden visual controlado por `order-*` (mobile) / `md:order-*` (desktop) sobre
              los mismos elementos — sin duplicar botones ni refs (el de Cuenta necesita un
              único `userRef` para detectar clicks afuera del dropdown).
              Mobile:  Menú · Buscador · Logo (centrado) · Cuenta · Carrito
              Desktop: Logo · Buscador (inline) · Cuenta · Carrito                        */}
          <div className="flex items-center gap-2 md:gap-4 h-16 md:h-20">

            {/* Hamburguesa — solo mobile, primer elemento */}
            <button
              className="order-1 md:hidden shrink-0 p-2 text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Abrir menú"
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Búsqueda mobile (abre overlay) — solo mobile, segundo elemento */}
            <button
              onClick={() => setSearchOpen(true)}
              className="order-2 md:hidden shrink-0 p-2 text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
              aria-label="Buscar producto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Logo — centrado y con el espacio flexible en mobile (order-3); tamaño fijo
                pegado a la izquierda en desktop (md:order-1). Tamaño mayor solo en
                desktop (md:) — en mobile se mantiene igual. */}
            <Link
              href="/"
              className="order-3 md:order-1 flex-1 md:flex-initial flex justify-center md:justify-start"
            >
              <Image src="/assets/logo.webp" alt="Motek Store" width={80} height={60} className="object-contain w-[80px] md:w-[120px]" style={{ height: 'auto' }} priority />
            </Link>

            {/* Búsqueda desktop (input inline centrado) */}
            <form
              onSubmit={handleCatalogSearch}
              className="hidden md:flex md:order-2 flex-1 items-center max-w-xl mx-auto"
            >
              <div className="flex w-full rounded-full overflow-hidden border border-[var(--c-border)] bg-[var(--c-surface)] focus-within:border-[var(--c-accent)] transition-colors">
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar productos..."
                  className="flex-1 bg-transparent text-[var(--c-text)] placeholder-[var(--c-text-3)] text-sm px-5 py-2.5 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-hover)] transition-colors px-5 flex items-center justify-center"
                  aria-label="Buscar"
                >
                  <svg className="w-4 h-4 text-[var(--c-text-2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Cuenta */}
            <div ref={userRef} className="order-4 md:order-3 relative shrink-0">
              <button
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-1.5 p-2 text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                aria-label="Mi cuenta"
                aria-expanded={userOpen}
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden lg:inline text-xs font-medium">{firstName}</span>
              </button>
              {userOpen && <UserDropdown />}
            </div>

            {/* Carrito */}
            <div className="order-5 md:order-4 shrink-0">
              <CartIcon />
            </div>

          </div>
        </div>

        {/* ── Nivel inferior (desktop) — todas las categorías + "Ver todo el catálogo" ── */}
        <div
          ref={catRowRef}
          className="hidden md:block border-t border-[var(--c-border)]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* flex-wrap en vez de overflow-x-auto a propósito: un ancestro con
                overflow-x distinto de "visible" fuerza overflow-y a "auto" (CSS),
                lo que recortaría los dropdowns que cuelgan hacia abajo. */}
            <nav className="flex items-center flex-wrap gap-1 min-h-11">
              {categories.map((cat) => {
                const hasChildren = cat.children.length > 0
                return (
                  <div
                    key={cat.slug}
                    className="relative shrink-0"
                    onMouseEnter={() => hasChildren && handleCatEnter(cat.slug)}
                    onMouseLeave={() => hasChildren && handleCatLeave()}
                  >
                    <Link
                      href={`/catalogo?category=${cat.slug}`}
                      className="flex items-center gap-1 px-4 h-11 text-sm font-medium tracking-wide whitespace-nowrap text-[var(--c-text-2)] hover:text-[var(--c-text)] transition-colors"
                    >
                      {cat.name}
                      {hasChildren && (
                        <svg
                          className={`w-3 h-3 transition-transform duration-200 ${openCategory === cat.slug ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </Link>

                    {/* Dropdown angosto — solo la lista de subcategorías, alineado bajo el trigger */}
                    {hasChildren && openCategory === cat.slug && (
                      <div
                        ref={panelRef}
                        onMouseEnter={() => handleCatEnter(cat.slug)}
                        onMouseLeave={handleCatLeave}
                        className="absolute top-full left-0 min-w-[200px] max-w-[260px] max-h-80 overflow-y-auto bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] shadow-lg z-50 py-2"
                      >
                        {cat.children.map((child) => (
                          <Link
                            key={child.slug}
                            href={`/catalogo?category=${child.slug}`}
                            onClick={() => setOpenCategory(null)}
                            className="block px-4 py-1.5 text-sm text-[var(--c-text-2)] hover:text-[var(--c-accent)] hover:bg-[var(--c-surface-2)] transition-colors whitespace-nowrap"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* "Buscar por moto" — flyout de dos columnas (marcas → modelos), solo si hay
                  compatibilidad cargada. Reusa el mismo mecanismo hover/leave que las
                  categorías, con MOTO_KEY como sentinel de `openCategory`. */}
              {motorcycleBrands.length > 0 && (
                <div
                  className="relative shrink-0"
                  onMouseEnter={() => {
                    handleCatEnter(MOTO_KEY)
                    setActiveMotoBrand((prev) => prev ?? motorcycleBrands[0]?.brand ?? null)
                  }}
                  onMouseLeave={handleCatLeave}
                >
                  <Link
                    href="/catalogo"
                    className="flex items-center gap-1 px-4 h-11 text-sm font-medium tracking-wide whitespace-nowrap text-[var(--c-text-2)] hover:text-[var(--c-text)] transition-colors"
                  >
                    🔍 Buscar por moto
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 ${openCategory === MOTO_KEY ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Link>

                  {openCategory === MOTO_KEY && (
                    <div
                      ref={panelRef}
                      onMouseEnter={() => handleCatEnter(MOTO_KEY)}
                      onMouseLeave={handleCatLeave}
                      className="absolute top-full left-0 flex min-w-[380px] max-h-80 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] shadow-lg z-50 overflow-hidden"
                    >
                      {/* Columna izquierda — marcas */}
                      <div className="w-40 shrink-0 border-r border-[var(--c-border)] overflow-y-auto py-2">
                        {motorcycleBrands.map((group) => (
                          <button
                            key={group.brand}
                            type="button"
                            onMouseEnter={() => setActiveMotoBrand(group.brand)}
                            className={`w-full text-left px-4 py-1.5 text-sm whitespace-nowrap transition-colors ${
                              activeMotoBrand === group.brand
                                ? 'text-[var(--c-accent)] bg-[var(--c-surface-2)]'
                                : 'text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]'
                            }`}
                          >
                            {group.brand}
                          </button>
                        ))}
                      </div>

                      {/* Columna derecha — modelos de la marca activa */}
                      <div className="flex-1 overflow-y-auto py-2">
                        {(() => {
                          const active = motorcycleBrands.find((g) => g.brand === activeMotoBrand)
                          if (!active) return null
                          const specificModels = active.models.filter((m) => m !== 'Todos los modelos')
                          return (
                            <>
                              <Link
                                href={motoUrl(active.brand)}
                                onClick={() => setOpenCategory(null)}
                                className="block px-4 py-1.5 text-sm font-medium text-[var(--c-accent)] hover:bg-[var(--c-surface-2)] transition-colors whitespace-nowrap"
                              >
                                Ver todos los {active.brand}
                              </Link>
                              {specificModels.map((model) => (
                                <Link
                                  key={model}
                                  href={motoUrl(active.brand, model)}
                                  onClick={() => setOpenCategory(null)}
                                  className="block px-4 py-1.5 text-sm text-[var(--c-text-2)] hover:text-[var(--c-accent)] hover:bg-[var(--c-surface-2)] transition-colors whitespace-nowrap"
                                >
                                  {model}
                                </Link>
                              ))}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Link
                href="/catalogo"
                className="ml-auto shrink-0 flex items-center gap-1 px-4 h-11 text-sm font-semibold whitespace-nowrap text-[var(--c-accent)] hover:text-[var(--c-accent-hover)] transition-colors"
              >
                Ver todo el catálogo
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </nav>
          </div>
        </div>

        {/* ── Menú móvil — drawer a pantalla completa, mismo diseño/animación que CartDrawer ── */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-[150]">
            {/* Overlay */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Panel — entra deslizándose desde la izquierda */}
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación"
              className="absolute top-0 left-0 h-full w-full max-w-sm bg-[var(--c-surface)] shadow-2xl flex flex-col animate-mobileNavIn"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)] shrink-0">
                <Image src="/assets/logo.webp" alt="Electro Motos Tony" width={90} height={68} className="object-contain w-[90px]" style={{ height: 'auto' }} />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                  aria-label="Cerrar menú"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contenido — scrollable */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">

            {categories.map((cat) => {
              const hasChildren = cat.children.length > 0
              if (!hasChildren) {
                return (
                  <Link
                    key={cat.slug}
                    href={`/catalogo?category=${cat.slug}`}
                    className="block px-3 py-2.5 text-sm font-medium text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {cat.name}
                  </Link>
                )
              }
              return (
                <div key={cat.slug}>
                  <button
                    onClick={() => setMobileCatOpen((v) => (v === cat.slug ? null : cat.slug))}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                  >
                    {cat.name}
                    <svg className={`w-4 h-4 transition-transform duration-200 ${mobileCatOpen === cat.slug ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {mobileCatOpen === cat.slug && (
                    <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l border-[var(--c-border)] pl-3">
                      {cat.children.map((child) => (
                        <Link
                          key={child.slug}
                          href={`/catalogo?category=${child.slug}`}
                          className="block px-2 py-1 text-xs text-[var(--c-text-3)] hover:text-[var(--c-accent)] transition-colors"
                          onClick={() => setMobileOpen(false)}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* "Buscar por moto" — acordeón anidado: marca → modelos, mismo patrón que categorías. */}
            {motorcycleBrands.length > 0 && (
              <div>
                <button
                  onClick={() => setMobileCatOpen((v) => (v === MOTO_KEY ? null : MOTO_KEY))}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                >
                  Buscar por moto
                  <svg className={`w-4 h-4 transition-transform duration-200 ${mobileCatOpen === MOTO_KEY ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mobileCatOpen === MOTO_KEY && (
                  <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l border-[var(--c-border)] pl-3">
                    {motorcycleBrands.map((group) => (
                      <div key={group.brand}>
                        <button
                          onClick={() => setMobileMotoBrandOpen((v) => (v === group.brand ? null : group.brand))}
                          className="w-full flex items-center justify-between px-2 py-1 text-xs font-medium text-[var(--c-text-2)] hover:text-[var(--c-accent)] transition-colors"
                        >
                          {group.brand}
                          <svg className={`w-3 h-3 transition-transform duration-200 ${mobileMotoBrandOpen === group.brand ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {mobileMotoBrandOpen === group.brand && (
                          <div className="ml-3 space-y-0.5">
                            <Link
                              href={motoUrl(group.brand)}
                              className="block px-2 py-1 text-xs font-medium text-[var(--c-accent)] transition-colors"
                              onClick={() => setMobileOpen(false)}
                            >
                              Ver todos los {group.brand}
                            </Link>
                            {group.models.filter((m) => m !== 'Todos los modelos').map((model) => (
                              <Link
                                key={model}
                                href={motoUrl(group.brand, model)}
                                className="block px-2 py-1 text-xs text-[var(--c-text-3)] hover:text-[var(--c-accent)] transition-colors"
                                onClick={() => setMobileOpen(false)}
                              >
                                {model}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Link href="/catalogo" className="block px-3 py-2.5 text-sm font-semibold text-[var(--c-accent)] hover:bg-[var(--c-active-bg)] rounded-lg transition-colors" onClick={() => setMobileOpen(false)}>
              Ver todo el catálogo
            </Link>

            {/* Cuenta en móvil */}
            {session?.user ? (
              <>
                <div className="border-t border-[var(--c-border)] pt-2 mt-2">
                  <button
                    onClick={() => { setMobileOpen(false); setProfileOpen(true) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[var(--c-accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-semibold text-[var(--c-text)] truncate">{firstName}</p>
                      <p className="text-xs text-[var(--c-text-3)] truncate">{user?.email}</p>
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => { sessionStorage.setItem('motek-store-logout', '1'); signOut({ callbackUrl: '/' }); setMobileOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--c-accent)] hover:bg-[var(--c-active-bg)] rounded-lg transition-colors"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <div className="border-t border-[var(--c-border)] pt-2 mt-2 space-y-0.5">
                <button
                  type="button"
                  className="w-full text-left block px-3 py-2.5 text-sm font-semibold text-[var(--c-accent)] hover:bg-[var(--c-active-bg)] rounded-lg transition-colors"
                  onClick={() => { setMobileOpen(false); openAuthModal('login', pathname) }}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  className="w-full text-left block px-3 py-2.5 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                  onClick={() => { setMobileOpen(false); openAuthModal('register', pathname) }}
                >
                  Crear cuenta
                </button>
              </div>
            )}

            <Link href="/contacto" className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors" onClick={() => setMobileOpen(false)}>
              Contáctanos
            </Link>
              </div>
            </aside>
          </div>
        )}

        {/* ── Search overlay (mobile) ── */}
        {searchOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh] bg-black/40 backdrop-blur-sm"
            onClick={() => { setSearchOpen(false); setSuggestions([]) }}
          >
            <div
              ref={suggestRef}
              className="w-full max-w-xl mx-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl shadow-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <form id="search-form" onSubmit={handleSearchSubmit} className="flex items-center gap-3 px-5 py-4">
                <svg className="w-5 h-5 shrink-0 text-[var(--c-text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar productos..."
                  className="flex-1 bg-transparent text-[var(--c-text)] text-lg placeholder-[var(--c-text-3)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => { setSearchOpen(false); setSuggestions([]) }}
                  className="shrink-0 p-1.5 text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                  aria-label="Cerrar búsqueda"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </form>

              {suggestions.length > 0 && (
                <div className="border-t border-[var(--c-border)] max-h-[360px] overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goToProduct(s.slug)}
                      onMouseEnter={() => setSelectedIdx(i)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                        i === selectedIdx ? 'bg-[var(--c-surface-2)]' : 'hover:bg-[var(--c-surface-2)]'
                      }`}
                    >
                      <div className="w-12 h-12 shrink-0 rounded-lg bg-[var(--c-surface-2)] flex items-center justify-center overflow-hidden relative">
                        <svg className="absolute inset-0 m-auto w-5 h-5 text-[var(--c-text-4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        {s.image && (
                          <img
                            src={s.image}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain p-1"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--c-text)] truncate">{s.name}</p>
                        <p className="text-xs text-[var(--c-text-3)] mt-0.5">
                          {s.categoryName && <span>{s.categoryName}</span>}
                          <span className="ml-2 font-semibold text-[var(--c-accent)]">{s.priceLabel}</span>
                        </p>
                      </div>
                      {s.stock <= 5 && s.stock > 0 && (
                        <span className="shrink-0 text-[10px] font-semibold text-[var(--c-warning)] bg-[var(--c-warning-bg)] px-2 py-0.5 rounded-full">
                          Últ. {s.stock}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.trim().length >= 2 && suggestions.length === 0 && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-[var(--c-text-3)] text-center py-3">
                    Sin resultados para &ldquo;{searchQuery.trim()}&rdquo;
                  </p>
                </div>
              )}

              <div className="border-t border-[var(--c-border)] px-5 py-3 flex items-center justify-between">
                <button
                  type="submit"
                  form="search-form"
                  className="text-sm font-medium text-[var(--c-accent)] hover:text-[var(--c-accent-hover)] transition-colors"
                >
                  {suggestions.length > 0
                    ? `Ver todos los resultados (${suggestions.length})`
                    : `Buscar "${searchQuery.trim()}" en el catálogo`
                  }
                </button>
                <span className="text-[11px] text-[var(--c-text-4)] flex items-center gap-1">
                  <kbd className="bg-[var(--c-surface-2)] px-1.5 py-0.5 rounded text-[10px]">↵</kbd>
                  <span>para buscar</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Modal de perfil — fuera del <header> para evitar conflictos de z-index/overflow */}
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} user={user} />
    </>
  )
}
