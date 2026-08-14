import { describe, it, expect, vi } from 'vitest'
import { ResolveShipmentException } from '@/domain/use-cases/shipping/ResolveShipmentException'
import type { IVendeloShippingPort } from '@/domain/repositories/IVendeloShippingPort'
import type { ShipmentExceptionDetail } from '@/domain/entities/ShipmentException'
import { RESOLVABLE_EXCEPTION_STATUSES } from '@/domain/entities/ShipmentException'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeException(
  overrides?: Partial<ShipmentExceptionDetail>,
): ShipmentExceptionDetail {
  return {
    id: 'exc-1',
    order_id: 'order-1',
    tracking_number: 'TRK-001',
    code: 'ADDRESS_NOT_FOUND',
    description: 'Dirección no encontrada',
    notes: '',
    status: 'PENDING',
    possible_replies: [{ type_id: 1, name: 'Confirmar dirección', description: 'Reconfirmar la dirección de entrega' }],
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeShippingPort(exception: ShipmentExceptionDetail): IVendeloShippingPort {
  return {
    getException: vi.fn().mockResolvedValue(exception),
    resolveException: vi.fn().mockResolvedValue({ message: 'Novedad resuelta' }),
  } as unknown as IVendeloShippingPort
}

const RESOLUTION = { type_id: 1, notes: 'Dirección confirmada por el cliente' }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResolveShipmentException', () => {
  it('happy path: resuelve una novedad en estado PENDING y retorna ok con el mensaje', async () => {
    const port = makeShippingPort(makeException({ status: 'PENDING' }))

    const result = await new ResolveShipmentException(port).execute({
      exceptionId: 'exc-1',
      resolution: RESOLUTION,
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.message).toBe('Novedad resuelta')
  })

  it('pasa el id y la resolución correcta a resolveException', async () => {
    const port = makeShippingPort(makeException({ status: 'PENDING' }))

    await new ResolveShipmentException(port).execute({
      exceptionId: 'exc-1',
      resolution: RESOLUTION,
    })

    expect(port.resolveException).toHaveBeenCalledWith('exc-1', RESOLUTION)
  })

  it.each(['TRANSMITTING', 'REPLIED', 'ERROR', 'REJECTED', 'APPROVED'] as const)(
    'retorna VALIDATION_ERROR para una novedad en estado %s (estado no resolvible)',
    async (status) => {
      const port = makeShippingPort(makeException({ status }))

      const result = await new ResolveShipmentException(port).execute({
        exceptionId: 'exc-1',
        resolution: RESOLUTION,
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain(status)
        expect(result.error.message).toContain('PENDING')
      }
    },
  )

  it('no llama a resolveException cuando el estado no es resolvible', async () => {
    const port = makeShippingPort(makeException({ status: 'APPROVED' }))

    await new ResolveShipmentException(port).execute({
      exceptionId: 'exc-1',
      resolution: RESOLUTION,
    })

    expect(port.resolveException).not.toHaveBeenCalled()
  })

  it('siempre llama a getException antes de cualquier acción (estado es leído desde el API)', async () => {
    const port = makeShippingPort(makeException({ status: 'PENDING' }))

    await new ResolveShipmentException(port).execute({
      exceptionId: 'exc-99',
      resolution: RESOLUTION,
    })

    expect(port.getException).toHaveBeenCalledWith('exc-99')
    expect(port.getException).toHaveBeenCalledBefore(port.resolveException as ReturnType<typeof vi.fn>)
  })

  it('RESOLVABLE_EXCEPTION_STATUSES solo contiene PENDING (máquina de estados estricta)', () => {
    expect(RESOLVABLE_EXCEPTION_STATUSES).toEqual(['PENDING'])
    expect(RESOLVABLE_EXCEPTION_STATUSES).toHaveLength(1)
  })
})
