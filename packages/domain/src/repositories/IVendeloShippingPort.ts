import { ShipmentExceptionDetail, ExceptionResolution } from '../entities/ShipmentException'
import { ShipmentStatus } from '../entities/Shipment'

/** Error reportado cuando Vendelo no encuentra el pedido solicitado por ID. */
export class VendeloOrderNotFoundError extends Error {
  constructor(public readonly vendeloOrderId: string) {
    super(`Vendelo order "${vendeloOrderId}" not found`)
    this.name = 'VendeloOrderNotFoundError'
  }
}

/**
 * Snapshot mínimo del pedido en Vendelo que el polling necesita:
 * estado del pedido + datos del shipment para reflejarlos en nuestra BD.
 *
 * Vendelo usa los mismos identificadores de estado que nuestro enum
 * `ShipmentStatus`, por lo que el mapeo es 1:1.
 */
export interface VendeloOrderSnapshot {
  id: string
  status: ShipmentStatus
  trackingNumber: string | null
  carrier: string | null
}

/**
 * Insumo para cotizar el envío de un pedido antes de que el cliente pague.
 * Vendelo es quien cobra el envío al cliente (no nuestro Wompi) — esto es
 * puramente informativo para que el cliente no se sorprenda al recibir el pedido.
 */
export interface VendeloQuoteInput {
  /** Código DIVIPOLA de 8 dígitos del destino. Ej: "11001000" para Bogotá. */
  shippingCityCode: string
  /** Código de subdivisión de 2 dígitos. Ej: "11" */
  shippingSubdivisionCode: string
  /**
   * Ítems a cotizar. weightKg/heightCm/widthCm/lengthCm son el peso/dimensiones
   * reales del producto (cargados por el admin) — si vienen null/undefined,
   * VendeloService cae a los defaults configurados (VENDELO_DEFAULT_*).
   */
  items: Array<{
    productId: string
    quantity: number
    weightKg?: number | null
    heightCm?: number | null
    widthCm?: number | null
    lengthCm?: number | null
  }>
  paymentMethod: 'COD' | 'EXTERNAL_PAYMENT'
}

/** Resultado de la cotización — montos en centavos COP. */
export interface VendeloQuoteResult {
  /** Lo que cobra Vendelo por el envío. */
  quotedShippingTotal: number
  /**
   * Lo que asumiría el comprador en pagos COD (contra entrega). Siempre 0 para
   * EXTERNAL_PAYMENT (nuestro único flujo hoy vía Wompi) — ver nota en VendeloService.quoteOrder.
   */
  assumedShippingTotal: number
}

/**
 * Puerto de dominio para las operaciones de envío logístico con Vendelo.
 *
 * Implementado por VendeloService en apps/api/src/infrastructure/services/.
 * El dominio no conoce HTTP ni NestJS — solo este contrato.
 */
export interface IVendeloShippingPort {
  /**
   * Dispara la creación asincrónica de envíos en Vendelo.
   * Debe llamarse con los IDs de Vendelo (vendeloOrderId), no los IDs internos.
   */
  createShipments(vendeloOrderIds: string[]): Promise<{ message: string }>

  /** Obtiene el detalle de una novedad de transporte por su ID de Vendelo. */
  getException(id: string): Promise<ShipmentExceptionDetail>

  /** Resuelve una novedad de transporte con el tipo de respuesta y notas indicadas. */
  resolveException(id: string, resolution: ExceptionResolution): Promise<{ message: string }>

  /**
   * Lee el estado actual de un pedido desde Vendelo. Usado por el cron de
   * polling para sincronizar el envío cuando los webhooks no están disponibles.
   *
   * @throws {VendeloOrderNotFoundError} si Vendelo retorna 404 — el caller
   *         debe loguear y continuar con el siguiente pedido, no fallar el batch.
   */
  getOrder(vendeloOrderId: string): Promise<VendeloOrderSnapshot>

  /**
   * Cotiza el costo de envío de un pedido sin crearlo. Usado por QuoteShipping
   * para informar al cliente el estimado antes de pagar (carrito/checkout).
   */
  quoteOrder(input: VendeloQuoteInput): Promise<VendeloQuoteResult>
}
