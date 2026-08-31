'use client'

/**
 * Panel lateral (Side Drawer) del carrito — resumen rápido sin navegar.
 *
 * Se monta una sola vez en apps/web/src/app/(store)/layout.tsx y queda
 * disponible en cualquier ruta del storefront. Su visibilidad la controla
 * `useCartDrawer` (store de UI, no persistido); los datos que muestra vienen
 * de `useCart()` (store de dominio, persistido) — por eso el drawer y la
 * página completa /carrito siempre están sincronizados: ambos leen del mismo
 * store de Zustand.
 */
import Link from 'next/link'
import { useEffect } from 'react'
import { useCart } from '@/lib/cart'
import { useCartDrawer } from '@/lib/cart-drawer'
import { formatCOP } from '@/lib/format'
import { CartDrawerItem } from './CartDrawerItem'

export function CartDrawer() {
  const { isOpen, close } = useCartDrawer()
  const { items } = useCart()

  const subtotal = items.reduce((acc, i) => acc + i.product.price * i.quantity, 0)
  const itemsCount = items.reduce((acc, i) => acc + i.quantity, 0)

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  // Bloquear scroll del body mientras el drawer está abierto
  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn"
        onClick={close}
        aria-hidden="true"
      />

      {/* Panel — entra deslizándose desde la derecha */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        className="absolute top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col animate-cartDrawerIn"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            Tu carrito {itemsCount > 0 && <span className="text-gray-400 font-normal">({itemsCount})</span>}
          </h2>
          <button
            onClick={close}
            className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            aria-label="Cerrar carrito"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
            <div className="text-4xl">🛒</div>
            <p className="text-sm font-semibold text-gray-900">Tu carrito está vacío</p>
            <p className="text-xs text-gray-400">Agrega productos desde el catálogo para continuar.</p>
            <Link
              href="/catalogo"
              onClick={close}
              className="mt-2 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              Ver catálogo →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              {items.map((item) => (
                <CartDrawerItem key={item.product.id} item={item} onNavigate={close} />
              ))}
            </div>

            {/* Footer: subtotal + CTA */}
            <div className="px-5 py-5 border-t border-gray-100 shrink-0 space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-base font-medium text-gray-500">Subtotal</span>
                <span className="text-2xl font-black text-gray-900">{formatCOP(subtotal)}</span>
              </div>
              <p className="text-xs text-gray-400">Envío calculado al finalizar el pedido.</p>

              <Link
                href="/checkout"
                onClick={close}
                className="block w-full bg-red-600 text-white py-4 px-6 rounded-xl font-bold text-lg text-center hover:bg-red-700 active:scale-95 transition-all shadow-sm"
              >
                Finalizar pedido →
              </Link>

              <Link
                href="/carrito"
                onClick={close}
                className="block w-full border border-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold text-center hover:bg-gray-50 active:scale-95 transition-all"
              >
                Ver carrito
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
