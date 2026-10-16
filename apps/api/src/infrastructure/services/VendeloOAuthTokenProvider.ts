import { Logger } from '@nestjs/common'
import * as Sentry from '@sentry/nestjs'
import { randomUUID } from 'crypto'
import { decryptSecret, encryptSecret } from '../../shared/crypto/secret-box'
import type { IVendeloAuthProvider } from './VendeloAuthProvider'

// ── Persistencia ──────────────────────────────────────────────────────────────

/** Fila de credencial tal como vive en BD — tokens siempre cifrados. */
export interface VendeloCredentialRecord {
  refreshTokenEnc: string
  refreshTokenExpiresAt: Date | null
  accessTokenEnc: string | null
  accessTokenExpiresAt: Date | null
  version: number
}

export interface SaveRefreshResultInput {
  /** Compare-and-swap: solo escribe si la fila sigue en esta versión. */
  expectedVersion: number
  holder: string
  accessTokenEnc: string
  accessTokenExpiresAt: Date
  /** Solo presente si Venndelo rotó el refresh token. */
  refreshTokenEnc?: string
  refreshTokenExpiresAt?: Date | null
}

/**
 * Almacén compartido entre instancias. Implementado por
 * PrismaVendeloCredentialStore; en tests, por un fake en memoria.
 */
export interface IVendeloCredentialStore {
  find(): Promise<VendeloCredentialRecord | null>
  /** Crea la fila con el refresh token inicial si no existe. No-op si ya existe. */
  seedIfMissing(refreshTokenEnc: string): Promise<void>
  /** Toma el lease de refresco si está libre o vencido. true = lo obtuvo este holder. */
  tryAcquireRefreshLease(holder: string, ttlMs: number): Promise<boolean>
  /** Guarda el resultado y libera el lease. false = la versión cambió (CAS falló). */
  saveRefreshResult(input: SaveRefreshResultInput): Promise<boolean>
  releaseRefreshLease(holder: string): Promise<void>
}

// ── Contrato HTTP de Venndelo (POST /v1/admin/oauth/token) ────────────────────

interface ApiAccessToken {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: string
  refresh_token?: string
  refresh_token_expires_at?: string
  refresh_token_expires_in?: number
}

/** Error de autenticación OAuth — nunca incluye tokens en el mensaje. */
export class VendeloAuthError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'VendeloAuthError'
  }
}

export interface VendeloOAuthTokenProviderOptions {
  baseUrl: string
  encryptionKey: Buffer
  /** Refresh token inicial (env VENDELO_REFRESH_TOKEN). Solo se usa si la BD aún no tiene uno. */
  seedRefreshToken?: string
  /** Inyectables para tests. */
  fetchFn?: typeof fetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

/** Margen antes del vencimiento para considerar el access token expirado. */
const EXPIRY_SKEW_MS = 60_000
/** Duración del lease de refresco — cubre el timeout HTTP con holgura. */
const LEASE_TTL_MS = 20_000
const LEASE_POLL_MS = 500
/** 24 × 500ms = 12s esperando a que otra instancia termine de refrescar. */
const LEASE_WAIT_ATTEMPTS = 24
const TOKEN_REQUEST_TIMEOUT_MS = 10_000
const PERSIST_ATTEMPTS = 3

interface CachedToken {
  token: string
  expiresAt: number
}

/**
 * Proveedor de tokens OAuth de Venndelo.
 *
 * **Por qué no basta con una env var:** el refresh token rota — cuando Venndelo
 * devuelve uno nuevo, el anterior deja de servir. Con varias instancias de Cloud
 * Run, dos refrescos simultáneos con el mismo refresh token harían que una de
 * ellas quedara con un token revocado. Por eso:
 *
 *   1. El access token vigente se comparte vía BD (todas las instancias lo leen)
 *      y se cachea en memoria hasta `expires_at - 60s`.
 *   2. Solo la instancia que gana el lease llama a `/oauth/token`; las demás
 *      esperan y releen la fila.
 *   3. El resultado se escribe con compare-and-swap sobre `version`.
 *   4. Dentro de una misma instancia, los refrescos concurrentes se agrupan en
 *      una sola promesa (single-flight).
 *
 * Si Venndelo rotó el refresh token pero no se pudo persistir (BD caída), el
 * token nuevo se conserva en memoria y se reintenta persistir en el siguiente
 * refresco — perderlo obligaría a pedir uno nuevo a soporte.
 */
export class VendeloOAuthTokenProvider implements IVendeloAuthProvider {
  readonly mode = 'oauth' as const
  private readonly logger = new Logger(VendeloOAuthTokenProvider.name)
  private readonly holder = `instance-${randomUUID()}`
  private readonly fetchFn: typeof fetch
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>

