/**
 * Configuración de Prisma 7 para @motek/database.
 *
 * Cargamos DATABASE_URL desde varias ubicaciones candidatas porque el monorepo
 * puede tener el .env en el propio paquete, en el root (compartido) o en apps/web
 * (legado pre-migración). `dotenv` no sobrescribe variables ya definidas, así que
 * el primer archivo que exista gana — y una DATABASE_URL pasada en el entorno del
 * comando gana sobre todos.
 *
 * El .env del paquete va PRIMERO: es el que usan prisma/seed.ts y los scripts de
 * prisma/ (via dotenv/config), así que los comandos de Prisma CLI y los scripts
 * apuntan siempre a la misma base. Antes iba último y un apps/web/.env heredado
 * apuntando a producción hacía que `prisma migrate` corriera contra producción
 * mientras los scripts usaban la base de desarrollo.
 */
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

loadEnv({ path: './.env' })
loadEnv({ path: '../../.env' })
loadEnv({ path: '../../apps/web/.env' })
loadEnv({ path: '../../apps/web/.env.local' })

export default defineConfig({
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})
