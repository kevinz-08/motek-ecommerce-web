import { Result, ok, err, AppError } from '../../shared/Result'
import { IVendeloShippingPort } from '../../repositories/IVendeloShippingPort'
import { ExceptionResolution, RESOLVABLE_EXCEPTION_STATUSES } from '../../entities/ShipmentException'

export interface ResolveShipmentExceptionInput {
  exceptionId: string
  resolution: ExceptionResolution
}

export interface ResolveShipmentExceptionOutput {
  message: string
}

/**
 * Resuelve una novedad de transporte de Vendelo.
 *
 * Máquina de estados: solo acepta novedades en estado PENDING.
 * Cualquier otro estado (TRANSMITTING, REPLIED, ERROR, REJECTED, APPROVED)
 * es rechazado con VALIDATION_ERROR para evitar doble-resolución.
 */
export class ResolveShipmentException {
  constructor(private readonly shippingPort: IVendeloShippingPort) {}

  async execute(
    input: ResolveShipmentExceptionInput,
  ): Promise<Result<ResolveShipmentExceptionOutput, AppError>> {
    const exception = await this.shippingPort.getException(input.exceptionId)

    if (!RESOLVABLE_EXCEPTION_STATUSES.includes(exception.status)) {
      return err(
        new AppError(
          'VALIDATION_ERROR',
          `La novedad está en estado "${exception.status}" y no puede ser resuelta. Solo se aceptan novedades en estado PENDING.`,
        ),
      )
    }

    const result = await this.shippingPort.resolveException(input.exceptionId, input.resolution)
    return ok({ message: result.message })
  }
}
