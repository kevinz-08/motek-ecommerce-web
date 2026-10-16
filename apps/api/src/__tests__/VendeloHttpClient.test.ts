import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VendeloHttpClient } from '../infrastructure/services/VendeloHttpClient'
import type { IVendeloAuthProvider } from '../infrastructure/services/VendeloAuthProvider'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient(): VendeloHttpClient {
  process.env['VENDELO_API_KEY'] = 'test-key'
  process.env['VENDELO_API_URL'] = 'https://api.test.vendelo.co'
  const client = new VendeloHttpClient()
  // Suprimir delays reales en tests — sleep es protected, accesible via cast
  vi.spyOn(client as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
    .mockResolvedValue(undefined)
  return client
}

function mockFetch(responses: Array<Response | Error>): ReturnType<typeof vi.spyOn> {
  let call = 0
  return vi.spyOn(global, 'fetch').mockImplementation(async () => {
    const r = responses[call] ?? responses[responses.length - 1]
    call++
    if (r instanceof Error) throw r
    return r
  })
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

function errorResponse(status: number): Response {
  return new Response('Internal error', { status })
}

// ── Circuit Breaker ───────────────────────────────────────────────────────────

describe('VendeloHttpClient — Circuit Breaker', () => {
  let client: VendeloHttpClient

  beforeEach(() => { client = makeClient() })
  afterEach(() => { vi.restoreAllMocks() })

  it('estado inicial es CLOSED', () => {
    expect(client.getCircuitState()).toBe('CLOSED')
  })

  it('se mantiene CLOSED tras una request exitosa', async () => {
    mockFetch([okResponse({ ok: true })])
    await client.get('/test')
    expect(client.getCircuitState()).toBe('CLOSED')
  })

  it('pasa a OPEN después de 5 fallos consecutivos (HTTP 500)', async () => {
    mockFetch(Array(25).fill(errorResponse(500)))

    for (let i = 0; i < 5; i++) {
      try { await client.get('/test') } catch { /* esperado */ }
    }

    expect(client.getCircuitState()).toBe('OPEN')
  })

  it('en estado OPEN rechaza inmediatamente sin llamar a fetch', async () => {
    const fetchSpy = mockFetch(Array(25).fill(errorResponse(500)))

    for (let i = 0; i < 5; i++) {
      try { await client.get('/test') } catch { /* esperado */ }
    }

    const callsBeforeOpen = fetchSpy.mock.calls.length
    expect(client.getCircuitState()).toBe('OPEN')

    await expect(client.get('/other')).rejects.toThrow('circuit breaker OPEN')
    expect(fetchSpy.mock.calls.length).toBe(callsBeforeOpen)
  })

  it('pasa a HALF_OPEN → CLOSED tras el timeout de reset cuando la siguiente request es exitosa', async () => {
    vi.useFakeTimers()
    const c = makeClient()

    mockFetch([
      ...Array(20).fill(errorResponse(500)),
      okResponse({ ok: true }),
    ])

    for (let i = 0; i < 5; i++) {
      try { await c.get('/test') } catch { /* esperado */ }
    }
    expect(c.getCircuitState()).toBe('OPEN')

    vi.advanceTimersByTime(61_000)
    // El siguiente intento en HALF_OPEN tendrá éxito → CLOSED
    await c.get('/test')
    expect(c.getCircuitState()).toBe('CLOSED')

    vi.useRealTimers()
  })

  it('en HALF_OPEN vuelve a OPEN si el intento falla', async () => {
    vi.useFakeTimers()
    const c = makeClient()

    mockFetch(Array(30).fill(errorResponse(500)))

    for (let i = 0; i < 5; i++) {
      try { await c.get('/test') } catch { /* esperado */ }
    }
    expect(c.getCircuitState()).toBe('OPEN')

    vi.advanceTimersByTime(61_000)
    try { await c.get('/test') } catch { /* esperado — falla en HALF_OPEN */ }
    expect(c.getCircuitState()).toBe('OPEN')

    vi.useRealTimers()
  })
})

// ── Retry en errores de red ───────────────────────────────────────────────────

describe('VendeloHttpClient — Retry en errores de red', () => {
  let client: VendeloHttpClient

  beforeEach(() => { client = makeClient() })
  afterEach(() => { vi.restoreAllMocks() })

  it('reintenta en ECONNREFUSED y tiene éxito en el segundo intento', async () => {
    const networkError = Object.assign(new Error('ECONNREFUSED'), { name: 'FetchError' })
    const fetchSpy = mockFetch([networkError, okResponse({ result: 'ok' })])

    const result = await client.get<{ result: string }>('/test')
    expect(result.result).toBe('ok')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('lanza después de MAX_ATTEMPTS en errores de red consecutivos', async () => {
    const networkError = Object.assign(new Error('ECONNREFUSED'), { name: 'FetchError' })
    const fetchSpy = mockFetch(Array(10).fill(networkError))

    await expect(client.get('/test')).rejects.toThrow('ECONNREFUSED')
    expect(fetchSpy).toHaveBeenCalledTimes(4) // MAX_ATTEMPTS = 4
  })

  it('reintenta en AbortError (timeout) y tiene éxito en el segundo intento', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    const fetchSpy = mockFetch([abortError, okResponse({ ok: true })])

    await expect(client.get('/test')).resolves.toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('reintenta en HTTP 429 (rate limit)', async () => {
    const fetchSpy = mockFetch([errorResponse(429), okResponse({ ok: true })])

    await expect(client.get('/test')).resolves.toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('no reintenta errores HTTP 4xx que no sean 429', async () => {
    const fetchSpy = mockFetch([errorResponse(400)])

    await expect(client.get('/test')).rejects.toThrow('400')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('reintenta en 5xx por defecto (GET / POST sin opts)', async () => {
    const fetchSpy = mockFetch([errorResponse(500), okResponse({ ok: true })])

    await expect(client.post('/v1/admin/orders', {})).resolves.toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('con retryOn5xx:false no reintenta en 5xx (evita duplicar órdenes Vendelo)', async () => {
    const fetchSpy = mockFetch([errorResponse(500), okResponse({ ok: true })])

    await expect(client.post('/v1/admin/orders', {}, { retryOn5xx: false })).rejects.toThrow('500')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('con retryOn5xx:false sigue reintentando en 429 (rate limit)', async () => {
    const fetchSpy = mockFetch([errorResponse(429), okResponse({ ok: true })])

    await expect(client.post('/v1/admin/orders', {}, { retryOn5xx: false })).resolves.toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

// ── Autenticación ─────────────────────────────────────────────────────────────

function makeOAuthProvider(tokens: string[]) {
  let current = 0
  const provider = {
    mode: 'oauth' as const,
    getAuthHeaders: vi.fn(async () => ({ Authorization: `Bearer ${tokens[current]}` })),
    invalidate: vi.fn(() => { current = Math.min(current + 1, tokens.length - 1) }),
  }
  return provider satisfies IVendeloAuthProvider
}

function makeClientWith(auth?: IVendeloAuthProvider): VendeloHttpClient {
  process.env['VENDELO_API_KEY'] = 'test-key'
  process.env['VENDELO_API_URL'] = 'https://api.test.vendelo.co'
  const client = new VendeloHttpClient(auth)
  vi.spyOn(client as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep').mockResolvedValue(undefined)
  return client
}

function sentHeaders(fetchSpy: ReturnType<typeof vi.spyOn>, call = 0): Record<string, string> {
  return (fetchSpy.mock.calls[call][1] as RequestInit).headers as Record<string, string>
}

describe('VendeloHttpClient — Autenticación', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('sin proveedor inyectado usa la API Key de la env var (modo heredado)', async () => {
    const fetchSpy = mockFetch([okResponse({ ok: true })])
    const client = makeClientWith()

    await client.get('/test')

    expect(client.getAuthMode()).toBe('apikey')
    expect(sentHeaders(fetchSpy)['X-Venndelo-Api-Key']).toBe('test-key')
    expect(sentHeaders(fetchSpy)['Authorization']).toBeUndefined()
  })

  it('con OAuth envía Authorization: Bearer y no la API Key', async () => {
    const fetchSpy = mockFetch([okResponse({ ok: true })])
    const client = makeClientWith(makeOAuthProvider(['token-1']))

    await client.get('/test')

    expect(sentHeaders(fetchSpy)['Authorization']).toBe('Bearer token-1')
    expect(sentHeaders(fetchSpy)['X-Venndelo-Api-Key']).toBeUndefined()
  })

  it('ante un 401 con OAuth invalida el token y reintenta una sola vez con uno nuevo', async () => {
    const auth = makeOAuthProvider(['token-viejo', 'token-nuevo'])
    const fetchSpy = mockFetch([errorResponse(401), okResponse({ ok: true })])
    const client = makeClientWith(auth)

    await expect(client.get('/test')).resolves.toEqual({ ok: true })

    expect(auth.invalidate).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(sentHeaders(fetchSpy, 1)['Authorization']).toBe('Bearer token-nuevo')
    expect(client.getCircuitState()).toBe('CLOSED')
  })

  it('si el reintento tras 401 vuelve a dar 401, falla sin entrar en loop', async () => {
    const auth = makeOAuthProvider(['token-1', 'token-2'])
    const fetchSpy = mockFetch([errorResponse(401), errorResponse(401), okResponse({ ok: true })])
    const client = makeClientWith(auth)

    await expect(client.get('/test')).rejects.toThrow('401')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(auth.invalidate).toHaveBeenCalledTimes(1)
  })

  it('con API Key un 401 no se reintenta (no hay token que refrescar)', async () => {
    const fetchSpy = mockFetch([errorResponse(401), okResponse({ ok: true })])
    const client = makeClientWith()

    await expect(client.get('/test')).rejects.toThrow('401')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('si el proveedor no puede obtener token, no llama a Vendelo ni abre el circuito', async () => {
    const auth: IVendeloAuthProvider = {
      mode: 'oauth',
      getAuthHeaders: vi.fn().mockRejectedValue(new Error('No hay refresh token de Venndelo')),
      invalidate: vi.fn(),
    }
    const fetchSpy = mockFetch([okResponse({ ok: true })])
    const client = makeClientWith(auth)

    for (let i = 0; i < 6; i++) {
      await expect(client.get('/test')).rejects.toThrow('refresh token')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(client.getCircuitState()).toBe('CLOSED')
  })
})
