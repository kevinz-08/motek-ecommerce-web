/**
 * Contrato del repositorio de pedidos.
 *
 * Implementado por PrismaOrderRepository en infrastructure/repositories/.
 * Los use cases CreateOrder y ConfirmPayment dependen de esta interfaz.
 */
import { Order, OrderStatus, OrderItem, ShippingAddress, BuyerInfo, PaymentProvider, PaymentStatus, DeliveryMethod } from '@/domain/entities/Order'
import { ShipmentStatus } from '@/domain/entities/Shipment'

/**
 * Resultado de `transitionFromPending`.
 *  - `applied: true`  → Este webhook ejecutó la transición (fue el primero en llegar).
 *  - `applied: false` → El pedido ya no estaba en PENDING; el cambio lo hizo un webhook anterior.
 *                       Esto es idempotencia: no es error, pero el caller debería evitar efectos
 *                       secundarios (ej: enviar email al cliente por segunda vez).
 */
export interface PaymentTransitionResult {
  applied: boolean
}

/**
 * Datos necesarios para crear un nuevo pedido.
 * Los items ya incluyen el priceAtPurchase (precio capturado por CreateOrder use case).
 */
export interface CreateOrderInput {
  /** ID del usuario autenticado que realiza el pedido */
  userId: string
  /** Lista de ítems con precio capturado en el momento de la compra */
  items: Array<{ productId: string; quantity: number; priceAtPurchase: number }>
  /** Dirección de envío — se serializa como JSON en la BD */
  shippingAddress: ShippingAddress
  /** Método de entrega elegido en el checkout. Ver Order.deliveryMethod. */
  deliveryMethod: DeliveryMethod
  /** Identificación tributaria del comprador (para comprobante + Vendelo). */
  buyer: BuyerInfo
  /** Pasarela de pago seleccionada */
  paymentProvider: PaymentProvider
  /** Componente de flete en centavos COP incluido en `total`. Ver Order.shippingTotal. */
  shippingTotal: number
  /** Total del pedido en centavos COP (calculado por CreateOrder use case) */
  total: number
  /** Código del cupón aplicado. null si no se usó cupón. */
  couponCode?: string
  /** Centavos COP descontados por el cupón. 0 si no se usó cupón. */
  discountAmount?: number
}

/**
 * Contrato de acceso a datos de pedidos.
 * Implementado por PrismaOrderRepository en infrastructure/repositories/.
 */
