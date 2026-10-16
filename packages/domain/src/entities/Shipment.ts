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

/**
 * Estado fino de seguimiento reportado por la transportadora vía Vendelo
 * (`ApiOrderShipment.tracking_status`). Más granular que ShipmentStatus — es
 * informativo para el cliente y no gobierna transiciones de estado.
 */
export type TrackingStatus =
  | 'IN-ORIGIN'
  | 'IN-DESTINATION'
  | 'OUT-FOR-DELIVERY'
  | 'DELIVERED'
  | 'RETURN'
  | 'TRANSIT'
  | 'PENDING'
  | 'READY'
  | 'INCIDENT'
  | 'UNKNOWN'
  | 'AT-COLLECTION-POINT'

/** Detalle de seguimiento del envío saliente. Todos opcionales: Vendelo los llena a medida que avanza. */
export interface ShipmentTrackingDetails {
  trackingNumber?: string | null
  carrier?: string | null
  trackingStatus?: TrackingStatus | null
  deliveryAttempts?: number | null
  /** Fecha en que el envío fue entregado al destinatario. */
  deliveredAt?: Date | null
  /** Fecha de la última actualización del seguimiento según la transportadora. */
  trackingUpdatedAt?: Date | null
}

export interface Shipment {
  id: string
  orderId: string
  status: ShipmentStatus
  trackingNumber: string | null
  carrier: string | null
  labelUrl: string | null
  trackingStatus: TrackingStatus | null
  deliveryAttempts: number | null
  deliveredAt: Date | null
  trackingUpdatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
