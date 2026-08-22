import { Injectable } from '@nestjs/common'
import type { IRecipientTrustStrategy, StrategyResult } from '@motek/domain'
import type { TrustContext } from '@motek/domain'

/**
 * Criterio: completitud de la dirección de envío.
 *
 * Score máximo: 30 puntos.
 * street + city + department presentes → pasa (30 pts)
 * Solo street + city → pasa parcial (15 pts)
 * Falta street o city → falla (0 pts)
 */
@Injectable()
export class AddressCompletenessTrustStrategy implements IRecipientTrustStrategy {
  readonly name = 'address-completeness'

  async evaluate(context: TrustContext): Promise<StrategyResult> {
    const { street, city, department } = context.address

    const hasStreet = street.trim().length >= 5
    const hasCity = city.trim().length >= 2
    const hasDepartment = department.trim().length >= 2

    if (hasStreet && hasCity && hasDepartment) {
      return { score: 30, passed: true }
    }

    if (hasStreet && hasCity) {
      return { score: 15, passed: true }
    }

    const missing: string[] = []
    if (!hasStreet) missing.push('calle/carrera')
    if (!hasCity) missing.push('ciudad')

    return {
      score: 0,
      passed: false,
      reason: `Dirección incompleta: falta ${missing.join(', ')}`,
    }
  }
}
