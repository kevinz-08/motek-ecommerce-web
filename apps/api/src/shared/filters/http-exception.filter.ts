import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import * as Sentry from '@sentry/nestjs'
import type { Request, Response } from 'express'
import { AppError } from '@motek/domain'

/** Mapeo de AppError.code del dominio a status HTTP */
const DOMAIN_ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: HttpStatus.NOT_FOUND,                      // 404
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,                 // 401
  FORBIDDEN: HttpStatus.FORBIDDEN,                       // 403
  VALIDATION_ERROR: HttpStatus.UNPROCESSABLE_ENTITY,    // 422
  CONFLICT: HttpStatus.CONFLICT,                         // 409
  STOCK_UNAVAILABLE: HttpStatus.CONFLICT,                // 409
  PAYMENT_REQUIRED: HttpStatus.PAYMENT_REQUIRED,         // 402
  PAYMENT_ERROR: HttpStatus.BAD_GATEWAY,                  // 502
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,      // 500
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    // ── AppError del dominio → HTTP con el código correcto ─────────────────────
    if (exception instanceof AppError) {
      const status = DOMAIN_ERROR_STATUS[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR

      if (status >= 500) {
        const errorId = randomUUID()
        Sentry.captureException(exception, { tags: { errorId } })
        this.logger.error(
          `[${errorId}] ${request.method} ${request.url} → [${exception.code}] ${exception.message}`,
          exception.stack,
          HttpExceptionFilter.name,
        )
        return response.status(status).json({
          statusCode: status,
          errorId,
          code: exception.code,
          message: exception.message,
          path: request.url,
          timestamp: new Date().toISOString(),
        })
      }

      return response.status(status).json({
        statusCode: status,
        code: exception.code,
        message: exception.message,
        path: request.url,
        timestamp: new Date().toISOString(),
      })
    }

    // ── HttpException de NestJS (guards, pipes, decoradores) ───────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()

      if (status >= 500) {
        const errorId = randomUUID()
        Sentry.captureException(exception, { tags: { errorId } })
        this.logger.error(
          `[${errorId}] ${request.method} ${request.url} → HTTP ${status}`,
          exception.stack,
          HttpExceptionFilter.name,
        )
        return response.status(status).json({
          statusCode: status,
          errorId,
          ...(typeof body === 'string' ? { message: body } : body),
          path: request.url,
          timestamp: new Date().toISOString(),
        })
      }

      return response.status(status).json({
        statusCode: status,
        ...(typeof body === 'string' ? { message: body } : body),
        path: request.url,
        timestamp: new Date().toISOString(),
      })
    }

    // ── Error inesperado (no manejado) ─────────────────────────────────────────
    const errorId = randomUUID()
    Sentry.captureException(exception, { tags: { errorId } })
    this.logger.error(
      `[${errorId}] ${request.method} ${request.url} → Error no manejado`,
      exception instanceof Error ? exception.stack : String(exception),
      HttpExceptionFilter.name,
    )
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorId,
      code: 'INTERNAL_ERROR',
      message: process.env['NODE_ENV'] === 'production'
        ? 'Error interno del servidor'
        : String(exception),
      path: request.url,
      timestamp: new Date().toISOString(),
    })
  }
}
