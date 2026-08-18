import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { prisma } from '@motek/database'
import type { PrismaClient } from '@motek/database'

/**
 * Servicio NestJS que expone el singleton de Prisma.
 *
 * El singleton real (con el PrismaPg adapter) vive en @motek/database.
 * Este servicio lo envuelve para integrarlo con el ciclo de vida de NestJS:
 * $connect en onModuleInit y $disconnect en onModuleDestroy.
 *
 * Marcado como @Global() en PrismaModule para no tener que importarlo
 * en cada módulo de negocio.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  readonly client: PrismaClient = prisma

  async onModuleInit() {
    await this.client.$connect()
    this.logger.log('Conexión a PostgreSQL establecida')
  }

  async onModuleDestroy() {
    await this.client.$disconnect()
    this.logger.log('Conexión a PostgreSQL cerrada')
  }
}