  private cached?: CachedToken
  private inflight?: Promise<string>
  /** Access token que Venndelo rechazó con 401 aunque no hubiera vencido. */
  private rejectedToken?: string
  /** Refresh token rotado que no se logró persistir — prioridad sobre el de BD. */
  private unpersistedRefresh?: { token: string; expiresAt: Date | null }

  constructor(
    private readonly store: IVendeloCredentialStore,
    private readonly opts: VendeloOAuthTokenProviderOptions,
  ) {
    this.fetchFn = opts.fetchFn ?? fetch
    this.now = opts.now ?? Date.now
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await this.getAccessToken()}` }
  }

  invalidate(): void {
    if (this.cached) this.rejectedToken = this.cached.token
    this.cached = undefined
  }

  async getAccessToken(): Promise<string> {
    if (this.cached && this.isFresh(this.cached.expiresAt)) return this.cached.token
    if (!this.inflight) {
      this.inflight = this.resolveToken().finally(() => { this.inflight = undefined })
    }
    return this.inflight
  }

  // ── Resolución ──────────────────────────────────────────────────────────────

  private async resolveToken(): Promise<string> {
    for (let attempt = 0; attempt < LEASE_WAIT_ATTEMPTS; attempt++) {
      const record = await this.findOrSeed()

      const shared = this.usableAccessToken(record)
      if (shared) return shared

      if (await this.store.tryAcquireRefreshLease(this.holder, LEASE_TTL_MS)) {
        return this.refreshWithLease()
      }

      // Otra instancia está refrescando — esperar y releer la fila
      await this.sleep(LEASE_POLL_MS)
    }
    throw new VendeloAuthError('Timeout esperando que otra instancia refresque el token de Venndelo')
  }

  private async refreshWithLease(): Promise<string> {
    let leaseReleased = false
    try {
      // Releer tras tomar el lease: otra instancia pudo terminar justo antes
      const record = await this.findOrSeed()
      const shared = this.usableAccessToken(record)
      if (shared) return shared

      const refreshToken = this.unpersistedRefresh?.token
        ?? decryptSecret(record.refreshTokenEnc, this.opts.encryptionKey)
      const res = await this.requestAccessToken(refreshToken)

      const accessTokenExpiresAt = this.parseExpiry(res.expires_at, res.expires_in)
      const rotated = res.refresh_token
        ? {
            token: res.refresh_token,
            expiresAt: res.refresh_token_expires_at
              ? new Date(res.refresh_token_expires_at)
              : res.refresh_token_expires_in !== undefined
                ? new Date(this.now() + res.refresh_token_expires_in * 1000)
                : null,
          }
        : this.unpersistedRefresh // reintentar persistir uno rotado previamente

      const saved = await this.persist({
        expectedVersion: record.version,
        holder: this.holder,
        accessTokenEnc: encryptSecret(res.access_token, this.opts.encryptionKey),
        accessTokenExpiresAt,
        ...(rotated && {
          refreshTokenEnc: encryptSecret(rotated.token, this.opts.encryptionKey),
          refreshTokenExpiresAt: rotated.expiresAt,
        }),
      })
      leaseReleased = saved

      if (saved) {
        this.unpersistedRefresh = undefined
      } else if (rotated) {
        this.unpersistedRefresh = rotated
        this.reportCritical(
          'Venndelo rotó el refresh token pero no se pudo guardar en BD — se conserva en memoria y se reintentará',
        )
      }
      if (res.refresh_token) {
        this.logger.log(`[VendeloOAuth] Refresh token rotado${saved ? ' y persistido' : ''}`)
      }

      this.cached = { token: res.access_token, expiresAt: accessTokenExpiresAt.getTime() }
      this.rejectedToken = undefined
      return res.access_token
    } finally {
      if (!leaseReleased) {
        await this.store.releaseRefreshLease(this.holder).catch((e) =>
          this.logger.warn(`[VendeloOAuth] No se pudo liberar el lease: ${e}`),
        )
      }
    }
  }

  private async findOrSeed(): Promise<VendeloCredentialRecord> {
    const record = await this.store.find()
    if (record) return record

    const seed = this.opts.seedRefreshToken?.trim()
    if (!seed) {
      throw new VendeloAuthError(
        'No hay refresh token de Venndelo: configurar VENDELO_REFRESH_TOKEN (solo se usa la primera vez) '
        + 'o ejecutar scripts/seed-vendelo-refresh-token.ts',
      )
    }
    await this.store.seedIfMissing(encryptSecret(seed, this.opts.encryptionKey))
    this.logger.log('[VendeloOAuth] Credencial inicial creada desde VENDELO_REFRESH_TOKEN')

    const seeded = await this.store.find()
    if (!seeded) throw new VendeloAuthError('No se pudo crear la credencial inicial de Venndelo')
    return seeded
  }

  /** Access token compartido en BD si sigue vigente y no fue rechazado. */
  private usableAccessToken(record: VendeloCredentialRecord): string | null {
    if (!record.accessTokenEnc || !record.accessTokenExpiresAt) return null
    if (!this.isFresh(record.accessTokenExpiresAt.getTime())) return null

    const token = decryptSecret(record.accessTokenEnc, this.opts.encryptionKey)
    if (token === this.rejectedToken) return null

    this.cached = { token, expiresAt: record.accessTokenExpiresAt.getTime() }
    return token
  }

  private async persist(input: SaveRefreshResultInput): Promise<boolean> {
    for (let attempt = 1; attempt <= PERSIST_ATTEMPTS; attempt++) {
      try {
        const saved = await this.store.saveRefreshResult(input)
        if (!saved) {
          this.logger.error(
            `[VendeloOAuth] Compare-and-swap falló (version=${input.expectedVersion}) — otra instancia escribió la credencial`,
          )
        }
        return saved
      } catch (e) {
        this.logger.warn(`[VendeloOAuth] Error guardando credencial (intento ${attempt}/${PERSIST_ATTEMPTS}): ${e}`)
        if (attempt < PERSIST_ATTEMPTS) await this.sleep(attempt * 500)
      }
    }
    return false
  }

  // ── HTTP ────────────────────────────────────────────────────────────────────

  private async requestAccessToken(refreshToken: string): Promise<ApiAccessToken> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await this.fetchFn(`${this.opts.baseUrl}/v1/admin/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
        signal: controller.signal,
      })
    } catch (e) {
      throw new VendeloAuthError(
        `No se pudo contactar /oauth/token: ${e instanceof Error ? e.name : 'unknown'}`,
      )
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) {
      // 4xx = refresh token inválido/revocado → requiere intervención humana
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        this.reportCritical(
          `Venndelo rechazó el refresh token (HTTP ${res.status}) — solicitar uno nuevo a soporte y `
          + 'cargarlo con scripts/seed-vendelo-refresh-token.ts',
        )
      }
      throw new VendeloAuthError(`Venndelo /oauth/token respondió HTTP ${res.status}`, res.status)
    }

    const body = (await res.json()) as Partial<ApiAccessToken>
    if (typeof body.access_token !== 'string' || !body.access_token) {
      throw new VendeloAuthError('Respuesta de /oauth/token sin access_token')
    }
    return body as ApiAccessToken
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private isFresh(expiresAtMs: number): boolean {
    return expiresAtMs - EXPIRY_SKEW_MS > this.now()
  }

  private parseExpiry(expiresAt: string | undefined, expiresIn: number | undefined): Date {
    const parsed = expiresAt ? Date.parse(expiresAt) : NaN
    if (!Number.isNaN(parsed)) return new Date(parsed)
    if (typeof expiresIn === 'number' && expiresIn > 0) return new Date(this.now() + expiresIn * 1000)
    // Sin información de vencimiento: asumir vida corta para forzar refresco pronto
    return new Date(this.now() + 5 * 60_000)
  }

  private reportCritical(message: string): void {
    this.logger.error(`[VendeloOAuth] CRITICAL — ${message}`)
    Sentry.captureMessage(`[VendeloOAuth] ${message}`, 'fatal')
  }
}
