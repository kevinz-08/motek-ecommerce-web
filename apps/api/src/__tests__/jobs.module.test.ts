import { describe, it, expect, vi } from 'vitest'

vi.mock('@motek/database', () => ({
  prisma: { $connect: vi.fn(), $disconnect: vi.fn() },
  PrismaClient: vi.fn(),
}))

import { Test } from '@nestjs/testing'
import { JobsModule } from '../jobs/jobs.module'
import { JobsController } from '../jobs/jobs.controller'

/**
 * Cableado de DI: JobsModule debe obtener las MISMAS instancias que exportan
 * InfrastructureModule y VendeloModule. Si falta un export, Nest falla al
 * compilar el módulo — este test lo detecta sin levantar la API.
 */
describe('JobsModule — inyección de dependencias', () => {
  it('resuelve JobsController con todas las tareas', async () => {
    process.env['RESEND_API_KEY'] ??= 're_test_placeholder'
    const moduleRef = await Test.createTestingModule({ imports: [JobsModule] }).compile()

    expect(moduleRef.get(JobsController)).toBeInstanceOf(JobsController)
    await moduleRef.close()
  })
})
