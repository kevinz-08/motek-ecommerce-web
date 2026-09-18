import { Injectable, Logger } from '@nestjs/common'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 5000

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'invalid' | 'unavailable'; detail?: string }

/**
 * Verificación de captcha con Cloudflare Turnstile.
 *
 * Se usa en el checkout de invitado, que es el único endpoint que crea
 * transacciones en la pasarela sin autenticación. Sin captcha, ese endpoint es
 * un oráculo gratuito de validación de tarjetas robadas ("card testing"): cada
 * llamada abre una transacción real en Wompi/Mercado Pago, y una tasa alta de
 * rechazos puede costar la cuenta de comercio.
 *
 * Se eligió Turnstile sobre reCAPTCHA porque es invisible en la mayoría de los
 * casos, no instala cookies de terceros (relevante para la Ley 1581/2012) y no
 * tiene costo.
 *
 * ── Política de fallos ──
 * FAIL-CLOSED en todos los casos: token ausente, token inválido, secret sin
 * configurar, o Cloudflare inalcanzable. Un control antifraude que se abre
 * cuando falla no es un control. La contrapartida es real —una caída de
 * Cloudflare bloquea el checkout de invitado— y por eso cada fallo de
 * disponibilidad se loguea a nivel error para que llegue a Sentry: es un
 * incidente, no ruido. Los usuarios autenticados nunca pasan por acá, así que
 * la tienda sigue vendiendo.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name)
  private readonly secret = process.env['TURNSTILE_SECRET_KEY'] ?? ''

  /**
   * Falso si no hay `TURNSTILE_SECRET_KEY`. El arranque de la API no se aborta
   * por esto (a diferencia de las vars de `assertEnvVars`): el resto de la
   * tienda funciona perfectamente sin captcha, solo el checkout de invitado
   * queda deshabilitado con un 503 explícito.
   */
  get isConfigured(): boolean {
    return this.secret.length > 0
  }

  /**
   * @param token   El valor de `cf-turnstile-response` que envía el widget.
   * @param remoteIp IP del cliente. Opcional pero recomendada: Cloudflare la usa
   *                 como señal adicional. En Cloud Run llega vía X-Forwarded-For
   *                 (por eso `trust proxy` en main.ts).
   */
  async verify(token: string, remoteIp?: string): Promise<TurnstileResult> {
    if (!this.isConfigured) {
      this.logger.error('[Turnstile] TURNSTILE_SECRET_KEY no configurada — checkout de invitado deshabilitado')
      return { ok: false, reason: 'not_configured' }
    }

    if (!token) {
      return { ok: false, reason: 'invalid', detail: 'missing-token' }
    }

    const body = new URLSearchParams({ secret: this.secret, response: token })
    if (remoteIp) body.set('remoteip', remoteIp)

    let payload: { success?: boolean; 'error-codes'?: string[] }
    try {
      const res = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      })
      if (!res.ok) {
        this.logger.error(`[Turnstile] siteverify respondió HTTP ${res.status}`)
        return { ok: false, reason: 'unavailable', detail: `http-${res.status}` }
      }
      payload = (await res.json()) as typeof payload
    } catch (e) {
      this.logger.error(`[Turnstile] siteverify inalcanzable: ${e}`)
      return { ok: false, reason: 'unavailable', detail: 'network' }
    }

    if (payload.success === true) return { ok: true }

    // Los error-codes son de Cloudflare, no del usuario: se loguean para
    // diagnóstico pero nunca se devuelven al cliente.
    const codes = payload['error-codes']?.join(',') ?? 'unknown'
    this.logger.warn(`[Turnstile] Token rechazado: ${codes}`)
    return { ok: false, reason: 'invalid', detail: codes }
  }
}
