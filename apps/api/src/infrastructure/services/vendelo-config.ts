/** URL base oficial de la API de Venndelo (ver API_VENDELO_DOCUMENTACION.md). */
export const DEFAULT_VENDELO_API_URL = 'https://api.venndelo.com'

/** URL base configurada, sin slash final. */
export function getVendeloApiUrl(): string {
  return (process.env['VENDELO_API_URL'] ?? DEFAULT_VENDELO_API_URL).replace(/\/$/, '')
}

export type VendeloAuthMode = 'apikey' | 'oauth'

/**
 * Modo de autenticación contra Venndelo. Default `apikey` (método heredado,
 * deprecado por Venndelo el 2026-06-12) para no romper despliegues que aún no
 * tienen refresh token; pasar a `oauth` en cuanto soporte lo entregue.
 */
export function getVendeloAuthMode(): VendeloAuthMode {
  const raw = (process.env['VENDELO_AUTH_MODE'] ?? 'apikey').trim().toLowerCase()
  if (raw !== 'apikey' && raw !== 'oauth') {
    throw new Error(`VENDELO_AUTH_MODE inválido: "${raw}" (valores: apikey | oauth)`)
  }
  return raw
}
