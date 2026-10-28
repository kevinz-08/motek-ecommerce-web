import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { timingSafeEqual } from 'crypto'
import type { Request } from 'express'

/** Cabecera que Cloud Scheduler envía en cada disparo. */
export const CRON_SECRET_HEADER = 'x-cron-secret'

/**
 * Protege `POST /internal/jobs/:job`. Fail-closed: sin `CRON_SECRET`
 * configurado rechaza todo — un endpoint que mueve pedidos a Vendelo no puede
 * quedar abierto por un error de configuración.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  private readonly logger = new Logger(CronSecretGuard.name)

  canActivate(context: ExecutionContext): boolean {
    const secret = process.env['CRON_SECRET'] ?? ''
    if (!secret) {
      this.logger.error('[CronSecretGuard] CRON_SECRET no configurado — disparo rechazado')
      throw new UnauthorizedException('Tareas programadas no configuradas')
    }

    const req = context.switchToHttp().getRequest<Request>()
    const provided = req.headers[CRON_SECRET_HEADER]
    if (typeof provided !== 'string' || !this.safeEquals(provided, secret)) {
      this.logger.warn('[CronSecretGuard] Disparo rechazado — secreto ausente o inválido')
      throw new UnauthorizedException('Secreto inválido')
    }
    return true
  }

  private safeEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a)
    const bBuf = Buffer.from(b)
    if (aBuf.length !== bBuf.length) {
      timingSafeEqual(aBuf, Buffer.alloc(aBuf.length))
      return false
    }
    return timingSafeEqual(aBuf, bBuf)
  }
}
