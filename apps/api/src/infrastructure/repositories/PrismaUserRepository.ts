import { Injectable } from '@nestjs/common'
import { IUserRepository, User, UserRole } from '@motek/domain'
import { PrismaService } from '../database/prisma.service'

type PrismaUserRow = {
  id: string; email: string; name: string | null; image: string | null
  role: string; createdAt: Date
}

function toDomain(u: PrismaUserRow): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    role: u.role as UserRole,
    createdAt: u.createdAt,
  }
}

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const u = await this.prisma.client.user.findUnique({ where: { id } })
    return u ? toDomain(u) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const u = await this.prisma.client.user.findUnique({ where: { email } })
    return u ? toDomain(u) : null
  }

  async findAll(): Promise<User[]> {
    const users = await this.prisma.client.user.findMany({ orderBy: { createdAt: 'desc' } })
    return users.map(toDomain)
  }
}
