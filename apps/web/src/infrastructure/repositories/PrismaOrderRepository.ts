/**
 * Implementación de IOrderRepository usando Prisma 7 + PostgreSQL (Neon).
 *
 * La dirección de envío (shippingAddress) se almacena como JSON en PostgreSQL.
 * Al leer, se castea a ShippingAddress. Al escribir, a Prisma.InputJsonValue.
 * Prisma 7 no tiene conversión automática de tipos JSON — el cast es explícito y necesario.
 */
import { randomBytes } from 'node:crypto'
import {
  prisma,
  Prisma,
  type OrderModel as PrismaOrder,
  type OrderItemModel as PrismaItem,
  type PaymentModel as PrismaPayment,
} from '@motek/database'
import {
  IOrderRepository,
  CreateOrderInput,
  PaymentTransitionResult,
  ActiveVendeloOrder,
  Order,
  OrderStatus,
  ShipmentStatus,
  OrderItem,
  Payment,
  ShippingAddress,
  BuyerIdType,
  PaymentProvider,
  PaymentStatus,
  DeliveryMethod,
} from '@motek/domain'

import { buildBucketPlan, foldIntoBuckets, type RevenueRange } from './date-buckets'

/**
 * Rango del gráfico de ingresos del dashboard admin — ver `getRevenueSeries`.
 * Se define en `date-buckets` porque el bucketing lo comparten varios
 * repositorios; se reexporta aquí para no romper los imports existentes.
 */
export type { RevenueRange }

/** Mapea un ítem de Prisma a la entidad de dominio OrderItem */
function toDomainItem(i: PrismaItem): OrderItem {
  return {
    id: i.id,
    orderId: i.orderId,
    productId: i.productId,
    quantity: i.quantity,
    priceAtPurchase: i.priceAtPurchase, // centavos COP capturados al crear el pedido
  }
}

/** Mapea un pago de Prisma a la entidad de dominio Payment */
function toDomainPayment(p: PrismaPayment): Payment {
  return {
    id: p.id,
    orderId: p.orderId,
    provider: p.provider as PaymentProvider,
    externalId: p.externalId,
    status: p.status as PaymentStatus,
    amount: p.amount,
    createdAt: p.createdAt,
  }
}

/**
 * Mapea un pedido de Prisma (con ítems y pago incluidos) a la entidad de dominio Order.
 * El cast `as unknown as ShippingAddress` es necesario porque Prisma modela
 * los campos JSON como `JsonValue`, no como el tipo de dominio específico.
 */
function toDomain(
  o: PrismaOrder & { items?: PrismaItem[]; payment?: PrismaPayment | null },
): Order {
  return {
    id: o.id,
    userId: o.userId,
    guestId: o.guestId,
    contactEmail: o.contactEmail,
    trackingToken: o.trackingToken,
    status: o.status as OrderStatus,
    total: o.total,
    shippingAddress: o.shippingAddress as unknown as ShippingAddress,
    deliveryMethod: o.deliveryMethod as DeliveryMethod,
    buyer: {
      idType: o.buyerIdType as BuyerIdType,
      idNumber: o.buyerIdNumber,
      businessName: o.buyerBusinessName ?? undefined,
    },
    paymentProvider: o.paymentProvider as PaymentProvider,
    shippingTotal: o.shippingTotal,
    createdAt: o.createdAt,
    items: o.items?.map(toDomainItem),
    payment: o.payment ? toDomainPayment(o.payment) : undefined,
  }
}

/**
 * Token de seguimiento: 32 bytes criptográficos en base64url (256 bits). Es la
 * credencial con la que un invitado consulta su pedido sin sesión, así que la
 * fuerza importa tanto como la de un ID de sesión — nunca un cuid o uuid.
 */
function generateTrackingToken(): string {
  return randomBytes(32).toString('base64url')
}

type OrderOwnerData = Pick<Prisma.OrderCreateInput, 'contactEmail' | 'user' | 'guest'>

/**
 * Traduce la identidad del comprador a campos de escritura de Prisma.
 *
 * Para un invitado, el GuestCustomer se crea anidado — misma transacción que el
 * pedido, así un fallo no deja invitados huérfanos. Se usa `user: { connect }` y
 * no `userId` crudo porque Prisma no permite mezclar la forma "unchecked" (FKs a
 * mano) con la "checked" (relaciones anidadas), y la rama de invitado obliga a
 * la segunda.
 *
 * `contactEmail` se normaliza: es la clave de búsqueda de los pedidos
 * reclamables, y el comprador puede escribir "Juan@Gmail.com" en el checkout
 * y loguearse después con "juan@gmail.com".
 */
