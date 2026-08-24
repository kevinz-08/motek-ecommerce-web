import { describe, it, expect } from 'vitest'
import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { VendeloWebhookGuard } from '../vendelo/guards/vendelo-webhook.guard'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-webhook-secret-32chars-min!!'
const SECRET_KEY = 'motek_webhook_secret'

interface MockBody {
  event?: string
  data?: { metadata?: Array<Record<string, unknown>>; [k: string]: unknown }
  metadata?: Array<Record<string, unknown>>
}

function makeContext(body: MockBody): ExecutionContext {
  const req = { body }
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext
}

function makeGuard(secret = TEST_SECRET, isProd = true): VendeloWebhookGuard {
  process.env['VENDELO_WEBHOOK_SECRET'] = secret
  process.env['NODE_ENV'] = isProd ? 'production' : 'development'
  return new VendeloWebhookGuard()
}

// ── Validación de metadata.motek_webhook_secret ─────────────────────────────────

describe('VendeloWebhookGuard — validación por metadata', () => {
  it('acepta cuando el metadata raíz contiene el secreto correcto', () => {
    const guard = makeGuard()
    const ctx = makeContext({
      event: 'ORDER_SHIPPED',
      data: { external_order_id: 'order-123' },
      metadata: [{ [SECRET_KEY]: TEST_SECRET }],
    })

    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('acepta cuando el metadata anidado en data contiene el secreto correcto', () => {
    const guard = makeGuard()
    const ctx = makeContext({
      event: 'ORDER_DELIVERED',
      data: {
        external_order_id: 'order-123',
        metadata: [{ [SECRET_KEY]: TEST_SECRET }],
      },
    })

    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('rechaza cuando el secreto en metadata no coincide', () => {
    const guard = makeGuard()
    const ctx = makeContext({
      event: 'ORDER_SHIPPED',
      metadata: [{ [SECRET_KEY]: 'valor-incorrecto-de-otra-tienda' }],
    })

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('rechaza cuando metadata no contiene la clave esperada', () => {
    const guard = makeGuard()
    const ctx = makeContext({
      event: 'ORDER_SHIPPED',
      metadata: [{ otro_campo: 'irrelevante' }],
    })

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('rechaza cuando el payload no trae metadata en absoluto', () => {
    const guard = makeGuard()
    const ctx = makeContext({
      event: 'ORDER_SHIPPED',
      data: { external_order_id: 'order-123' },
    })

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('encuentra el secreto entre múltiples items de metadata', () => {
    const guard = makeGuard()
    const ctx = makeContext({
      event: 'ORDER_SHIPPED',
      metadata: [
        { tracking_id: 'abc' },
        { [SECRET_KEY]: TEST_SECRET },
        { source: 'API' },
      ],
    })

    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('no acepta un secreto vacío como válido', () => {
    const guard = makeGuard()
    const ctx = makeContext({
      event: 'ORDER_SHIPPED',
      metadata: [{ [SECRET_KEY]: '' }],
    })

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('no acepta un secreto de longitud distinta aunque empiece igual', () => {
    const guard = makeGuard()
    const ctx = makeContext({
      event: 'ORDER_SHIPPED',
      metadata: [{ [SECRET_KEY]: TEST_SECRET + 'extra' }],
    })

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })
})

// ── Modo desarrollo ───────────────────────────────────────────────────────────

describe('VendeloWebhookGuard — modo desarrollo', () => {
  it('permite requests en desarrollo cuando el secret está vacío (sin importar metadata)', () => {
    const guard = makeGuard('', false)
    const ctx = makeContext({ event: 'ORDER_SHIPPED' })

    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('bloquea en producción cuando el secret está vacío', () => {
    const guard = makeGuard('', true)
    const ctx = makeContext({ event: 'ORDER_SHIPPED' })

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })
})
