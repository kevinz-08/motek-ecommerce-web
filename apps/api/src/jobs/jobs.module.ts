import { Module } from '@nestjs/common'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { VendeloModule } from '../vendelo/vendelo.module'
import { JobsController } from './jobs.controller'
import { CronSecretGuard } from './cron-secret.guard'

/**
 * Disparo externo de las tareas en segundo plano (Cloud Scheduler).
 * Reutiliza las instancias exportadas por InfrastructureModule y VendeloModule:
 * redeclararlas aquí crearía copias con sus propios timers.
 */
@Module({
  imports: [InfrastructureModule, VendeloModule],
  controllers: [JobsController],
  providers: [CronSecretGuard],
})
export class JobsModule {}
