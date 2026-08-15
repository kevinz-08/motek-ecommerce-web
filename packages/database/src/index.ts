/**
 * Singleton del cliente Prisma para todo el monorepo.
 *
 * Por qué está en @motek/database:
 *   Prisma 7 requiere un driver adapter (PrismaPg) y un paso de `generate` que
 *   escribe el cliente en ./src/generated/prisma/. Centralizar evita que cada
 *   consumidor (apps/web, apps/api) configure su propio adapter o mantenga
 *   su propia copia del cliente generado.
 *
 * Por qué singleton con globalThis:
 *   Next.js + Turbopack recargan módulos en cada cambio. Sin el patrón global,
 *   cada recarga crearía una nueva PrismaClient con su propio pool de conexiones
 *   y agotaría el límite de Neon (5-10 conexiones en tier gratuito).
 *
 * Connection pool:
 *   Se usa pg.Pool con max configurable via DATABASE_POOL_MAX (default 5).
 *   En producción serverless (Vercel) cada función puede tener su propio proceso,
 *   por lo que un max bajo evita saturar el límite de conexiones de Neon.
 *   Para Neon, se recomienda añadir ?pgbouncer=true a DATABASE_URL si se usa
 *   el pooler nativo de Neon en lugar de este pool a nivel de driver.
 *
 * Consumo:
 *   import { prisma } from '@motek/database'
 *
 * Nota sobre el generated client:
 *   Se genera en `./generated/prisma/` via `prisma generate` (script `generate`
 *   de este paquete). La carpeta está en .gitignore. Antes de un build limpio
 *   correr `pnpm --filter @motek/database generate`.
 */
import { Pool } from 'pg'
import { PrismaClient } from './generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const POOL_MAX = parseInt(process.env['DATABASE_POOL_MAX'] ?? '5', 10)

function createPrismaClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL']
  if (!connectionString) {
    throw new Error(
      '@motek/database: DATABASE_URL no está definida. ' +
        'Configurá el .env de la app consumidora (apps/web o apps/api).',
    )
  }
  const pool = new Pool({
    connectionString,
    max: POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  __motekPrisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
  globalForPrisma.__motekPrisma ?? createPrismaClient()

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.__motekPrisma = prisma
}

// Cierra el pool limpiamente cuando el proceso recibe señal de terminación.
// process.once evita registrar el handler múltiples veces si el módulo se
// re-evalúa (HMR en desarrollo).
const shutdown = () => prisma.$disconnect().then(() => process.exit(0))
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

// Re-exportar tipos generados para que los consumidores no tengan que importarlos
// desde la ruta interna ./generated/prisma/*
export { PrismaClient } from './generated/prisma/client'
export type { Prisma } from './generated/prisma/client'
export * from './generated/prisma/enums'
export * from './generated/prisma/models'
