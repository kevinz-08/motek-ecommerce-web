import type { PrismaClient } from '@motek/database'
import type {
  IVendeloCredentialStore,
  SaveRefreshResultInput,
  VendeloCredentialRecord,
} from '../services/VendeloOAuthTokenProvider'

/** La credencial de Venndelo es una fila única. */
const CREDENTIAL_ID = 'default'

/**
 * Persistencia de la credencial OAuth de Venndelo. Todas las escrituras de
 * coordinación son `updateMany` con condición en el WHERE — atómicas en
 * PostgreSQL sin transacciones largas ni advisory locks (compatibles con el
 * pooler de Neon), igual que el claim de VendeloOrderQueue.
 */
export class PrismaVendeloCredentialStore implements IVendeloCredentialStore {
  constructor(private readonly prisma: PrismaClient) {}

  async find(): Promise<VendeloCredentialRecord | null> {
    return this.prisma.vendeloCredential.findUnique({
      where: { id: CREDENTIAL_ID },
      select: {
        refreshTokenEnc: true,
        refreshTokenExpiresAt: true,
        accessTokenEnc: true,
        accessTokenExpiresAt: true,
        version: true,
      },
    })
  }

  async seedIfMissing(refreshTokenEnc: string): Promise<void> {
    // update vacío: si otra instancia ya la creó, no se pisa su refresh token
    await this.prisma.vendeloCredential.upsert({
      where: { id: CREDENTIAL_ID },
      create: { id: CREDENTIAL_ID, refreshTokenEnc },
      update: {},
    })
  }

  async tryAcquireRefreshLease(holder: string, ttlMs: number): Promise<boolean> {
    const now = new Date()
    const res = await this.prisma.vendeloCredential.updateMany({
      where: {
        id: CREDENTIAL_ID,
        OR: [{ refreshLeaseUntil: null }, { refreshLeaseUntil: { lt: now } }],
      },
      data: { refreshLeaseHolder: holder, refreshLeaseUntil: new Date(now.getTime() + ttlMs) },
    })
    return res.count === 1
  }

  async saveRefreshResult(input: SaveRefreshResultInput): Promise<boolean> {
    const res = await this.prisma.vendeloCredential.updateMany({
      where: { id: CREDENTIAL_ID, version: input.expectedVersion },
      data: {
        accessTokenEnc: input.accessTokenEnc,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        ...(input.refreshTokenEnc && {
          refreshTokenEnc: input.refreshTokenEnc,
          refreshTokenExpiresAt: input.refreshTokenExpiresAt ?? null,
        }),
        version: { increment: 1 },
        lastRefreshedAt: new Date(),
        refreshLeaseHolder: null,
        refreshLeaseUntil: null,
      },
    })
    return res.count === 1
  }

  async releaseRefreshLease(holder: string): Promise<void> {
    await this.prisma.vendeloCredential.updateMany({
      where: { id: CREDENTIAL_ID, refreshLeaseHolder: holder },
      data: { refreshLeaseHolder: null, refreshLeaseUntil: null },
    })
  }

  /**
   * Reemplaza el refresh token (cuando soporte emite uno nuevo). Invalida el
   * access token compartido para forzar un refresco con el token nuevo.
   */
  async replaceRefreshToken(refreshTokenEnc: string): Promise<void> {
    await this.prisma.vendeloCredential.upsert({
      where: { id: CREDENTIAL_ID },
      create: { id: CREDENTIAL_ID, refreshTokenEnc },
      update: {
        refreshTokenEnc,
        refreshTokenExpiresAt: null,
        accessTokenEnc: null,
        accessTokenExpiresAt: null,
        version: { increment: 1 },
        refreshLeaseHolder: null,
        refreshLeaseUntil: null,
      },
    })
  }
}
