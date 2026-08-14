export type CouponType = 'PERCENTAGE' | 'FIXED'

/**
 * Restricción de uso por cliente:
 *   NONE              — cualquier cliente, múltiples veces durante la vigencia.
 *   ONCE_PER_CUSTOMER — cada cliente puede aplicarlo solo una vez.
 *   FIRST_PURCHASE    — solo clientes sin órdenes aprobadas previas.
 */
export type CouponRestriction = 'NONE' | 'ONCE_PER_CUSTOMER' | 'FIRST_PURCHASE'

/**
 * Cupón de descuento administrado desde /admin/cupones.
 *
 * Scope (excluyente — exactamente uno es no-null):
 *   categoryId → aplica a todos los productos de esa categoría y sus subcategorías.
 *   productId  → aplica solo a ese producto específico.
 *
 * Expiración: se evalúa de forma lazy en ValidateCoupon (sin cron job).
 * Desactivación manual: isActive = false (soft delete — nunca se borra la fila).
 */
export interface Coupon {
  id: string
  code: string
  type: CouponType
  /** PERCENTAGE: puntos base (1000 = 10.00%). FIXED: centavos COP. */
  value: number
  restriction: CouponRestriction
  isActive: boolean
  expiresAt: Date
  createdAt: Date
  categoryId: string | null
  productId: string | null
}

export function isCouponExpired(coupon: Coupon, now: Date): boolean {
  return coupon.expiresAt < now
}

/**
 * Calcula el descuento sobre el subtotal elegible (solo los ítems cubiertos por el cupón).
 * FIXED: el descuento nunca supera el subtotal elegible para evitar totales negativos.
 */
export function calculateDiscount(coupon: Coupon, eligibleSubtotal: number): number {
  if (coupon.type === 'PERCENTAGE') {
    return Math.round(eligibleSubtotal * (coupon.value / 10000))
  }
  return Math.min(coupon.value, eligibleSubtotal)
}
