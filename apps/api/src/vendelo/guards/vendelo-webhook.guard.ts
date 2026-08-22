import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { timingSafeEqual } from 'crypto'
import type { Request } from 'express'

/**
 * Guard para el webhook del Chatbot Connection de Vendelo.
 *
 * **Por qué validamos vía metadata y no HMAC:**
 * Soporte de Venndelo confirmó (jun 2026) que aún no firman las llamadas del
 * Chatbot Connection. Su alternativa oficial es usar el campo `metadata` que
 * el comercio envía al crear la conexión — Venndelo lo incluye en cada
 * webhook tal cual lo registramos. Lo usamos como secreto compartido:
 *
 *   1. Al registrar la conexión (`POST /v1/admin/chatbot/connections`)
 *      enviamos `metadata: [{ "motek_webhook_secret": <VENDELO_WEBHOOK_SECRET> }]`
 *   2. Cada webhook que nos manda Venndelo trae ese metadata.
 *   3. Este guard valida `metadata[].motek_webhook_secret === VENDELO_WEBHOOK_SECRET`
 *      con comparación timing-safe.
 *
 * Limitación: el secreto viaja en claro dentro del JSON (HTTPS lo protege en
 * tránsito). Si Venndelo agrega firma real en el futuro, migramos a HMAC.
 *
 * En dev (NODE_ENV !== 'production') con secret vacío, el guard deja pasar
 * con warning para facilitar testing local.
 */

/** Key dentro del array `metadata` que contiene nuestro secreto compartido */
const METADATA_SECRET_KEY = 'motek_webhook_secret'

interface VendeloMetadataItem {
  [key: string]: unknown
}

interface VendeloWebhookBody {
  metadata?: VendeloMetadataItem[]
  // Algunos proveedores anidan metadata bajo data — soportamos ambos
  data?: { metadata?: VendeloMetadataItem[] }
}

@Injectable()
export class VendeloWebhookGuard implements CanActivate {
  private readonly logger = new Logger(VendeloWebhookGuard.name)
  private readonly secret: string
  private readonly isProd: boolean

  constructor() {
    this.secret = process.env['VENDELO_WEBHOOK_SECRET'] ?? ''
    this.isProd = process.env['NODE_ENV'] === 'production'
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.secret) {
      if (this.isProd) {
        this.logger.error('[VendeloWebhookGuard] VENDELO_WEBHOOK_SECRET no configurado en producción')
        throw new UnauthorizedException('Webhook secret no configurado')
      }
      this.logger.warn('[VendeloWebhookGuard] VENDELO_WEBHOOK_SECRET vacío — permitiendo en dev')
      return true
    }

    const req = context.switchToHttp().getRequest<Request>()
    const body = (req.body ?? {}) as VendeloWebhookBody

    const provided = this.extractSecret(body)

    if (!provided) {
      this.logger.warn(
        '[VendeloWebhookGuard] Webhook rechazado — falta metadata.motek_webhook_secret. ' +
        'Verifica que la conexión Chatbot quedó registrada con el metadata correcto.',
      )
      throw new UnauthorizedException('Metadata de webhook ausente')
    }

    if (!this.timingSafeStringEquals(provided, this.secret)) {
      this.logger.warn('[VendeloWebhookGuard] Webhook rechazado — secret en metadata no coincide')
      throw new UnauthorizedException('Secret de webhook inválido')
    }

    return true
  }

  /**
   * Busca `motek_webhook_secret` en el array `metadata` del payload.
   * Soporta dos ubicaciones porque la doc de Venndelo no es explícita:
   *   - root.metadata[]
   *   - root.data.metadata[]
   */
  private extractSecret(body: VendeloWebhookBody): string | null {
    const candidates: VendeloMetadataItem[] = [
      ...(body.metadata ?? []),
      ...(body.data?.metadata ?? []),
    ]

    for (const item of candidates) {
      const value = item?.[METADATA_SECRET_KEY]
      if (typeof value === 'string' && value.length > 0) return value
    }
    return null
  }

  /**
   * Comparación timing-safe de strings — previene timing attacks de fuerza bruta
   * sobre el secreto. timingSafeEqual exige longitudes iguales, así que primero
   * normalizamos al mismo tamaño con un secreto bogus si difieren.
   */
  private timingSafeStringEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a)
    const bBuf = Buffer.from(b)
    if (aBuf.length !== bBuf.length) {
      // Aún hacemos una comparación timing-safe para no leakear longitud
      timingSafeEqual(aBuf, Buffer.alloc(aBuf.length))
      return false
    }
    return timingSafeEqual(aBuf, bBuf)
  }
}
