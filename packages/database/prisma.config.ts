/**
 * Configuración de Prisma 7 para @motek/database.
 *
 * Cargamos DATABASE_URL desde varias ubicaciones candidatas porque el monorepo
 * puede tener el .env en el root (compartido), en apps/web (legado pre-migración)
 * o en el propio paquete. `dotenv` no sobrescribe variables ya definidas, así que
 * el primer archivo que exista gana.
 */
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

loadEnv({ path: '../../.env' })
loadEnv({ path: '../../apps/web/.env' })
loadEnv({ path: '../../apps/web/.env.local' })
loadEnv({ path: './.env' })

export default defineConfig({
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})
