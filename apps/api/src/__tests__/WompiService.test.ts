import { describe, it, expect, beforeEach } from 'vitest'
import { WompiService } from '../infrastructure/services/WompiService'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-events-secret-abc123'

/** Construye un payload de webhook válido con checksum correcto */
function buildValidPayload(overrides?: {
  timestamp?: number
  statusOverride?: string
}): unknown {
  const timestamp = overrides?.timestamp ?? Math.floor(Date.now() / 1000)
  const transaction = {
    id: 'wompi-tx-001',
    reference: 'ORDER-abc123-1700000000000',
    status: overrides?.statusOverride ?? 'APPROVED',
    amount_in_cents: 5000000,
    currency: 'COP',
  }
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
  const propertyValues = properties.map((prop) => {
    const parts = prop.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = { transaction }
    for (const part of parts) value = value?.[part]
    return value == null ? '' : String(value)
  })

  const checksum = WompiService.computeEventChecksum(propertyValues, timestamp, TEST_SECRET)

  return {
    event: 'transaction.updated',
    data: { transaction },
    sent_at: new Date(timestamp * 1000).toISOString(),
    timestamp,
    signature: { checksum, properties },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WompiService.validateWebhook', () => {
  let service: WompiService

  beforeEach(() => {
    process.env['WOMPI_EVENTS_SECRET'] = TEST_SECRET
    service = new WompiService()
  })

  it('acepta un payload con firma SHA-256 correcta y timestamp reciente', () => {
    const payload = buildValidPayload()
    expect(service.validateWebhook(payload, new Headers())).toBe(true)
  })

  it('rechaza un payload con checksum alterado', () => {
    const payload = buildValidPayload() as Record<string, unknown>
    const sig = payload['signature'] as Record<string, unknown>
    sig['checksum'] = 'a'.repeat(64) // 64 hex chars inválidos
    expect(service.validateWebhook(payload, new Headers())).toBe(false)
  })

  it('rechaza un payload con timestamp fuera de ventana (>600 s en el pasado)', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 700 // 700 s atrás
    const payload = buildValidPayload({ timestamp: oldTimestamp })
    expect(service.validateWebhook(payload, new Headers())).toBe(false)
  })

  it('rechaza un payload con timestamp en el futuro lejano (>600 s adelante)', () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 700
    const payload = buildValidPayload({ timestamp: futureTimestamp })
    expect(service.validateWebhook(payload, new Headers())).toBe(false)
  })

  it('rechaza un payload al que le falta la propiedad signature', () => {
    const payload = { event: 'transaction.updated', data: {}, timestamp: Math.floor(Date.now() / 1000) }
    expect(service.validateWebhook(payload, new Headers())).toBe(false)
  })

  it('rechaza cuando WOMPI_EVENTS_SECRET no está configurado', () => {
    delete process.env['WOMPI_EVENTS_SECRET']
    const serviceWithoutSecret = new WompiService()
    const payload = buildValidPayload()
    expect(serviceWithoutSecret.validateWebhook(payload, new Headers())).toBe(false)
  })
})

describe('WompiService.computeIntegritySignature', () => {
  it('produce el mismo hash para los mismos parámetros (determinismo)', () => {
    const sig1 = WompiService.computeIntegritySignature('ref-1', 5000000, 'COP', 'secret')
    const sig2 = WompiService.computeIntegritySignature('ref-1', 5000000, 'COP', 'secret')
    expect(sig1).toBe(sig2)
  })

  it('produce hashes distintos para referencias diferentes', () => {
    const sig1 = WompiService.computeIntegritySignature('ref-1', 5000000, 'COP', 'secret')
    const sig2 = WompiService.computeIntegritySignature('ref-2', 5000000, 'COP', 'secret')
    expect(sig1).not.toBe(sig2)
  })

  it('retorna un string hexadecimal de 64 caracteres (SHA-256)', () => {
    const sig = WompiService.computeIntegritySignature('ref', 1000, 'COP', 'secret')
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })
})
