import { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import { PaymentStatus, OrderStatus } from '@/domain/entities/Order'
import { Result, ok, err, AppError } from '@/domain/shared/Result'

export interface ConfirmPaymentInput {
  orderId: string
  externalId: string
  status: PaymentStatus
  /**
   * Monto reportado por la pasarela, en centavos COP.
   * Se valida contra `order.total` como defensa en profundidad:
   * aunque la firma de integridad previene manipulación del cliente,
   * un error en la pasarela o una referencia reutilizada podría enviar un monto distinto.
   */
  amountInCents?: number
}

export interface ConfirmPaymentOutput {
  /**
   * `true` si este llamado ejecutó la transición de estado (Order PENDING → PAID/CANCELLED).
   * `false` si el pedido ya había sido procesado antes — el webhook debe evitar
   * efectos secundarios (email, etc.) en ese caso.
   */
  stateChanged: boolean
  /** Estado final del pedido tras este llamado */
  finalStatus: OrderStatus
}

/**
 * Use case: Confirmar o rechazar un pago a partir del webhook de la pasarela.
 *
 * Garantías:
 *   - **Idempotencia atómica**: la transición PENDING → X ocurre con un
 *     `updateMany WHERE status = 'PENDING'`. Dos webhooks concurrentes no
 *     pueden aplicar el mismo cambio; solo el primero entra.
 *   - **Atomicidad completa**: Order.status, Payment.status y stock de productos
 *     se actualizan en la misma transacción de BD. No hay ventana entre el cambio
 *     de estado y el descuento de stock.
 *   - **Validación de monto**: si el webhook reporta un monto distinto al del pedido,
 *     se rechaza con VALIDATION_ERROR y se loguea.
 *
 * Transiciones:
 *   APPROVED             → Order: PAID      + descuenta stock de cada ítem
 *   DECLINED/VOIDED/ERROR→ Order: CANCELLED
 *   PENDING              → no-op (el pago aún no se resuelve)
 */
export class ConfirmPayment {
  constructor(
    private readonly orderRepo: IOrderRepository,
  ) {}

  async execute(input: ConfirmPaymentInput): Promise<Result<ConfirmPaymentOutput>> {
    const order = await this.orderRepo.findById(input.orderId)
    if (!order) {
      return err(new AppError('NOT_FOUND', `Pedido "${input.orderId}" no encontrado`))
    }

    if (
      input.amountInCents !== undefined &&
      input.amountInCents !== order.total
    ) {
      console.error(
        `[ConfirmPayment] Mismatch de monto en pedido ${order.id}: ` +
          `esperado=${order.total} recibido=${input.amountInCents}`,
      )
      return err(
        new AppError(
          'VALIDATION_ERROR',
          'El monto del webhook no coincide con el del pedido',
          { expected: order.total, received: input.amountInCents },
        ),
      )
    }

    if (input.status === 'PENDING') {
      return ok({ stateChanged: false, finalStatus: order.status })
    }

    if (order.status !== 'PENDING') {
      return ok({ stateChanged: false, finalStatus: order.status })
    }

    const targetOrderStatus: OrderStatus =
      input.status === 'APPROVED' ? 'PAID' : 'CANCELLED'

    try {
      const transition = await this.orderRepo.transitionFromPending(order.id, {
        orderStatus: targetOrderStatus,
        paymentStatus: input.status,
        externalId: input.externalId,
        stockDecrements:
          input.status === 'APPROVED' && order.items
            ? order.items.map(({ productId, quantity }) => ({ productId, quantity }))
            : undefined,
      })

      if (!transition.applied) {
        return ok({ stateChanged: false, finalStatus: order.status })
      }

      return ok({ stateChanged: true, finalStatus: targetOrderStatus })
    } catch (e) {
      return err(new AppError('INTERNAL_ERROR', 'Error al confirmar el pago', e))
    }
  }
}
