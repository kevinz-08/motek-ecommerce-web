import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomBytes } from 'crypto'
import { decryptSecret, encryptSecret } from '../shared/crypto/secret-box'
import {
  VendeloOAuthTokenProvider,
  VendeloAuthError,
  type IVendeloCredentialStore,
  type SaveRefreshResultInput,
  type VendeloCredentialRecord,
} from '../infrastructure/services/VendeloOAuthTokenProvider'

vi.mock('@sentry/nestjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const KEY = randomBytes(32)
const BASE_URL = 'https://api.test.venndelo.com'
const T0 = Date.parse('2026-10-15T12:00:00Z')

// ── Fake store en memoria con la misma semántica que PrismaVendeloCredentialStore ──

class InMemoryCredentialStore implements IVendeloCredentialStore {
  row: (VendeloCredentialRecord & { leaseHolder: string | null; leaseUntil: number | null }) | null = null
  failSaves = 0

  constructor(private readonly now: () => number) {}

  async find(): Promise<VendeloCredentialRecord | null> {
    if (!this.row) return null
    const { leaseHolder: _h, leaseUntil: _u, ...record } = this.row
    return { ...record }
  }

  async seedIfMissing(refreshTokenEnc: string): Promise<void> {
    this.row ??= {
      refreshTokenEnc, refreshTokenExpiresAt: null, accessTokenEnc: null, accessTokenExpiresAt: null,
      version: 0, leaseHolder: null, leaseUntil: null,
    }
  }

  async tryAcquireRefreshLease(holder: string, ttlMs: number): Promise<boolean> {
    if (!this.row) return false
    if (this.row.leaseUntil !== null && this.row.leaseUntil >= this.now()) return false
    this.row.leaseHolder = holder
    this.row.leaseUntil = this.now() + ttlMs
    return true
  }

  async saveRefreshResult(input: SaveRefreshResultInput): Promise<boolean> {
    if (this.failSaves > 0) {
      this.failSaves--
      throw new Error('DB caída')
    }
    if (!this.row || this.row.version !== input.expectedVersion) return false
    this.row.accessTokenEnc = input.accessTokenEnc
    this.row.accessTokenExpiresAt = input.accessTokenExpiresAt
    if (input.refreshTokenEnc) {
      this.row.refreshTokenEnc = input.refreshTokenEnc
      this.row.refreshTokenExpiresAt = input.refreshTokenExpiresAt ?? null
    }
    this.row.version++
    this.row.leaseHolder = null
    this.row.leaseUntil = null
    return true
  }

  async releaseRefreshLease(holder: string): Promise<void> {
    if (this.row?.leaseHolder === holder) {
      this.row.leaseHolder = null
      this.row.leaseUntil = null
    }
  }

  plainRefreshToken(): string {
    return decryptSecret(this.row!.refreshTokenEnc, KEY)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tokenResponse(accessToken: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    expires_at: new Date(T0 + 3600_000).toISOString(),
    ...extra,
  }), { status: 200 })
}

function sentRefreshToken(fetchFn: ReturnType<typeof vi.fn>, call = 0): string | null {
  const init = fetchFn.mock.calls[call]?.[1] as RequestInit
  return new URLSearchParams(init.body as string).get('refresh_token')
}

let clock: number
const now = () => clock

function makeProvider(store: IVendeloCredentialStore, fetchFn: ReturnType<typeof vi.fn>, seed?: string) {
  return new VendeloOAuthTokenProvider(store, {
    baseUrl: BASE_URL,
    encryptionKey: KEY,
    seedRefreshToken: seed,
    fetchFn: fetchFn as unknown as typeof fetch,
    now,
    sleep: async (ms) => { clock += ms },
  })
}

