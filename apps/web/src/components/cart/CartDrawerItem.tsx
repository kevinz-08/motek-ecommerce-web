'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCart, type CartItem } from '@/lib/cart'
import { cloudinaryUrl } from '@/lib/cloudinary'
import { formatCOP } from '@/lib/format'

interface CartDrawerItemProps {
  item: CartItem
  onNavigate: () => void
}

export function CartDrawerItem({ item, onNavigate }: CartDrawerItemProps) {
  const { product, quantity } = item
  const { removeItem, updateQuantity } = useCart()

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <Link
        href={`/producto/${product.slug}`}
        onClick={onNavigate}
        className="relative w-16 h-16 bg-gray-50 rounded-lg overflow-hidden shrink-0"
      >
        {product.images[0] ? (
          <Image
            src={cloudinaryUrl(product.images[0], 'thumbnail')}
            alt={product.name}
            fill
            className="object-contain p-1.5"
            sizes="64px"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300 text-lg">📦</div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/producto/${product.slug}`} onClick={onNavigate}>
          <h3 className="text-xs font-semibold text-gray-900 hover:text-[var(--c-accent)] line-clamp-2 transition-colors leading-snug">
            {product.name}
          </h3>
        </Link>
        <p className="text-sm font-black text-gray-900 mt-1">
          {formatCOP(product.price * quantity)}
        </p>

        <div className="flex items-center gap-1.5 mt-1.5">
          <button
            onClick={() => updateQuantity(product.id, quantity - 1)}
            className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-600 hover:border-red-400 hover:text-red-600 transition-colors text-sm font-medium"
            aria-label="Reducir cantidad"
          >
            −
          </button>
          <span className="w-5 text-center text-xs font-bold text-gray-900">{quantity}</span>
          <button
            onClick={() => updateQuantity(product.id, Math.min(quantity + 1, product.stock))}
            disabled={quantity >= product.stock}
            className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-600 hover:border-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            aria-label="Aumentar cantidad"
          >
            +
          </button>

          <button
            onClick={() => removeItem(product.id)}
            className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
            aria-label="Eliminar producto"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
