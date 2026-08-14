import { Coupon, CouponType, CouponRestriction } from '@/domain/entities/Coupon'

export interface CreateCouponInput {
  code: string
  type: CouponType
  /** PERCENTAGE: puntos base (1000 = 10.00%). FIXED: centavos COP. */
  value: number
  restriction: CouponRestriction
  expiresAt: Date
  /** Exactamente uno de categoryId o productId debe ser no-null. */
  categoryId?: string
  productId?: string
}

export interface UpdateCouponInput {
  code?: string
  type?: CouponType
  value?: number
  restriction?: CouponRestriction
  expiresAt?: Date
  /** null para limpiar el scope de categoría. */
  categoryId?: string | null
  /** null para limpiar el scope de producto. */
  productId?: string | null
  isActive?: boolean
}

/**
 * Contrato de acceso a datos de cupones.
 * Implementado por PrismaCouponRepository en infrastructure/repositories/.
 *
 * Sin método incrementUsage: la vigencia se controla exclusivamente por expiresAt
 * (evaluación lazy en ValidateCoupon). No hay contadores globales.
 */
export interface ICouponRepository {
  findByCode(code: string): Promise<Coupon | null>
  findAll(): Promise<Coupon[]>
  create(data: CreateCouponInput): Promise<Coupon>
  update(id: string, data: UpdateCouponInput): Promise<Coupon>
  /** Soft delete: pone isActive = false en lugar de borrar la fila. */
  delete(id: string): Promise<void>
}
