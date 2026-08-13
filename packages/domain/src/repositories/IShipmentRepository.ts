import { Shipment, ShipmentStatus } from '@/domain/entities/Shipment'

export interface ShipmentUpdateFields {
  status: ShipmentStatus
  trackingNumber?: string | null
  carrier?: string | null
  labelUrl?: string | null
}

export interface AtomicStatusUpdateResult {
  /** true si este llamado aplicó el cambio. false si otro proceso llegó primero (idempotencia). */
  applied: boolean
}

/**
 * Contrato de acceso a datos de envíos.
 * Implementado por PrismaShipmentRepository en infrastructure/repositories/.
 */
export interface IShipmentRepository {
  /** Busca el envío asociado a un pedido interno. Retorna null si no existe aún. */
  findByOrderId(orderId: string): Promise<Shipment | null>

  /**
   * Crea el registro de envío si no existe, o lo actualiza si existe.
   * Se llama desde SyncShipmentStatus después de validar que el cambio es progresivo.
   */
  upsert(orderId: string, fields: ShipmentUpdateFields): Promise<Shipment>

  /**
   * Actualización atómica de status con guard de idempotencia.
   *
   * Ejecuta:
   *   UPDATE "Shipment"
   *   SET status = $to, tracking_number = ..., updated_at = now()
   *   WHERE order_id = $orderId AND status = $from
   *
   * Si rowsAffected === 0 → otro worker ya aplicó el cambio → applied: false.
   * Mismo patrón que IOrderRepository.transitionFromPending().
   */
  atomicUpdateStatus(
    orderId: string,
    from: ShipmentStatus,
    to: ShipmentStatus,
    extra?: Pick<ShipmentUpdateFields, 'trackingNumber' | 'carrier' | 'labelUrl'>,
  ): Promise<AtomicStatusUpdateResult>
}