describe('VendeloOAuthTokenProvider', () => {
  let store: InMemoryCredentialStore

  beforeEach(() => {
    clock = T0
    store = new InMemoryCredentialStore(now)
  })

  it('en el primer arranque siembra el refresh token desde env, lo intercambia y lo guarda cifrado', async () => {
    const fetchFn = vi.fn().mockResolvedValue(tokenResponse('access-1'))
    const provider = makeProvider(store, fetchFn, 'seed-refresh')

    await expect(provider.getAuthHeaders()).resolves.toEqual({ Authorization: 'Bearer access-1' })

    expect(fetchFn).toHaveBeenCalledWith(`${BASE_URL}/v1/admin/oauth/token`, expect.objectContaining({ method: 'POST' }))
    const init = fetchFn.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(new URLSearchParams(init.body as string).get('grant_type')).toBe('refresh_token')
    expect(sentRefreshToken(fetchFn)).toBe('seed-refresh')

    // Nada en texto plano en la "BD"
    expect(store.row!.refreshTokenEnc).not.toContain('seed-refresh')
    expect(store.row!.accessTokenEnc).not.toContain('access-1')
    expect(decryptSecret(store.row!.accessTokenEnc!, KEY)).toBe('access-1')
    expect(store.row!.version).toBe(1)
    expect(store.row!.leaseHolder).toBeNull()
  })

  it('sin refresh token en BD ni en env lanza VendeloAuthError sin llamar a Venndelo', async () => {
    const fetchFn = vi.fn()
    const provider = makeProvider(store, fetchFn)

    await expect(provider.getAccessToken()).rejects.toBeInstanceOf(VendeloAuthError)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('cachea el access token en memoria hasta poco antes de su vencimiento', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(tokenResponse('access-1'))
      .mockResolvedValueOnce(tokenResponse('access-2', { expires_at: new Date(T0 + 7200_000).toISOString() }))
    const provider = makeProvider(store, fetchFn, 'seed')

    await provider.getAccessToken()
    clock = T0 + 3600_000 - 61_000 // aún fuera del margen de 60s
    await expect(provider.getAccessToken()).resolves.toBe('access-1')
    expect(fetchFn).toHaveBeenCalledTimes(1)

    clock = T0 + 3600_000 - 30_000 // dentro del margen → refresca
    await expect(provider.getAccessToken()).resolves.toBe('access-2')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('reutiliza el access token que otra instancia dejó en BD sin llamar a Venndelo', async () => {
    const fetchA = vi.fn().mockResolvedValue(tokenResponse('access-from-A'))
    const fetchB = vi.fn()

    await makeProvider(store, fetchA, 'seed').getAccessToken()
    await expect(makeProvider(store, fetchB, 'seed').getAccessToken()).resolves.toBe('access-from-A')

    expect(fetchB).not.toHaveBeenCalled()
  })

  it('agrupa refrescos concurrentes de la misma instancia en una sola llamada (single-flight)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(tokenResponse('access-1'))
    const provider = makeProvider(store, fetchFn, 'seed')

    const tokens = await Promise.all(Array.from({ length: 5 }, () => provider.getAccessToken()))

    expect(tokens).toEqual(Array(5).fill('access-1'))
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('dos instancias refrescando a la vez: solo una llama a /oauth/token, la otra espera el lease', async () => {
    await store.seedIfMissing(encryptSecret('seed', KEY))

    let release!: (r: Response) => void
    const fetchA = vi.fn().mockReturnValue(new Promise<Response>((resolve) => { release = resolve }))
    const fetchB = vi.fn()
    const providerA = makeProvider(store, fetchA)
    const providerB = makeProvider(store, fetchB)

    const tokenA = providerA.getAccessToken()
    await vi.waitFor(() => expect(fetchA).toHaveBeenCalled())

    // B no consigue el lease y queda esperando; A termina después
    const tokenB = providerB.getAccessToken()
    release(tokenResponse('access-A', { refresh_token: 'rotated-by-A' }))

    await expect(tokenA).resolves.toBe('access-A')
    await expect(tokenB).resolves.toBe('access-A')
    expect(fetchB).not.toHaveBeenCalled()
    expect(store.plainRefreshToken()).toBe('rotated-by-A')
  })

  it('cuando Venndelo rota el refresh token, lo persiste y lo usa en el siguiente intercambio', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(tokenResponse('access-1', {
        refresh_token: 'rotated-1',
        refresh_token_expires_at: '2026-11-14T12:00:00.000Z',
      }))
      .mockResolvedValueOnce(tokenResponse('access-2', { expires_at: new Date(T0 + 9000_000).toISOString() }))
    const provider = makeProvider(store, fetchFn, 'seed')

    await provider.getAccessToken()
    expect(store.plainRefreshToken()).toBe('rotated-1')
    expect(store.row!.refreshTokenExpiresAt).toEqual(new Date('2026-11-14T12:00:00.000Z'))

    clock = T0 + 3600_000
    await provider.getAccessToken()
    expect(sentRefreshToken(fetchFn, 1)).toBe('rotated-1')
    // Sin rotación en la segunda respuesta: se conserva el último refresh token
    expect(store.plainRefreshToken()).toBe('rotated-1')
  })

  it('tras un 401 (invalidate) refresca aunque el token no haya vencido', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(tokenResponse('access-1'))
      .mockResolvedValueOnce(tokenResponse('access-2'))
    const provider = makeProvider(store, fetchFn, 'seed')

    await provider.getAccessToken()
    provider.invalidate()

    await expect(provider.getAccessToken()).resolves.toBe('access-2')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('si Venndelo rechaza el refresh token lanza VendeloAuthError con el status y libera el lease', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }))
    const provider = makeProvider(store, fetchFn, 'seed')

    const error = await provider.getAccessToken().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(VendeloAuthError)
    expect((error as VendeloAuthError).status).toBe(400)
    expect((error as Error).message).not.toContain('seed')
    expect(store.row!.leaseHolder).toBeNull()
  })

  it('si no puede persistir un refresh token rotado, lo conserva en memoria y lo guarda en el siguiente refresco', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(tokenResponse('access-1', { refresh_token: 'rotated-1' }))
      .mockResolvedValueOnce(tokenResponse('access-2'))
    const provider = makeProvider(store, fetchFn, 'seed')
    await store.seedIfMissing(encryptSecret('seed', KEY))
    store.failSaves = 3 // agota los reintentos de persistencia

    // El token sirve igual aunque no se haya guardado
    await expect(provider.getAccessToken()).resolves.toBe('access-1')
    expect(store.plainRefreshToken()).toBe('seed')
    expect(store.row!.leaseHolder).toBeNull()

    provider.invalidate()
    await provider.getAccessToken()

    // Usa el rotado (no el revocado de BD) y ahora sí lo persiste
    expect(sentRefreshToken(fetchFn, 1)).toBe('rotated-1')
    expect(store.plainRefreshToken()).toBe('rotated-1')
  })

  it('sin expires_at usa expires_in para calcular el vencimiento', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'access-1', token_type: 'Bearer', expires_in: 600,
    }), { status: 200 }))
    const provider = makeProvider(store, fetchFn, 'seed')

    await provider.getAccessToken()
    expect(store.row!.accessTokenExpiresAt).toEqual(new Date(T0 + 600_000))
  })
})
