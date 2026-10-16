/**
 * Autenticación de Venndelo para scripts one-off de `apps/api/scripts/`.
 *
 * Usa exactamente el mismo proveedor que la API (VENDELO_AUTH_MODE):
 *   - apikey → cabecera X-Venndelo-Api-Key
 *   - oauth  → access token compartido en la tabla VendeloCredential
 *
 * Importante en modo oauth: un script NUNCA debe llamar a /oauth/token por su
 * cuenta con un refresh token propio — si Venndelo lo rota, la API quedaría con
 * uno revocado. Por eso pasa por el proveedor, que coordina vía BD.
 *
 * Cargar dotenv ANTES de llamar a estas funciones: los imports son dinámicos
 * para que el cliente de Prisma lea DATABASE_URL ya cargado.
 */

export interface VendeloScriptAuth {
  mode: 'apikey' | 'oauth'
  getHeaders(): Promise<Record<string, string>>
  /** Cierra la conexión a BD (solo modo oauth). */
  close(): Promise<void>
}

export async function createScriptAuth(): Promise<VendeloScriptAuth> {
  const { getVendeloAuthMode } = await import('../../src/infrastructure/services/vendelo-config')
  const { ApiKeyAuthProvider } = await import('../../src/infrastructure/services/VendeloAuthProvider')

  if (getVendeloAuthMode() === 'apikey') {
    const apiKey = process.env['VENDELO_API_KEY']
    if (!apiKey) throw new Error('VENDELO_API_KEY no configurado (VENDELO_AUTH_MODE=apikey)')
    const provider = new ApiKeyAuthProvider(apiKey)
    return { mode: 'apikey', getHeaders: () => provider.getAuthHeaders(), close: async () => {} }
  }

  const { prisma } = await import('@motek/database')
  const { createVendeloAuthProvider } = await import('../../src/infrastructure/services/VendeloAuthProvider')
  const provider = createVendeloAuthProvider(prisma)
  return {
    mode: 'oauth',
    getHeaders: () => provider.getAuthHeaders(),
    close: () => prisma.$disconnect(),
  }
}
