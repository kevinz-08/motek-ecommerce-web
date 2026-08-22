import { Injectable, Inject, Logger } from '@nestjs/common'
import type { IRecipientTrustStrategy, TrustContext, TrustEvaluation } from '@motek/domain'
import { scoreToLevel } from '@motek/domain'
import { RECIPIENT_TRUST_STRATEGIES } from '../../infrastructure/injection-tokens'

/**
 * Agrega todos los strategies de confianza registrados y produce una TrustEvaluation.
 *
 * Para añadir un nuevo criterio:
 *   1. Crear una clase que implemente IRecipientTrustStrategy
 *   2. Añadirla al factory de RECIPIENT_TRUST_STRATEGIES en infrastructure.module.ts
 *   Este evaluador no necesita modificaciones.
 */
@Injectable()
export class RecipientTrustEvaluator {
  private readonly logger = new Logger(RecipientTrustEvaluator.name)

  constructor(
    @Inject(RECIPIENT_TRUST_STRATEGIES)
    private readonly strategies: IRecipientTrustStrategy[],
  ) {}

  async evaluate(context: TrustContext): Promise<TrustEvaluation> {
    const results = await Promise.all(
      this.strategies.map((s) => s.evaluate(context).then((r) => ({ name: s.name, ...r }))),
    )

    const score = results.reduce((acc, r) => acc + r.score, 0)
    const reasons = results.filter((r) => !r.passed && r.reason).map((r) => r.reason as string)
    const level = scoreToLevel(score)

    this.logger.debug(
      `Trust evaluation userId=${context.userId} score=${score} level=${level} failures=${reasons.length}`,
    )

    return { score, level, reasons }
  }
}
