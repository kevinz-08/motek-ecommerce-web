'use client'

/**
 * Barra fija inferior — solo mobile (md:hidden).
 * Mantiene precio + "Agregar al carrito" siempre visibles al hacer scroll,
 * reemplazando al botón de compra que antes vivía a mitad de página.
 */
import { Product } from '@motek/domain'
import { AddToCartWithQuantity } from '@/components/store/AddToCartWithQuantity'

interface Props {
  product: Product
  formattedPrice: string
}

export function StickyBuyBar({ product, formattedPrice }: Props) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 md:hidden c-bg border-t c-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="font-bold text-lg c-text shrink-0">{formattedPrice}</span>
        <div className="flex-1 min-w-0">
          <AddToCartWithQuantity product={product} compact />
        </div>
      </div>
    </div>
  )
}
