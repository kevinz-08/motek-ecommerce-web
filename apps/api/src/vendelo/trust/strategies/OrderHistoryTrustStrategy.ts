import { Injectable } from '@nestjs/common'
import type { IRecipientTrustStrategy, StrategyResult } from '@motek/domain'
import type { TrustContext } from '@motek/domain'

/**
 * Criterio: historial de pedidos pagados.
 *
 * Score máximo: 50 puntos.
 * ≥3 pedidos pagados → pasa (50 pts)
 * 1–2 pedidos pagados → pasa parcial (20 pts)
 * 0 pedidos pagados   → falla (0 pts)
 */
@Injectable()
export class OrderHistoryTrustStrategy implements IRecipientTrustStrategy {
  readonly name = 'order-history'

  async evaluate(context: TrustContext): Promise<StrategyResult> {
    const { previousPaidOrders } = context

    if (previousPaidOrders >= 3) {
      return { score: 50, passed: true }
    }

    if (previousPaidOrders >= 1) {
      return { score: 20, passed: true }
    }

    return {
      score: 0,
      passed: false,
      reason: `Sin historial de compras previas (previousPaidOrders=${previousPaidOrders})`,
    }
  }
}
