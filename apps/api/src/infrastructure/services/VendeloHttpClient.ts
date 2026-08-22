import { Injectable, Logger } from '@nestjs/common'

interface RequestOptions {
  method: string
  path: string
  body?: unknown
  attempt?: number
  /**
   * false para endpoints no idempotentes (ej. creación de orden): en un 5xx no
   * sabemos si Vendelo ya procesó la request, así que reintentar puede crear
   * un duplicado. 429 (rate limit) y errores de red antes de enviar el body
   * siguen reintentándose porque ahí sí sabemos que no llegó al servidor.
   */
  retryOn5xx?: boolean
}

const MAX_ATTEMPTS = 4 // 1 initial + 3 retries
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]
const TIMEOUT_MS = 10_000

/** Reintenta en respuestas HTTP de error transitorio */
const isRetryableStatus = (status: number, retryOn5xx: boolean) =>
  status === 429 || (retryOn5xx && status >= 500)

/** Reintenta en errores de red (timeout, ECONNREFUSED, DNS) */
const isRetryableError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false
  return (
    err.name === 'AbortError' ||
    err.name === 'FetchError' ||
    err.message.includes('ECONNREFUSED') ||
    err.message.includes('ENOTFOUND') ||
    err.message.includes('network')
  )
}

// ── Circuit Breaker ───────────────────────────────────────────────────────────

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/**
 * Umbrales del Circuit Breaker.
 * FAILURE_THRESHOLD: fallos consecutivos antes de abrir el circuito.
 * RESET_TIMEOUT_MS:  tiempo en estado OPEN antes de pasar a HALF_OPEN (prueba).
 */
const FAILURE_THRESHOLD = 5
const RESET_TIMEOUT_MS  = 60_000 // 1 minuto

const VENDELO_AUTH_HEADER = 'X-Venndelo-Api-Key'

// ── Client ───────────────────────────────────────────────────────────────────

@Injectable()
export class VendeloHttpClient {
  private readonly logger = new Logger(VendeloHttpClient.name)
  private readonly apiKey: string
  private readonly baseUrl: string

  // Circuit Breaker state (instancia única por proceso — compartida entre requests)
  private circuitState: CircuitState = 'CLOSED'
  private consecutiveFailures = 0
  private circuitOpenedAt?: number

  constructor() {
    this.apiKey = process.env['VENDELO_API_KEY'] ?? ''
    this.baseUrl = (process.env['VENDELO_API_URL'] ?? 'https://api.vendelo.co').replace(/\/$/, '')
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>({ method: 'GET', path })
  }

  async post<T>(path: string, body: unknown, opts?: { retryOn5xx?: boolean }): Promise<T> {
    return this.request<T>({ method: 'POST', path, body, retryOn5xx: opts?.retryOn5xx ?? true })
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>({ method: 'PATCH', path, body })
  }

  // ── Circuit Breaker ───────────────────────────────────────────────────────

  private checkCircuit(): void {
    if (this.circuitState === 'CLOSED') return

    if (this.circuitState === 'OPEN') {
      const elapsed = Date.now() - (this.circuitOpenedAt ?? 0)
      if (elapsed >= RESET_TIMEOUT_MS) {
        this.circuitState = 'HALF_OPEN'
        this.logger.warn('[CircuitBreaker] OPEN → HALF_OPEN — probando recuperación de Vendelo API')
      } else {
        const remaining = Math.ceil((RESET_TIMEOUT_MS - elapsed) / 1000)
        throw new Error(`Vendelo API circuit breaker OPEN — reintento en ${remaining}s`)
      }
    }
    // HALF_OPEN: deja pasar una request de prueba
  }

  private onRequestSuccess(): void {
    if (this.circuitState === 'HALF_OPEN') {
      this.circuitState = 'CLOSED'
      this.consecutiveFailures = 0
      this.logger.log('[CircuitBreaker] HALF_OPEN → CLOSED — Vendelo API recuperada')
    } else if (this.circuitState === 'CLOSED') {
      this.consecutiveFailures = 0
    }
  }

  private onRequestFailure(reason: string): void {
    this.consecutiveFailures++

    if (this.circuitState === 'HALF_OPEN') {
      this.circuitState = 'OPEN'
      this.circuitOpenedAt = Date.now()
      this.logger.error(`[CircuitBreaker] HALF_OPEN → OPEN — fallo en prueba de recuperación: ${reason}`)
      return
    }

    if (this.consecutiveFailures >= FAILURE_THRESHOLD) {
      this.circuitState = 'OPEN'
      this.circuitOpenedAt = Date.now()
      this.logger.error(
        `[CircuitBreaker] CLOSED → OPEN — ${this.consecutiveFailures} fallos consecutivos. Vendelo API no disponible.`,
      )
    }
  }

  // ── HTTP request con retry ────────────────────────────────────────────────

  private async request<T>({ method, path, body, attempt = 1, retryOn5xx = true }: RequestOptions): Promise<T> {
    this.checkCircuit()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const start = Date.now()

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          [VENDELO_AUTH_HEADER]: this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      const latency = Date.now() - start
      this.logger.log(`${method} ${path} → ${res.status} (${latency}ms)`)

      if (isRetryableStatus(res.status, retryOn5xx) && attempt < MAX_ATTEMPTS) {
        const delay = RETRY_DELAYS_MS[attempt - 1] ?? 4_000
        this.logger.warn(`Vendelo ${res.status} — reintentando en ${delay}ms (intento ${attempt}/${MAX_ATTEMPTS - 1})`)
        await this.sleep(delay)
        return this.request<T>({ method, path, body, attempt: attempt + 1, retryOn5xx })
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const message = `Vendelo API ${res.status}: ${text}`
        this.logger.error(message, { method, path })
        this.onRequestFailure(`HTTP ${res.status}`)
        throw new Error(message)
      }

      this.onRequestSuccess()
      return res.json() as Promise<T>
    } catch (err) {
      // Re-throw de errores de circuit breaker (ya logueados)
      if (err instanceof Error && err.message.startsWith('Vendelo API circuit breaker')) {
        throw err
      }

      // Errores de red (timeout, ECONNREFUSED, DNS) — reintentar
      if (isRetryableError(err) && attempt < MAX_ATTEMPTS) {
        const delay = RETRY_DELAYS_MS[attempt - 1] ?? 4_000
        this.logger.warn(
          `Vendelo error de red (${err instanceof Error ? err.name : 'unknown'}) — reintentando en ${delay}ms (intento ${attempt}/${MAX_ATTEMPTS - 1})`,
        )
        await this.sleep(delay)
        return this.request<T>({ method, path, body, attempt: attempt + 1, retryOn5xx })
      }

      if (isRetryableError(err)) {
        this.onRequestFailure(err instanceof Error ? err.message : String(err))
      }

      if (err instanceof Error && err.name === 'AbortError') {
        const msg = `Vendelo request timeout (>${TIMEOUT_MS}ms): ${method} ${path}`
        this.logger.error(msg)
        throw new Error(msg)
      }

      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
  }

  /** Expone el estado del circuit breaker para health checks y tests */
  getCircuitState(): CircuitState {
    return this.circuitState
  }
}
