/**
 * Precio con estrategia de precio ancla (Price Anchoring).
 *
 * Si el producto tiene un `compareAtPrice` válido (> price):
 *   - Precio de referencia tachado, pequeño y en gris (sutil).
 *   - Precio real de venta más grande y en negrita.
 *   - Badge "-X%" con el acento de la marca (porcentaje redondeado hacia abajo:
 *     nunca exagera el descuento).
 * Sin precio ancla, se muestra solo el precio real en el estilo neutro de siempre.
 *
 * Server-safe: no usa hooks, se puede renderizar en Server y Client Components.
 */
import { getDiscountPercent } from '@motek/domain'
import { formatCOP } from '@/lib/format'

const SIZES = {
  sm: { price: 'text-base font-black', compare: 'text-xs', badge: 'text-[10px] px-1.5 py-0.5' },
  md: { price: 'text-xl font-bold', compare: 'text-sm', badge: 'text-xs px-2 py-0.5' },
  lg: { price: 'text-4xl md:text-[38px] font-bold', compare: 'text-lg', badge: 'text-sm px-2.5 py-1' },
} as const

interface PriceTagProps {
  /** Precio real de venta en centavos COP. */
  price: number
  /** Precio de referencia en centavos COP. null/undefined = sin ancla. */
  compareAtPrice?: number | null
  size?: keyof typeof SIZES
  /** Multiplica ambos precios (ej. subtotal de una línea del carrito). */
  quantity?: number
  /** Oculta el badge -X% (útil en listados compactos). */
  hideBadge?: boolean
  /** Color del precio real. Default gris oscuro; la PDP usa la clase de tema `c-text`. */
  priceClassName?: string
  className?: string
}

export function PriceTag({
  price, compareAtPrice, size = 'md', quantity = 1, hideBadge = false,
  priceClassName = 'text-gray-900', className = '',
}: PriceTagProps) {
  const discount = getDiscountPercent(price, compareAtPrice)
  const s = SIZES[size]

  if (discount === 0 || !compareAtPrice) {
    return (
      <p className={`${s.price} ${priceClassName} tracking-tight ${className}`}>
        {formatCOP(price * quantity)}
      </p>
    )
  }

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      <span className={`${s.price} ${priceClassName} tracking-tight`}>
        {formatCOP(price * quantity)}
      </span>
      <span className={`${s.compare} text-gray-400 line-through`}>
        <span className="sr-only">Antes </span>
        {formatCOP(compareAtPrice * quantity)}
      </span>
      {!hideBadge && (
        <span className={`${s.badge} self-center rounded-full bg-[var(--c-accent)] text-white font-bold leading-none`}>
          -{discount}%
        </span>
      )}
    </div>
  )
}
