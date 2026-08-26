/**
 * Fachada del singleton de Prisma en apps/web.
 *
 * El singleton real vive en @motek/database — única instancia y única configuración
 * del adapter (PrismaPg + pool de conexiones) para todo el monorepo. Centralizar
 * evita que apps/web y apps/api abran pools separados contra Neon.
 *
 * Se mantiene esta re-exportación para no romper los imports existentes del tipo
 * `@/infrastructure/database/prisma-client`. En Fase 2 los repositorios migran
 * a apps/api y este archivo desaparece.
 */
export { prisma } from '@motek/database'
