const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Response types ────────────────────────────────────────────────────────────

export type ApiOk<T> = { ok: true; data: T; status: number }
export type ApiErr = { ok: false; error: string; status: number }
export type ApiResponse<T> = ApiOk<T> | ApiErr

// ── Internal parser ───────────────────────────────────────────────────────────

async function parseResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const text = await res.text()
  let body: unknown = {}
  try { body = text ? JSON.parse(text) : {} } catch { /* non-JSON body */ }

  if (!res.ok) {
    const b = body as { message?: string; error?: string }
    return {
      ok: false,
      error: b.message ?? b.error ?? res.statusText,
      status: res.status,
    }
  }
  return { ok: true, data: body as T, status: res.status }
}

// Wraps fetch so network-level failures (CORS, connection refused, DNS) return
// ApiErr instead of throwing — callers always get an ApiResponse, never an exception.
async function doFetch<T>(input: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(input, init)
    return parseResponse<T>(res)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de red desconocido'
    // "Failed to fetch" means the request never reached the server.
    // Most common causes: API not running, CORS preflight rejected, or no internet.
    const friendly =
      message === 'Failed to fetch'
        ? 'No se pudo conectar con el servidor. Verifica que la API esté corriendo.'
        : message
    return { ok: false, error: friendly, status: 0 }
  }
}

// ── Client factory ────────────────────────────────────────────────────────────

export function apiClient(accessToken?: string | null) {
  const bearer: Record<string, string> = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {}
  const json: Record<string, string> = { 'Content-Type': 'application/json', ...bearer }

  const base = (path: string) => `${API_BASE}${path}`

  return {
    get: <T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> =>
      doFetch<T>(base(path), { ...init, headers: { ...bearer, ...init?.headers } }),

    post: <T>(path: string, body?: unknown): Promise<ApiResponse<T>> =>
      doFetch<T>(base(path), {
        method: 'POST',
        headers: json,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),

    put: <T>(path: string, body?: unknown): Promise<ApiResponse<T>> =>
      doFetch<T>(base(path), {
        method: 'PUT',
        headers: json,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),

    patch: <T>(path: string, body?: unknown): Promise<ApiResponse<T>> =>
      doFetch<T>(base(path), {
        method: 'PATCH',
        headers: json,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),

    delete: <T = void>(path: string): Promise<ApiResponse<T>> =>
      doFetch<T>(base(path), { method: 'DELETE', headers: bearer }),

    /** Multipart/form-data — omite Content-Type para que el browser fije el boundary */
    postForm: <T>(path: string, formData: FormData): Promise<ApiResponse<T>> =>
      doFetch<T>(base(path), { method: 'POST', headers: bearer, body: formData }),
  }
}
