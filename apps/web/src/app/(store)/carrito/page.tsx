'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { useCart } from '@/lib/cart'
import { Trash2 } from 'lucide-react'
import { cloudinaryUrl } from '@/lib/cloudinary'
import { EmptyState } from '@/components/ui/EmptyState'
import { ShippingQuoteCalculator } from '@/components/store/ShippingQuoteCalculator'
import type { ShippingQuoteResult } from '@/lib/shipping-quote'
import { formatCOP } from '@/lib/format'

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, selectedCity, setSelectedCity } = useCart()
  const [showConfirm, setShowConfirm] = useState(false)
  const [shippingQuote, setShippingQuote] = useState<ShippingQuoteResult | null>(null)

  const cartTotal  = items.reduce((acc, i) => acc + i.product.price * i.quantity, 0)
  const itemsCount = items.reduce((acc, i) => acc + i.quantity, 0)
  const shippingCost = shippingQuote && !shippingQuote.freeShipping ? shippingQuote.quotedShippingTotal : 0
  const estimatedTotal = cartTotal + shippingCost

  // ── Carrito vacío ─────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <EmptyState
          icon="🛒"
          title="Tu carrito está vacío"
          description="Agrega productos desde el catálogo para continuar con tu compra."
          action={{ label: 'Ver catálogo', href: '/catalogo' }}
        />
      </div>
    )
  }

  // ── Carrito con productos ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">

      {/* Modal confirmación vaciar carrito */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-100">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-black mb-2">¿Vaciar el carrito?</h2>
            <p className="text-black text-sm mb-6">
              Se eliminarán todos los productos. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { clearCart(); setShowConfirm(false) }}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-semibold hover:bg-red-600 transition-colors"
              >
                Vaciar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Tu carrito</h1>
            <p className="text-sm text-gray-400 mt-1">{itemsCount} {itemsCount === 1 ? 'producto' : 'productos'}</p>
          </div>
          <Link href="/catalogo" className="text-sm text-[var(--c-accent)] hover:text-[var(--c-accent-hover)] font-medium transition-colors">
            ← Seguir comprando
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Lista de ítems ── */}
          <div className="lg:col-span-2 space-y-3">
            {items.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex gap-4 bg-gray-50 border border-gray-100 rounded-2xl p-4 hover:border-gray-200 hover:bg-gray-100/70 transition-all"
              >
                {/* Imagen */}
                <Link href={`/producto/${product.slug}`} className="relative w-24 h-24 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                  {product.images[0] ? (
                    <Image
                      src={cloudinaryUrl(product.images[0], 'thumbnail')}
                      alt={product.name}
                      fill
                      className="object-contain p-2"
                      sizes="96px"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-300 text-2xl">📦</div>
                  )}
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/producto/${product.slug}`}>
                    <h3 className="text-sm font-semibold text-gray-900 hover:text-[var(--c-accent)] line-clamp-2 transition-colors leading-snug">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">SKU: {product.sku}</p>
                  <p className="text-base font-black text-gray-900 mt-2">
                    {formatCOP(product.price * quantity)}
                  </p>
                  {quantity > 1 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatCOP(product.price)} × {quantity}
                    </p>
                  )}
                </div>

                {/* Controles */}
                <div className="flex flex-col items-end justify-between shrink-0">
                  {/* Eliminar */}
                  <button
                    onClick={() => removeItem(product.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    aria-label="Eliminar producto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Cantidad */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] transition-colors text-base font-medium"
                      aria-label="Reducir cantidad"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-gray-900">{quantity}</span>
                    <button
                      onClick={() => updateQuantity(product.id, Math.min(quantity + 1, product.stock))}
                      disabled={quantity >= product.stock}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base font-medium"
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Vaciar carrito */}
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 text-sm text-black hover:text-red-500 transition-colors mt-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Vaciar carrito
            </button>
          </div>

          {/* ── Resumen del pedido ── */}
          <div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sticky top-24">
              <h2 className="font-bold text-gray-900 text-lg mb-5">Resumen del pedido</h2>

              {/* Desglose */}
              <div className="space-y-2.5 mb-5">
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex justify-between text-sm">
                    <span className="text-gray-500 line-clamp-1 flex-1 pr-2">
                      {product.name}
                      {quantity > 1 && <span className="text-gray-400"> ×{quantity}</span>}
                    </span>
                    <span className="shrink-0 text-gray-700 font-medium">
                      {formatCOP(product.price * quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Envío */}
              <ShippingQuoteCalculator
                city={selectedCity}
                onCityChange={setSelectedCity}
                items={items.map((i) => ({ productId: i.product.id, quantity: i.quantity }))}
                onQuoteChange={setShippingQuote}
              />

              {/* Total */}
              <div className="border-t border-gray-100 mt-4 pt-4 mb-6">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-gray-900">
                    {shippingCost > 0 ? 'Total estimado' : 'Total'}
                  </span>
                  <span className="text-xl font-black text-gray-900">{formatCOP(estimatedTotal)}</span>
                </div>
                {shippingCost > 0 && (
                  <p className="text-xs text-gray-400 mt-1 text-right">Incluye envío estimado</p>
                )}
              </div>

              {/* CTA principal */}
              <Link
                href="/checkout"
                className="block w-full bg-[var(--c-accent)] text-white py-3.5 px-6 rounded-xl font-bold text-center hover:bg-[var(--c-accent-hover)] active:scale-95 transition-all shadow-sm"
              >
                Finalizar pedido →
              </Link>

              {/* Trust badges */}
              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Pago 100% seguro con Wompi
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
