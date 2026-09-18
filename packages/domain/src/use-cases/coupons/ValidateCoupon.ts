import { ICouponRepository } from '@/domain/repositories/ICouponRepository'
import { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import { isCouponExpired, calculateDiscount } from '@/domain/entities/Coupon'
import { AccountRequiredReason } from '@/domain/entities/Customer'
import { Result, ok, err, AppError } from '@/domain/shared/Result'

export interface ValidateCouponItem {
  productId: string
  categoryId: string
  /** null si el producto pertenece a una categoría raíz (sin padre). */
  parentCategoryId: string | null
  /** Precio unitario en centavos COP. */
  price: number
  quantity: number
}

/**
 * Identidad frente a la que se evalúan las restricciones del cupón.
 *
 * Un invitado no aporta `userId` porque no hay ninguno en el que confiar: el
 * email del checkout no está verificado. Deliberadamente NO se incluye su email
 * acá — validar "una vez por cliente" contra un email sin verificar es teatro:
 * `juan+1@gmail.com`, `juan+2@gmail.com`… lo saltan en segundos, y el margen
 * perdido es real.
 */
export type CouponIdentity =
  | { kind: 'user'; userId: string }
  | { kind: 'guest' }

export interface ValidateCouponInput {
  code: string
  identity: CouponIdentity
  items: ValidateCouponItem[]
}

export interface ValidateCouponOutput {
  /** Monto a descontar en centavos COP, calculado sobre el subtotal elegible. */
  discount: number
  /** IDs de los productos del carrito cubiertos por este cupón. */
  eligibleProductIds: string[]
}

/**
 * Use case: Validar un cupón y calcular el descuento aplicable.
 *
 * Orden de validación:
 *   1. El cupón existe.
 *   2. isActive = true (desactivación manual del admin).
 *   3. No expiró (evaluación lazy — sin cron job).
 *   4. Restricción de uso por cliente (ONCE_PER_CUSTOMER o FIRST_PURCHASE) —
 *      requiere identidad probada; un invitado recibe UNAUTHORIZED.
 *   5. Al menos un ítem del carrito está dentro del scope del cupón.
 *
 * Scope con cascada jerárquica:
 *   categoryId → cubre productos cuya categoría ES la del cupón
 *                O cuya categoría es hija (parentCategoryId === coupon.categoryId).
 *   productId  → cubre solo ese producto exacto.
 *
 * El descuento se calcula sobre el subtotal elegible (solo ítems cubiertos),
 * no sobre el total del carrito completo.
 */
export class ValidateCoupon {
  constructor(
    private readonly couponRepo: ICouponRepository,
    private readonly orderRepo: IOrderRepository,
  ) {}

  async execute(input: ValidateCouponInput): Promise<Result<ValidateCouponOutput>> {
    const coupon = await this.couponRepo.findByCode(input.code)

    if (!coupon) {
      return err(new AppError('NOT_FOUND', 'Cupón no encontrado'))
    }
    if (!coupon.isActive) {
      return err(new AppError('VALIDATION_ERROR', 'Cupón desactivado'))
    }
    if (isCouponExpired(coupon, new Date())) {
      return err(new AppError('VALIDATION_ERROR', 'Cupón vencido'))
    }

    // Restricciones que dependen del historial del cliente: solo evaluables
    // sobre una identidad probada. Para un invitado no se degrada la validación
    // (sería burlable con alias de email) — se exige cuenta y punto.
    //
    // El mensaje dice "requiere iniciar sesión", nunca "ya usaste este cupón":
    // lo segundo revelaría historial de compras de un email ajeno a cualquiera
    // que lo escriba en el checkout.
    if (coupon.restriction !== 'NONE' && input.identity.kind === 'guest') {
      return err(
        new AppError(
          'UNAUTHORIZED',
          'Este cupón requiere que inicies sesión con tu cuenta',
          { reason: 'RESTRICTED_COUPON' satisfies AccountRequiredReason },
        ),
      )
    }

    if (coupon.restriction === 'ONCE_PER_CUSTOMER' && input.identity.kind === 'user') {
      const alreadyUsed = await this.orderRepo.existsByCouponAndUser(input.code, input.identity.userId)
      if (alreadyUsed) {
        return err(new AppError('VALIDATION_ERROR', 'Ya utilizaste este cupón'))
      }
    }

    if (coupon.restriction === 'FIRST_PURCHASE' && input.identity.kind === 'user') {
      const hasPriorOrders = await this.orderRepo.hasApprovedOrders(input.identity.userId)
      if (hasPriorOrders) {
        return err(new AppError('VALIDATION_ERROR', 'Este cupón es exclusivo para tu primera compra'))
      }
    }

    const eligibleItems = input.items.filter(item => {
      if (coupon.productId) return item.productId === coupon.productId
      if (coupon.categoryId) {
        return (
          item.categoryId === coupon.categoryId ||
          item.parentCategoryId === coupon.categoryId
        )
      }
      return false
    })

    if (eligibleItems.length === 0) {
      return err(new AppError('VALIDATION_ERROR', 'Este cupón no aplica a los productos en tu carrito'))
    }

    const eligibleSubtotal = eligibleItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    )
    const discount = calculateDiscount(coupon, eligibleSubtotal)

    return ok({
      discount,
      eligibleProductIds: eligibleItems.map(item => item.productId),
    })
  }
}
