/**
 * Carga (o reemplaza) el refresh token OAuth de Venndelo en la tabla
 * VendeloCredential, cifrado con VENDELO_TOKEN_ENCRYPTION_KEY.
 *
 * Cuándo usarlo:
 *   - Primera puesta en marcha de OAuth (alternativa a VENDELO_REFRESH_TOKEN).
 *   - Soporte de Venndelo emitió un refresh token nuevo (el anterior fue
 *     revocado o se perdió una rotación). VENDELO_REFRESH_TOKEN NO sirve para
 *     esto: solo se usa si la tabla está vacía.
 *
 * El token se lee de la env var (no de argv) para que no quede en el historial
 * de la shell. Después de guardarlo, verifica contra GET /v1/admin/check-auth.
 *
 * Uso (desde apps/api):
 *   VENDELO_REFRESH_TOKEN=<token> pnpm exec tsx scripts/seed-vendelo-refresh-token.ts
 *
 * Variables requeridas: DATABASE_URL, VENDELO_TOKEN_ENCRYPTION_KEY,
 * VENDELO_REFRESH_TOKEN. VENDELO_AUTH_MODE se fuerza a `oauth` en este script.
 */
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true })

async function main() {
  process.env['VENDELO_AUTH_MODE'] = 'oauth'

  const refreshToken = process.env['VENDELO_REFRESH_TOKEN']?.trim()
  const rawKey = process.env['VENDELO_TOKEN_ENCRYPTION_KEY']
  const missing = [
    !refreshToken && 'VENDELO_REFRESH_TOKEN',
    !rawKey && 'VENDELO_TOKEN_ENCRYPTION_KEY',
    !process.env['DATABASE_URL'] && 'DATABASE_URL',
  ].filter(Boolean)
  if (missing.length) {
    console.error(`❌  Faltan env vars: ${missing.join(', ')}`)
    process.exit(1)
  }

  const { prisma } = await import('@motek/database')
  const { encryptSecret, parseEncryptionKey } = await import('../src/shared/crypto/secret-box')
  const { PrismaVendeloCredentialStore } = await import('../src/infrastructure/repositories/PrismaVendeloCredentialStore')
  const { createVendeloAuthProvider } = await import('../src/infrastructure/services/VendeloAuthProvider')
  const { getVendeloApiUrl } = await import('../src/infrastructure/services/vendelo-config')

  try {
    const store = new PrismaVendeloCredentialStore(prisma)
    await store.replaceRefreshToken(encryptSecret(refreshToken!, parseEncryptionKey(rawKey!)))
    console.log('✓ Refresh token guardado (cifrado) en VendeloCredential')

    console.log('→ Verificando: intercambio de token + GET /v1/admin/check-auth ...')
    const headers = await createVendeloAuthProvider(prisma).getAuthHeaders()
    const res = await fetch(`${getVendeloApiUrl()}/v1/admin/check-auth`, { headers })
    if (!res.ok) {
      console.error(`❌  check-auth respondió HTTP ${res.status}: ${await res.text()}`)
      process.exit(1)
    }
    console.log(`✓ Autenticación OK: ${JSON.stringify(await res.json())}`)
    console.log('\nYa puedes quitar VENDELO_REFRESH_TOKEN del entorno: la credencial vive en BD y rota sola.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(`\n❌  ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
