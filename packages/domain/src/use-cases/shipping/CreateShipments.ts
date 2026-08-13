import { Result, ok, err, AppError } from '../../shared/Result'
import { IOrderRepository } from '../../repositories/IOrderRepository'
import { IVendeloShippingPort } from '../../repositories/IVendeloShippingPort'

export interface CreateShipmentsInput {
  /** IDs internos de pedidos (nuestros UUIDs) cuyo envío debe crearse en Vendelo. */
  orderIds: string[]
}

export interface CreateShipmentsOutput {
  message: string
  /** vendeloOrderIds procesados correctamente. */
  processed: string[]
  /** IDs internos de pedidos que no tenían vendeloOrderId asignado aún. */
  skipped: string[]
}

/**
 * Crea los envíos en Vendelo para una lista de pedidos internos.
 *
 * Resuelve los vendeloOrderIds en lote y omite pedidos sin asignación
 * (aún en la cola de VendeloOrderQueueService). Si ningún pedido tiene
 * vendeloOrderId, retorna VALIDATION_ERROR.
 */
export class CreateShipments {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly shippingPort: IVendeloShippingPort,
  ) {}

  async execute(input: CreateShipmentsInput): Promise<Result<CreateShipmentsOutput, AppError>> {
    if (!input.orderIds.length) {
      return err(new AppError('VALIDATION_ERROR', 'Se requiere al menos un orderId'))
    }

    const rows = await this.orderRepo.findVendeloOrderIdsBatch(input.orderIds)

    const processed: string[] = []
    const skipped: string[] = []

    for (const row of rows) {
      if (row.vendeloOrderId) {
        processed.push(row.vendeloOrderId)
      } else {
        skipped.push(row.id)
      }
    }

    if (!processed.length) {
      return err(
        new AppError(
          'VALIDATION_ERROR',
          'Ninguno de los pedidos tiene vendeloOrderId asignado. Espera a que VendeloOrderQueueService los procese.',
        ),
      )
    }

    const result = await this.shippingPort.createShipments(processed)

    return ok({ message: result.message, processed, skipped })
  }
}
