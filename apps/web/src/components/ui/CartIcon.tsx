'use client'

import { useCart } from '@/lib/cart'
import { useCartDrawer } from '@/lib/cart-drawer'

/**
 * Ícono del carrito con badge de cantidad.
 * Componente cliente — necesita acceder al store de Zustand (useCart).
 * El badge solo se muestra si hay al menos 1 ítem en el carrito.
 *
 * Abre el panel lateral (CartDrawer) en vez de navegar a /carrito — la vista
 * detallada sigue existiendo en esa ruta, accesible desde el botón
 * "Ver carrito" dentro del drawer.
 */
export function CartIcon() {
  const { count } = useCart()
  const { toggle } = useCartDrawer()
  const itemCount = count()

  return (
    <button
      type="button"
      onClick={toggle}
      className="relative inline-flex items-center justify-center p-2 text-[var(--c-text-2)] hover:text-[var(--c-text)] transition-colors"
      aria-label="Abrir carrito de compras"
    >
      <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>

      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[var(--c-accent)] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  )
}
