'use client'

import { useState } from 'react'
import { Product } from '@motek/domain'
import { toast } from 'sonner'
import { useCart } from '@/lib/cart'
import { useCartDrawer } from '@/lib/cart-drawer'
import { Button } from '@/components/ui'

interface AddToCartWithQuantityProps {
  product: Product
  /** Layout compacto para la sticky bottom bar mobile — stepper más angosto. */
  compact?: boolean
}

export function AddToCartWithQuantity({ product, compact = false }: AddToCartWithQuantityProps) {
  const { addItem } = useCart()
  const { open } = useCartDrawer()
  const [quantity, setQuantity] = useState(1)

  if (product.stock === 0) {
    return (
      <Button variant="secondary" disabled className={`w-full ${!compact ? 'md:h-[52px] md:text-[15px]' : ''}`}>
        Agotado
      </Button>
    )
  }

  const maxQuantity = Math.min(product.stock, 99)

  const handleAdd = () => {
    addItem(product, quantity)
    toast.success('Agregado al carrito', { description: product.name })
    open()
  }

  // El modo no-compacto solo se usa dentro de wrappers `hidden md:block` (desktop),
  // así que estos tamaños ampliados con prefijo md: quedan efectivamente
  // reservados a desktop sin afectar el layout mobile compacto.
  const stepperBtnClass = compact
    ? 'w-9 h-11 flex items-center justify-center c-text-3 hover:bg-[var(--c-surface-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors'
    : 'w-9 h-11 md:w-[36px] md:h-[46px] flex items-center justify-center c-text-3 hover:bg-[var(--c-surface-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors md:text-[15px]'

  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center border c-border rounded-full overflow-hidden shrink-0 ${compact ? 'hidden sm:flex' : ''}`}>
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          aria-label="Disminuir cantidad"
          className={stepperBtnClass}
        >
          −
        </button>
        <span className={`text-center font-semibold c-text ${compact ? 'w-8 text-sm' : 'w-8 md:w-[32px] text-sm md:text-[14px]'}`}>
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
          disabled={quantity >= maxQuantity}
          aria-label="Aumentar cantidad"
          className={stepperBtnClass}
        >
          +
        </button>
      </div>

      <Button
        variant="primary"
        size={compact ? 'md' : 'lg'}
        onClick={handleAdd}
        className={`flex-1 ${!compact ? 'md:h-[52px] md:px-[26px] md:text-[15px]' : ''}`}
      >
        Agregar al carrito
      </Button>
    </div>
  )
}
