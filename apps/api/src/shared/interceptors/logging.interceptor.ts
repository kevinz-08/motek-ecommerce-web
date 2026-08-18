import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import type { Request, Response } from 'express'

type RequestWithUser = Request & { user?: { id?: string } }

/**
 * Interceptor global que loguea cada request HTTP al completarse.
 *
 * Formato de salida (via StructuredLogger → JSON):
 *   { level: "info", context: "HTTP", message: "GET /catalogo 200 +45ms", userId: "..." }
 *
 * Errores NO se loguean aquí — se delegan al HttpExceptionFilter para evitar
 * duplicados. El interceptor solo actúa en el camino de respuesta exitosa.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithUser>()
    const { method, url } = req
    const userId = req.user?.id
    const startAt = Date.now()

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>()
          const ms = Date.now() - startAt
          const msg = `${method} ${url} ${res.statusCode} +${ms}ms${userId ? ` uid=${userId}` : ''}`
          this.logger.log(msg)
        },
        // Errors are handled and logged by HttpExceptionFilter — no duplicate here
      }),
    )
  }
}
