/**
 * Implementación de IUserRepository usando Prisma 7 + PostgreSQL (Neon).
 *
 * Nota: la creación de usuarios la maneja NextAuth automáticamente via PrismaAdapter.
 * Este repositorio solo expone operaciones de lectura que los use cases necesitan.
 * Si en el futuro se necesita crear usuarios manualmente (ej: importación), se agrega save() aquí.
 */
import { prisma, type UserModel as PrismaUser } from '@motek/database'
import { IUserRepository, User, UserRole } from '@motek/domain'

/** Mapea un registro de usuario de Prisma a la entidad de dominio User */
function toDomain(u: PrismaUser): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    role: u.role as UserRole, // el enum de Prisma y el tipo de dominio son compatibles
    createdAt: u.createdAt,
  }
}

/** Implementación de acceso a datos de usuarios con Prisma */
export class PrismaUserRepository implements IUserRepository {

  /** Busca un usuario por su ID de base de datos */
  async findById(id: string): Promise<User | null> {
    const u = await prisma.user.findUnique({ where: { id } })
    return u ? toDomain(u) : null
  }

  /** Busca un usuario por correo electrónico (único en la BD) */
  async findByEmail(email: string): Promise<User | null> {
    const u = await prisma.user.findUnique({ where: { email } })
    return u ? toDomain(u) : null
  }

  /** Retorna todos los usuarios ordenados por fecha de creación descendente */
  async findAll(): Promise<User[]> {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
    return users.map(toDomain)
  }
}