function ownerData(customer: CreateOrderInput['customer']): OrderOwnerData {
  const contactEmail = customer.email.trim().toLowerCase()

  if (customer.kind === 'user') {
    return { contactEmail, user: { connect: { id: customer.userId } } }
  }

  return {
    contactEmail,
    guest: {
      create: {
        email: contactEmail,
        name: customer.name,
        phone: customer.phone ?? null,
        marketingConsent: customer.marketingConsent ?? false,
        marketingConsentAt: customer.marketingConsent ? new Date() : null,
      },
    },
  }
}

/** Implementación de acceso a datos de pedidos con Prisma */
export class PrismaOrderRepository implements IOrderRepository {

  /** Busca un pedido por su ID, incluyendo ítems y pago (necesario para webhooks) */
  async findById(id: string): Promise<Order | null> {
    const o = await prisma.order.findUnique({
      where: { id },
      include: { items: true, payment: true },
    })
    return o ? toDomain(o) : null
  }

  /** Retorna todos los pedidos de un usuario ordenados por fecha descendente */
  async findByUserId(userId: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: { items: true, payment: true },
      orderBy: { createdAt: 'desc' },
    })
    return orders.map(toDomain)
  }

  /**
   * Lista pedidos con filtros opcionales para el panel admin.
   * Soporta filtro por estado y paginación.
   */
  async findAll(filters?: { status?: OrderStatus; page?: number; limit?: number }): Promise<Order[]> {
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 20
    const skip = (page - 1) * limit

    const orders = await prisma.order.findMany({
      where: filters?.status ? { status: filters.status } : undefined,
      include: { items: true, payment: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })
    return orders.map(toDomain)
  }

  /** Cuenta pedidos que matchean los mismos filtros que `findAll`, sin paginar. */
  async countAll(filters?: { status?: OrderStatus }): Promise<number> {
    return prisma.order.count({
      where: filters?.status ? { status: filters.status } : undefined,
    })
  }

  /**
   * Crea un pedido con sus ítems y el registro de pago en una sola transacción de Prisma.
   * El pago se crea con estado PENDING — se actualiza mediante webhook cuando la pasarela confirma.
   * La dirección de envío se serializa a JSON con el cast necesario para Prisma 7.
   */
  async create(input: CreateOrderInput): Promise<Order> {
    const o = await prisma.order.create({
      data: {
        ...ownerData(input.customer),
        trackingToken: generateTrackingToken(),
        total: input.total,
        // Cast necesario: ShippingAddress → Prisma.InputJsonValue (tipo opaco de Prisma para JSON)
        shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
        deliveryMethod: input.deliveryMethod,
        buyerIdType: input.buyer.idType,
        buyerIdNumber: input.buyer.idNumber,
        buyerBusinessName: input.buyer.businessName ?? null,
        paymentProvider: input.paymentProvider,
        shippingTotal: input.shippingTotal,
        items: {
          create: input.items, // { productId, quantity, priceAtPurchase }[]
        },
        payment: {
          create: {
            provider: input.paymentProvider,
            amount: input.total,
            // externalId queda null hasta que la pasarela confirme via webhook
          },
        },
      },
      include: { items: true, payment: true },
    })
    return toDomain(o)
  }

  /**
   * Crea un pedido COD ya confirmado (PAID + Payment APPROVED + stock descontado),
   * sin esperar ningún webhook de pasarela — ver IOrderRepository.createPaidOrder.
   */
  async createPaidOrder(input: CreateOrderInput): Promise<Order> {
    const o = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          ...ownerData(input.customer),
          trackingToken: generateTrackingToken(),
          status: 'PAID',
          total: input.total,
          shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
          deliveryMethod: input.deliveryMethod,
          buyerIdType: input.buyer.idType,
          buyerIdNumber: input.buyer.idNumber,
          buyerBusinessName: input.buyer.businessName ?? null,
          paymentProvider: input.paymentProvider,
          shippingTotal: input.shippingTotal,
          items: { create: input.items },
          payment: {
            create: { provider: input.paymentProvider, amount: input.total, status: 'APPROVED' },
          },
        },
        include: { items: true, payment: true },
      })

      for (const { productId, quantity } of input.items) {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { decrement: quantity } },
        })
      }

      return created
    })
    return toDomain(o)
  }

  /** Restaura el stock de cada ítem del pedido — ver IOrderRepository.restockItems. */
  async restockItems(orderId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId } })
      for (const { productId, quantity } of items) {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: quantity } },
        })
      }
    })
  }

  /** Actualiza el estado del pedido (PENDING → PAID → SHIPPED → DELIVERED, o CANCELLED) */
  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    await prisma.order.update({ where: { id }, data: { status } })
  }

  /**
   * Registra el ID de transacción externo en el Payment.
   * Se llama desde ConfirmPayment cuando llega el webhook de la pasarela.
   */
  async updatePaymentExternalId(orderId: string, externalId: string): Promise<void> {
    await prisma.payment.update({
      where: { orderId },
      data: { externalId },
    })
  }

  /**
   * Transición atómica PENDING → orderStatus con actualización consistente de Payment.
   *
   * La operación usa `updateMany` con `status: 'PENDING'` como condición, de modo que
   * solo el primer webhook que llegue aplica el cambio. Los reintentos posteriores
   * reciben `applied: false` (idempotencia real a nivel de BD, sin race con findById).
   *
   * Se envuelve en `$transaction` para que Order y Payment queden siempre en sincronía.
   */
  async transitionFromPending(
    orderId: string,
    to: {
      orderStatus: OrderStatus
      paymentStatus: PaymentStatus
      externalId: string
      stockDecrements?: Array<{ productId: string; quantity: number }>
    },
  ): Promise<PaymentTransitionResult> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: { status: to.orderStatus },
      })
      if (updated.count === 0) {
        return { applied: false }
      }
      await tx.payment.update({
        where: { orderId },
        data: { status: to.paymentStatus, externalId: to.externalId },
      })
      return { applied: true }
    })
  }

  /**
   * Calcula los ingresos del día actual (pedidos ya confirmados: cualquier status
   * salvo PENDING/CANCELLED — un pedido sigue "pagado" al pasar a SHIPPED/DELIVERED).
   * Retorna el total en centavos COP. Usado en el dashboard admin.
   */
  async getTodayRevenue(): Promise<number> {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // inicio del día local

    const result = await prisma.order.aggregate({
      where: {
        status: { notIn: ['PENDING', 'CANCELLED'] },
        createdAt: { gte: today },
      },
      _sum: { total: true },
    })
    return result._sum.total ?? 0
  }

  /** Cuenta pedidos con status PENDING (sin pago confirmado). Para alertas en dashboard. */
  async getPendingCount(): Promise<number> {
    return prisma.order.count({ where: { status: 'PENDING' } })
  }

  /** Ingresos del mes en curso (pedidos confirmados desde el día 1 del mes, ver getTodayRevenue). */
  async getMonthRevenue(): Promise<number> {
    const firstDay = new Date()
    firstDay.setDate(1)
    firstDay.setHours(0, 0, 0, 0)

    const result = await prisma.order.aggregate({
      where: { status: { notIn: ['PENDING', 'CANCELLED'] }, createdAt: { gte: firstDay } },
      _sum: { total: true },
    })
    return result._sum.total ?? 0
  }

  /**
   * Serie de ingresos para el gráfico del dashboard, con granularidad adaptada al rango
   * para que el gráfico se mantenga legible:
   *  - '2w' / '1m' → bucket diario (14 / 30 puntos).
   *  - '3m'        → bucket semanal (~13 puntos, semana inicia en lunes).
   *  - 'all'       → bucket mensual, desde el mes del primer pedido hasta hoy.
   * Los buckets sin pedidos se rellenan en 0 para que el área del gráfico no se corte.
   * La agrupación se hace en JS para evitar dependencia de timezone en SQL.
   */
  async getRevenueSeries(range: RevenueRange): Promise<Array<{ label: string; total: number }>> {
    // Sin `as const`: Prisma exige un arreglo mutable de estados en `notIn`.
    const confirmed = (since?: Date | null): Prisma.OrderWhereInput => ({
      status: { notIn: ['PENDING', 'CANCELLED'] },
      ...(since ? { createdAt: { gte: since } } : {}),
    })

    let earliest: Date | null = null
    if (range === 'all') {
      const agg = await prisma.order.aggregate({ where: confirmed(), _min: { createdAt: true } })
      earliest = agg._min?.createdAt ?? null
      if (!earliest) return []
    }

    const plan = buildBucketPlan(range, earliest)
    const orders = await prisma.order.findMany({
      where: confirmed(plan.since),
      select: { total: true, createdAt: true },
    })

    return foldIntoBuckets(plan, orders, (o) => o.createdAt, (o) => o.total)
  }

  /** Total de pedidos en la plataforma (todos los estados). */
  async getTotalCount(): Promise<number> {
    return prisma.order.count()
  }

  async findVendeloOrderIdsBatch(
    orderIds: string[],
  ): Promise<Array<{ id: string; vendeloOrderId: string | null }>> {
    const rows = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, vendeloOrderId: true },
    })
    return rows.map((r) => ({ id: r.id, vendeloOrderId: r.vendeloOrderId }))
  }

  /** Busca un pedido por su token de seguimiento — ver IOrderRepository.findByTrackingToken. */
  async findByTrackingToken(token: string): Promise<Order | null> {
    const o = await prisma.order.findUnique({
      where: { trackingToken: token },
      include: { items: true, payment: true },
    })
    return o ? toDomain(o) : null
  }

  /** Pedidos de invitado (userId IS NULL) con ese email — ver IOrderRepository.findUnclaimedByEmail. */
  async findUnclaimedByEmail(email: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      // `insensitive` porque los pedidos históricos heredaron el contactEmail del
      // backfill desde User.email, que puede traer mayúsculas.
      where: { contactEmail: { equals: email.trim(), mode: 'insensitive' }, userId: null },
      include: { items: true, payment: true },
      orderBy: { createdAt: 'desc' },
    })
    return orders.map(toDomain)
  }

  /** Vincula los pedidos de invitado de ese email a una cuenta — ver IOrderRepository.claimOrders. */
  async claimOrders(email: string, userId: string): Promise<number> {
    const result = await prisma.order.updateMany({
      // `userId: null` es lo que hace la operación idempotente y de un solo
      // sentido: un pedido ya vinculado nunca vuelve a entrar.
      where: { contactEmail: { equals: email.trim(), mode: 'insensitive' }, userId: null },
      // guestId a null en el mismo UPDATE para no violar el CHECK order_owner_exclusive.
      data: { userId, guestId: null },
    })
    return result.count
  }

  /** Freno anti-abuso por email — ver IOrderRepository.countPendingByEmailSince. */
  async countPendingByEmailSince(email: string, since: Date): Promise<number> {
    return prisma.order.count({
      where: {
        contactEmail: { equals: email.trim(), mode: 'insensitive' },
        status: 'PENDING',
        createdAt: { gte: since },
      },
    })
  }

  async existsByCouponAndUser(couponCode: string, userId: string): Promise<boolean> {
    const row = await prisma.order.findFirst({
      where: { couponCode, userId, status: { not: 'CANCELLED' } },
      select: { id: true },
    })
    return row !== null
  }

  async hasApprovedOrders(userId: string): Promise<boolean> {
    const row = await prisma.order.findFirst({
      where: { userId, status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } },
      select: { id: true },
    })
    return row !== null
  }

  async findActiveVendeloOrders(limit: number): Promise<ActiveVendeloOrder[]> {
    const rows = await prisma.order.findMany({
      where: {
        vendeloOrderId: { not: null },
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
        OR: [
          { shipment: null },
          { shipment: { status: { notIn: ['DELIVERED', 'RETURNED', 'CANCELLED'] } } },
        ],
      },
      select: {
        id: true,
        vendeloOrderId: true,
        shipment: { select: { status: true, updatedAt: true } },
      },
      orderBy: { shipment: { updatedAt: 'asc' } },
      take: limit,
    })

    return rows
      .filter((r): r is typeof r & { vendeloOrderId: string } => r.vendeloOrderId !== null)
      .map((r) => ({
        orderId: r.id,
        vendeloOrderId: r.vendeloOrderId,
        currentShipmentStatus: (r.shipment?.status as ShipmentStatus | undefined) ?? null,
      }))
  }
}
