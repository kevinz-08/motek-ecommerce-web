'use client'

/**
 * Barra fija inferior — solo mobile (md:hidden).
 * Mantiene precio + "Agregar al carrito" visibles; entra deslizándose solo
 * cuando el CTA inline del PDP (ProductBuyBox) sale de pantalla.
 */
import { Product } from '@motek/domain'
import { AddToCartWithQuantity } from '@/components/store/AddToCartWithQuantity'

interface Props {
  product: Product
  formattedPrice: string
  visible: boolean
  quantity: number
  onQuantityChange: (quantity: number) => void
}

export function StickyBuyBar({ product, formattedPrice, visible, quantity, onQuantityChange }: Props) {
  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={`fixed bottom-0 inset-x-0 z-50 md:hidden c-bg border-t c-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-4 py-3 transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="font-bold text-lg c-text shrink-0">{formattedPrice}</span>
        <div className="flex-1 min-w-0">
          <AddToCartWithQuantity
            product={product}
            compact
            quantity={quantity}
            onQuantityChange={onQuantityChange}
          />
        </div>
      </div>
    </div>
  )
}
