'use client'

/**
 * Zona de compra del PDP (todos los breakpoints): CTA inline (cantidad +
 * agregar + Addi), cotizador de envío, línea de tiempo y medios de pago.
 * Comparte la cantidad con la barra fija móvil, que solo aparece cuando el
 * CTA inline queda fuera de pantalla.
 */
import { useEffect, useRef, useState } from 'react'
import { Product } from '@motek/domain'
import { AddToCartWithQuantity } from '@/components/store/AddToCartWithQuantity'
import { PayWithAddiButton } from '@/components/store/PayWithAddiButton'
import { ProductShippingEstimator } from '@/components/store/ProductShippingEstimator'
import { DeliveryTimeline } from '@/components/store/DeliveryTimeline'
import { PaymentMethodsRow } from '@/components/store/PaymentMethodsRow'
import { StickyBuyBar } from '@/components/store/StickyBuyBar'

interface Props {
  product: Product
  formattedPrice: string
}

export function ProductBuyBox({ product, formattedPrice }: Props) {
  const [quantity, setQuantity] = useState(1)
  const [inlineVisible, setInlineVisible] = useState(true)
  const ctaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ctaRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setInlineVisible(entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={ctaRef} className="space-y-3">
        <AddToCartWithQuantity product={product} quantity={quantity} onQuantityChange={setQuantity} />
        <PayWithAddiButton product={product} />
      </div>

      <ProductShippingEstimator productId={product.id} quantity={quantity} />
      <DeliveryTimeline />
      <PaymentMethodsRow />

      <StickyBuyBar
        product={product}
        formattedPrice={formattedPrice}
        visible={!inlineVisible}
        quantity={quantity}
        onQuantityChange={setQuantity}
      />
    </>
  )
}
