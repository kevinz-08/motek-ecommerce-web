import { IOrderRepository } from '@/domain/repositories/IOrderRepository'
import { Result, ok, err, AppError } from '@/domain/shared/Result'

export interface ClaimGuestOrdersInput {
  /** ID del usuario autenticado que reclama los pedidos. */
  userId: string
  /**
   * Email de la CUENTA autenticada — nunca un email que venga del cliente.
   * El caller debe tomarlo del JWT/sesión: es lo único que prueba propiedad.
   */
  accountEmail: string
}

export interface ClaimGuestOrdersOutput {
  /** Cuántos pedidos de invitado quedaron vinculados a la cuenta. */
  claimed: number
}

/**
 * Use case: vincular a una cuenta los pedidos que se hicieron como invitado con
 * ese mismo email.
 *
 * Por qué es un paso explícito y no automático en el checkout:
 *
 *   El email que se escribe en el checkout de invitado no prueba nada — cualquiera
 *   puede teclear el correo de otra persona. Si el pedido se vinculara en ese
 *   momento a la cuenta que tenga ese email, la dirección, el teléfono y el
 *   comprobante del comprador real aparecerían en el panel de un tercero. Es una
 *   fuga de datos personales, no una comodidad.
 *
 *   El vínculo solo ocurre cuando la propiedad del email SÍ está probada: cuando
 *   alguien inicia sesión en la cuenta con ese email (credenciales o Google), o
 *   cuando termina el registro verificando el OTP. En ese momento el caller pasa
 *   `accountEmail` desde la sesión, nunca desde el body de la petición.
 *
 * Es una transición de un solo sentido e idempotente: `claimOrders` filtra por
 * `userId IS NULL`, así que llamarlo dos veces reclama 0 la segunda vez, y un
 * pedido ya vinculado nunca vuelve a estado de invitado.
 */
export class ClaimGuestOrders {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async execute(input: ClaimGuestOrdersInput): Promise<Result<ClaimGuestOrdersOutput>> {
    const email = input.accountEmail.trim().toLowerCase()

    if (!email) {
      return err(new AppError('VALIDATION_ERROR', 'La cuenta no tiene email asociado'))
    }

    try {
      const claimed = await this.orderRepo.claimOrders(email, input.userId)
      return ok({ claimed })
    } catch (e) {
      return err(new AppError('INTERNAL_ERROR', 'Error al vincular los pedidos', e))
    }
  }
}
