import { User } from '@/domain/entities/User'

/** Contrato de acceso a datos de usuarios */
export interface IUserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findAll(): Promise<User[]>
}
