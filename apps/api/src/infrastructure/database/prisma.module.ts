import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

/**
 * Módulo global de Prisma.
 * Al marcarlo con @Global(), PrismaService queda disponible en toda la app
 * sin necesidad de importar este módulo en cada módulo de negocio.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
