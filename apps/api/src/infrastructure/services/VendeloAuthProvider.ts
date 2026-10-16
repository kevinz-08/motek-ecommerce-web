import type { PrismaClient } from '@motek/database'
import { parseEncryptionKey } from '../../shared/crypto/secret-box'
import { PrismaVendeloCredentialStore } from '../repositories/PrismaVendeloCredentialStore'
import { VendeloOAuthTokenProvider } from './VendeloOAuthTokenProvider'
import { getVendeloApiUrl, getVendeloAuthMode, type VendeloAuthMode } from './vendelo-config'

/**
 * Estrategia de autenticación contra la API de Venndelo. VendeloHttpClient
 * pide las cabeceras en cada request y llama a `invalidate()` tras un 401.
 */
export interface IVendeloAuthProvider {
  readonly mode: VendeloAuthMode
  getAuthHeaders(): Promise<Record<string, string>>
  /** Descarta el token en caché porque Venndelo lo rechazó (401). */
  invalidate(): void
}

/**
 * Autenticación heredada por API Key (cabecera `X-Venndelo-Api-Key`).
 * Deprecada por Venndelo el 2026-06-12 — se mantiene solo como fallback
 * mientras se completa la migración a OAuth.
 */
export class ApiKeyAuthProvider implements IVendeloAuthProvider {
  readonly mode = 'apikey' as const

  constructor(private readonly apiKey: string) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    return { 'X-Venndelo-Api-Key': this.apiKey }
  }

  invalidate(): void {
    // Una API Key no se refresca: un 401 aquí es un error de configuración.
  }
}

/**
 * Construye el proveedor según VENDELO_AUTH_MODE. Lo usan el módulo NestJS y
 * los scripts de `apps/api/scripts/` — ambos deben compartir la credencial en
 * BD: un script que refrescara por su cuenta rotaría el refresh token y dejaría
 * a la API con uno revocado.
 */
export function createVendeloAuthProvider(prisma: PrismaClient): IVendeloAuthProvider {
  if (getVendeloAuthMode() === 'apikey') {
    return new ApiKeyAuthProvider(process.env['VENDELO_API_KEY'] ?? '')
  }

  const rawKey = process.env['VENDELO_TOKEN_ENCRYPTION_KEY']
  if (!rawKey) {
    throw new Error('VENDELO_AUTH_MODE=oauth requiere VENDELO_TOKEN_ENCRYPTION_KEY')
  }

  return new VendeloOAuthTokenProvider(new PrismaVendeloCredentialStore(prisma), {
    baseUrl: getVendeloApiUrl(),
    encryptionKey: parseEncryptionKey(rawKey),
    seedRefreshToken: process.env['VENDELO_REFRESH_TOKEN'],
  })
}
