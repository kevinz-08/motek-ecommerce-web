/** Roles de usuario en el sistema */
export type UserRole = 'ADMIN' | 'CUSTOMER'

/** Entidad de usuario — sin dependencias de Prisma ni librerías externas */
export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  role: UserRole
  createdAt: Date
}
