export type TrustLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKED'

export interface TrustContext {
  userId: string
  email: string
  phone: string
  address: {
    street: string
    city: string
    department: string
    zip?: string
  }
  previousPaidOrders: number
}

export interface TrustEvaluation {
  /** Puntuación acumulada 0–100 de todos los strategies ejecutados */
  score: number
  /** Nivel derivado del score: ≥80 → HIGH | ≥50 → MEDIUM | ≥20 → LOW | <20 → BLOCKED */
  level: TrustLevel
  /** Razones de criterios no superados — solo para logging interno, nunca exponer al usuario */
  reasons: string[]
}

export function scoreToLevel(score: number): TrustLevel {
  if (score >= 80) return 'HIGH'
  if (score >= 50) return 'MEDIUM'
  if (score >= 20) return 'LOW'
  return 'BLOCKED'
}