export interface IOrderRepository {
  /** Busca un pedido por ID, incluyendo items y pago (necesario para el webhook) */
  findById(id: string): Promise<Order | null>
  /** Retorna todos los pedidos de un usuario ordenados por fecha desc */
  findByUserId(userId: string): Promise<Order[]>
  /** Lista pedidos con filtros opcionales para el panel admin */
  findAll(filters?: { status?: OrderStatus; page?: number; limit?: number }): Promise<Order[]>
  /**
   * Cuenta el total de pedidos que matchean los mismos filtros de `findAll` (sin paginar).
   * Usado junto a `findAll` para calcular `totalPages` en el panel admin de pedidos.
   */
  countAll(filters?: { status?: OrderStatus }): Promise<number>
  /** Crea un pedido con sus ítems y el registro de pago en una sola transacción */
  create(input: CreateOrderInput): Promise<Order>
  /** Cambia el estado del pedido (PENDING→PAID, PAID→SHIPPED, etc.) */
  updateStatus(id: string, status: OrderStatus): Promise<void>
  /**
   * Registra el ID de transacción externo en el Payment.
   * Se llama desde ConfirmPayment cuando llega el webhook de la pasarela.
   */
  updatePaymentExternalId(orderId: string, externalId: string): Promise<void>
  /**
   * Transición atómica desde PENDING que actualiza Order.status, Payment.status,
   * Payment.externalId y, opcionalmente, el stock de los productos — todo en una
   * sola transacción de BD.
   *
   * Atomicidad garantiza:
   *   - Idempotencia correcta ante reintentos del webhook: solo el primero aplica.
   *   - Order.status y Payment.status quedan siempre consistentes.
   *   - Si se proveen `stockDecrements`, el descuento de stock y el cambio de estado
   *     son atómicos: o ambos ocurren o ninguno (no hay ventana entre ambas operaciones).
   *
   * El caller debe verificar `applied` para decidir efectos secundarios (ej: enviar email).
   */
  transitionFromPending(
    orderId: string,
    to: {
      orderStatus: OrderStatus
      paymentStatus: PaymentStatus
      externalId: string
      /** Items a descontar de stock dentro de la misma transacción (solo para APPROVED). */
      stockDecrements?: Array<{ productId: string; quantity: number }>
    },
  ): Promise<PaymentTransitionResult>
  /**
   * Verifica si un usuario ya utilizó un cupón específico en alguna orden no cancelada.
   * Usado por ValidateCoupon para la restricción ONCE_PER_CUSTOMER.
   */
  existsByCouponAndUser(couponCode: string, userId: string): Promise<boolean>
  /**
   * Verifica si un usuario tiene alguna orden en estado PAID, SHIPPED o DELIVERED.
   * Usado por ValidateCoupon para la restricción FIRST_PURCHASE.
   */
  hasApprovedOrders(userId: string): Promise<boolean>
  /** Calcula los ingresos del día (pedidos PAID creados hoy). Retorna centavos COP. */
  getTodayRevenue(): Promise<number>
  /** Cuenta pedidos con status PENDING. Para alertas en el dashboard. */
  getPendingCount(): Promise<number>
  /**
   * Resuelve en lote los vendeloOrderId de un conjunto de pedidos internos.
   * Usado por CreateShipments y GenerateLabels para mapear IDs internos → Vendelo.
   * Los pedidos no encontrados no aparecen en la respuesta.
   */
  findVendeloOrderIdsBatch(orderIds: string[]): Promise<Array<{ id: string; vendeloOrderId: string | null }>>
  /**
   * Devuelve pedidos cuyo envío está vivo en Vendelo y necesita polling.
   *
   * Filtros aplicados:
   *   - `vendeloOrderId IS NOT NULL` — solo pedidos ya enviados a Vendelo
   *   - `Order.status NOT IN ('DELIVERED', 'CANCELLED')` — ignora terminales
   *   - Si existe Shipment, `Shipment.status NOT IN ('DELIVERED', 'RETURNED', 'CANCELLED')`
   *
   * Orden de salida: `Shipment.updatedAt ASC NULLS FIRST` para que los más
   * desactualizados (o sin shipment aún) se procesen primero. Esto garantiza
   * fairness — ningún pedido se queda esperando indefinidamente.
   *
   * @param limit Máximo de pedidos a devolver en una llamada (batching).
   */
  findActiveVendeloOrders(limit: number): Promise<ActiveVendeloOrder[]>
  /**
   * Crea un pedido COD ya confirmado: Order en estado PAID, Payment en estado
   * APPROVED (provider COD, sin externalId — no hay transacción de pasarela) y
   * el stock de cada ítem descontado, todo en una sola transacción.
   *
   * A diferencia de `create()`, no hay paso de autorización online que esperar:
   * COD se confirma al momento de crear el pedido, por lo que no tiene sentido
   * dejarlo en PENDING (quedaría sujeto al cleanup de pedidos abandonados).
   */
  createPaidOrder(input: CreateOrderInput): Promise<Order>
  /**
   * Restaura el stock de cada ítem del pedido — usado cuando un envío es
   * rechazado en la puerta (Shipment.status → RETURNED/CANCELLED). El caller
   * (`SyncShipmentStatus`) garantiza que se invoque una sola vez por pedido.
   */
  restockItems(orderId: string): Promise<void>
}

/**
 * Snapshot mínimo que el poller necesita por cada pedido vivo: el ID interno,
 * el ID de Vendelo (para hacer GET), y el estado actual del envío (para
 * detectar progresión).
 */
export interface ActiveVendeloOrder {
  orderId: string
  vendeloOrderId: string
  /** null si todavía no se ha creado registro de Shipment para este pedido. */
  currentShipmentStatus: ShipmentStatus | null
}
