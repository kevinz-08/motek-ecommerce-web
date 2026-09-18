import { describe, it, expect, vi } from 'vitest'
import { ClaimGuestOrders } from '@/domain/use-cases/orders/ClaimGuestOrders'
import type { IOrderRepository } from '@/domain/repositories/IOrderRepository'

function makeRepo(claimed = 0, throws = false) {
  const claimOrders = throws
    ? vi.fn().mockRejectedValue(new Error('db down'))
    : vi.fn().mockResolvedValue(claimed)
  return { claimOrders } as unknown as IOrderRepository & { claimOrders: ReturnType<typeof vi.fn> }
}

describe('ClaimGuestOrders', () => {
  it('vincula los pedidos y devuelve cuántos fueron', async () => {
    const repo = makeRepo(3)
    const result = await new ClaimGuestOrders(repo).execute({
      userId: 'user-1',
      accountEmail: 'cliente@motek.test',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.claimed).toBe(3)
    expect(repo.claimOrders).toHaveBeenCalledWith('cliente@motek.test', 'user-1')
  })

  it('normaliza el email antes de buscar', async () => {
    // En el checkout el correo se escribe a mano: "Juan@Gmail.com" y
    // "juan@gmail.com" tienen que reclamar los mismos pedidos.
    const repo = makeRepo(1)
    await new ClaimGuestOrders(repo).execute({
      userId: 'user-1',
      accountEmail: '  Cliente@Motek.TEST ',
    })

    expect(repo.claimOrders).toHaveBeenCalledWith('cliente@motek.test', 'user-1')
  })

  it('es idempotente: una segunda pasada no reclama nada', async () => {
    const repo = makeRepo(0)
    const result = await new ClaimGuestOrders(repo).execute({
      userId: 'user-1',
      accountEmail: 'cliente@motek.test',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.claimed).toBe(0)
  })

  it('rechaza una cuenta sin email en vez de reclamar con string vacío', async () => {
    // Un email vacío haría match contra cualquier pedido cuyo contactEmail
    // también lo esté: hay que cortarlo antes de llegar al repositorio.
    const repo = makeRepo(99)
    const result = await new ClaimGuestOrders(repo).execute({
      userId: 'user-1',
      accountEmail: '   ',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(repo.claimOrders).not.toHaveBeenCalled()
  })

  it('envuelve un fallo del repositorio en INTERNAL_ERROR', async () => {
    const repo = makeRepo(0, true)
    const result = await new ClaimGuestOrders(repo).execute({
      userId: 'user-1',
      accountEmail: 'cliente@motek.test',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL_ERROR')
  })
})
