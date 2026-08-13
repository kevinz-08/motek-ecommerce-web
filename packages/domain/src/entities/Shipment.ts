/**
 * Estados del envío, mapeados desde los eventos del Chatbot Connection de Vendelo.
 *
 * Orden de progresión (rank):
 *   PENDING=0 → READY=1 → PREPARING=2 → SHIPPED=3 → DELIVERED=4
 *                                      → INCIDENT=3 (paralelo a SHIPPED)
 *                                      → RETURNED=4 (terminal)
 *                                      → CANCELLED=-1 (terminal, siempre acepta)
 *
 * La transición es unidireccional: solo se avanza, nunca retrocede.
 * Dos webhooks concurrentes con el mismo evento no pueden aplicar dos veces
 * el mismo cambio gracias a la escritura atómica en IShipmentRepository.
 */
export type ShipmentStatus =
  | 'PENDING'
  | 'READY'
  | 'PREPARING'
  | 'SHIPPED'
  | 'INCIDENT'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED'

/** Rank numérico para detectar retrocesos. -1 = terminal especial (CANCELLED). */
export const SHIPMENT_STATUS_RANK: Record<ShipmentStatus, number> = {
  PENDING: 0,
  READY: 1,
  PREPARING: 2,
  SHIPPED: 3,
  INCIDENT: 3,
  DELIVERED: 4,
  RETURNED: 4,
  CANCELLED: -1,
}

export interface Shipment {
  id: string
  orderId: string
  status: ShipmentStatus
  trackingNumber: string | null
  carrier: string | null
  labelUrl: string | null
  createdAt: Date
  updatedAt: Date
}
