/** Cobertura de Vendelo para una ciudad de destino. */
export interface CityCoverage {
  /** SUSPENDED = Vendelo no recibe pedidos hacia esa ciudad temporalmente. */
  serviceStatus: 'ACTIVE' | 'SUSPENDED'
  /** Mensaje de Vendelo para mostrar al cliente cuando está suspendida. */
  unavailableMessage: string | null
}

/**
 * Consulta de cobertura de envío por ciudad (catálogo sincronizado desde
 * Vendelo con POST /admin/vendelo/sync-cities). Implementado con Prisma sobre
 * la tabla VendeloCity.
 */
export interface ICityCoverageRepository {
  /**
   * @returns null si la ciudad no está en el catálogo local — el caller NO debe
   *          bloquear por eso (el catálogo puede estar vacío o desactualizado).
   */
  findByCityCode(cityCode: string): Promise<CityCoverage | null>
}

/** Mensaje para el cliente cuando la ciudad de destino está suspendida. */
export function shippingSuspendedMessage(vendeloMessage: string | null): string {
  return vendeloMessage?.trim() || 'Por el momento no realizamos entregas en esta ciudad.'
}
