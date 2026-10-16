import { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import { IShipmentRepository } from '@/domain/repositories/IShipmentRepository'
import { IVendeloShippingPort } from '@/domain/repositories/IVendeloShippingPort'
import { ShipmentStatus } from '@/domain/entities/Shipment'
import { SyncShipmentStatus } from '@/domain/use-cases/orders/SyncShipmentStatus'
import { Result, ok, err, AppError } from '@/domain/shared/Result'

export interface CancelOrderInput {
  orderId: string
}

export interface CancelOrderOutput {
  /** true si el pedido ya estaba cancelado (no se hizo nada). */
  alreadyCancelled: boolean
  /** true si se anuló también el pedido en Vendelo. */
  cancelledInVendelo: boolean
}

/** Estados en que el paquete ya salió: anular ya no detiene el envío. */
const DISPATCHED: ReadonlySet<ShipmentStatus> = new Set(['SHIPPED', 'INCIDENT', 'DELIVERED', 'RETURNED'])

/**
 * Use case: anular un pedido desde el admin, manteniendo Vendelo coherente.
 *
 * Antes solo se cambiaba `Order.status` local: si el pedido ya existía en
 * Vendelo, el mensajero salía igual a entregar un pedido anulado.
 *
 * Reglas:
 *   - Pedido ya despachado (envío SHIPPED/INCIDENT/DELIVERED/RETURNED, o
 *     Order SHIPPED/DELIVERED) → VALIDATION_ERROR: hay que gestionar la
 *     devolución con Vendelo, no anular.
 *   - Con `vendeloOrderId` → se anula PRIMERO en Vendelo. Si Vendelo lo
 *     rechaza, el pedido local no cambia (nunca queda anulado aquí y vivo allá).
 *     Luego SyncShipmentStatus(CANCELLED) actualiza envío + pedido y repone
 *     stock una sola vez (idempotente si después llega el webhook ORDER_CANCELLED).
 *   - Sin `vendeloOrderId` (aún en VendeloOrderQueue, o retiro en tienda) →
 *     solo cambia el estado local; la cola omite pedidos CANCELLED. Si el pedido
 *     estaba PAID, su stock ya se había descontado y se repone.
 */
export class CancelOrder {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly shipmentRepo: IShipmentRepository,
    private readonly shippingPort: IVendeloShippingPort,
  ) {}

  async execute(input: CancelOrderInput): Promise<Result<CancelOrderOutput>> {
    const order = await this.orderRepo.findById(input.orderId)
    if (!order) {
      return err(new AppError('NOT_FOUND', `Pedido "${input.orderId}" no encontrado`))
    }

    if (order.status === 'CANCELLED') {
      return ok({ alreadyCancelled: true, cancelledInVendelo: false })
    }

    const shipment = await this.shipmentRepo.findByOrderId(input.orderId)
    if (order.status === 'SHIPPED' || order.status === 'DELIVERED' || (shipment && DISPATCHED.has(shipment.status))) {
      return err(new AppError(
        'VALIDATION_ERROR',
        'El pedido ya fue despachado: no se puede anular, gestiona la devolución con Vendelo',
      ))
    }

    const [row] = await this.orderRepo.findVendeloOrderIdsBatch([input.orderId])
    const vendeloOrderId = row?.vendeloOrderId ?? null

    if (!vendeloOrderId) {
      await this.orderRepo.updateStatus(input.orderId, 'CANCELLED')
      if (order.status === 'PAID') await this.orderRepo.restockItems(input.orderId)
      return ok({ alreadyCancelled: false, cancelledInVendelo: false })
    }

    try {
      await this.shippingPort.cancelOrder(vendeloOrderId)
    } catch (e) {
      return err(new AppError(
        'INTERNAL_ERROR',
        `Vendelo no permitió anular el envío: ${e instanceof Error ? e.message : String(e)}`,
        e,
      ))
    }

    const synced = await new SyncShipmentStatus(this.shipmentRepo, this.orderRepo).execute({
      orderId: input.orderId,
      vendelo_status: 'CANCELLED',
    })
    if (!synced.ok) return synced

    return ok({ alreadyCancelled: false, cancelledInVendelo: true })
  }
}
