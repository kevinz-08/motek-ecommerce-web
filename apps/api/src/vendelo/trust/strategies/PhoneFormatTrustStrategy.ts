import { Injectable } from '@nestjs/common'
import type { IRecipientTrustStrategy, StrategyResult } from '@motek/domain'
import type { TrustContext } from '@motek/domain'

/** Teléfonos móviles colombianos: 10 dígitos que empiezan por 3 */
const COLOMBIAN_MOBILE_RE = /^3\d{9}$/

/**
 * Criterio: formato de teléfono móvil colombiano válido.
 *
 * Score máximo: 20 puntos.
 * Teléfono válido (10 dígitos, empieza por 3) → pasa (20 pts)
 * Teléfono inválido → falla (0 pts)
 */
@Injectable()
export class PhoneFormatTrustStrategy implements IRecipientTrustStrategy {
  readonly name = 'phone-format'

  async evaluate(context: TrustContext): Promise<StrategyResult> {
    const cleaned = context.phone.replace(/\D/g, '')

    if (COLOMBIAN_MOBILE_RE.test(cleaned)) {
      return { score: 20, passed: true }
    }

    return {
      score: 0,
      passed: false,
      reason: `Teléfono con formato inválido: "${context.phone}"`,
    }
  }
}
