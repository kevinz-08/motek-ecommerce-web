import { Injectable, LoggerService } from '@nestjs/common'

type LogEntry = {
  timestamp: string
  level: string
  context?: string
  message: string
  [key: string]: unknown
}

/**
 * Logger estructurado que emite cada línea como JSON a stdout/stderr.
 * Implementa LoggerService para reemplazar el logger por defecto de NestJS
 * via `app.useLogger()`. Compatible con cualquier agregador de logs (Datadog,
 * Logtail, Railway logs) que parsee JSON por línea.
 *
 * Uso: `app.useLogger(new StructuredLogger())` en main.ts.
 */
@Injectable()
export class StructuredLogger implements LoggerService {
  private emit(
    level: string,
    message: unknown,
    contextOrTrace?: string,
    context?: string,
  ): void {
    const isError = level === 'error' || level === 'fatal'

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: String(message),
    }

    if (isError) {
      // error(msg, stack, context) — stack and context are independent fields
      if (context) entry['context'] = context
      if (contextOrTrace) entry['stack'] = contextOrTrace
    } else if (contextOrTrace) {
      entry['context'] = contextOrTrace
    }

    const line = JSON.stringify(entry) + '\n'
    if (isError) {
      process.stderr.write(line)
    } else {
      process.stdout.write(line)
    }
  }

  log(message: unknown, context?: string): void {
    this.emit('info', message, context)
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.emit('error', message, trace, context)
  }

  warn(message: unknown, context?: string): void {
    this.emit('warn', message, context)
  }

  debug(message: unknown, context?: string): void {
    this.emit('debug', message, context)
  }

  verbose(message: unknown, context?: string): void {
    this.emit('verbose', message, context)
  }

  fatal(message: unknown, context?: string): void {
    this.emit('fatal', message, context)
  }
}
