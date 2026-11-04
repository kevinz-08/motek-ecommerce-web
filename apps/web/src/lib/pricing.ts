/**
 * Helpers de precio para el carrito y el checkout (precio ancla).
 */
import { getDiscountPercent, type Product } from '@motek/domain'

/**
 * Ahorro total del carrito frente a los precios de referencia (compareAtPrice), en centavos COP.
 * Solo cuenta productos con un ancla válida (> price). Es informativo: el total a pagar
 * siempre se calcula con `price` en el servidor.
 */
export function cartSavings(items: Array<{ product: Pick<Product, 'price' | 'compareAtPrice'>; quantity: number }>): number {
  return items.reduce((acc, { product, quantity }) => {
    if (getDiscountPercent(product.price, product.compareAtPrice) === 0 || !product.compareAtPrice) return acc
    return acc + (product.compareAtPrice - product.price) * quantity
  }, 0)
}
