import type { TrustContext } from '../entities/RecipientTrust'

export interface StrategyResult {
  /** Puntos que este criterio aporta al score total */
  score: number
  passed: boolean
  /** Descripción del motivo de fallo — se agrega a TrustEvaluation.reasons solo si !passed */
  reason?: string
}

/**
 * Contrato para estrategias de evaluación de confianza del destinatario.
 *
 * Cada criterio de confianza (historial, teléfono, dirección, etc.) implementa
 * esta interfaz. El evaluador agrega todas las estrategias registradas sin conocer
 * sus detalles. Para añadir un nuevo criterio: crear una clase que implemente
 * esta interfaz y registrarla en el factory de RECIPIENT_TRUST_STRATEGIES.
 */
export interface IRecipientTrustStrategy {
  readonly name: string
  evaluate(context: TrustContext): Promise<StrategyResult>
}
