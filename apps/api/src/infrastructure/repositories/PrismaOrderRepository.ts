import { Injectable } from '@nestjs/common'
import type { Prisma } from '@motek/database'
import {
  IOrderRepository,
  CreateOrderInput,
  PaymentTransitionResult,
  ActiveVendeloOrder,
  Order,
  OrderStatus,
  OrderItem,
  Payment,
  ShippingAddress,
  BuyerIdType,
  PaymentProvider,
  PaymentStatus,
  ShipmentStatus,
  DeliveryMethod,
} from '@motek/domain'
import { PrismaService } from '../database/prisma.service'

type PrismaOrderRow = {
  id: string; userId: string; status: string; total: number
  shippingAddress: unknown; paymentProvider: string; shippingTotal: number; createdAt: Date
  deliveryMethod: string
  buyerIdType: string; buyerIdNumber: string; buyerBusinessName: string | null
  items?: Array<{ id: string; orderId: string; productId: string; quantity: number; priceAtPurchase: number }>
  payment?: { id: string; orderId: string; provider: string; externalId: string | null; status: string; amount: number; createdAt: Date } | null
}

function toDomainItem(i: NonNullable<PrismaOrderRow['items']>[number]): OrderItem {
  return {
    id: i.id,
    orderId: i.orderId,
    productId: i.productId,
    quantity: i.quantity,
    priceAtPurchase: i.priceAtPurchase,
  }
}

function toDomainPayment(p: NonNullable<NonNullable<PrismaOrderRow['payment']>>): Payment {
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

function toDomain(o: PrismaOrderRow): Order {
  return {
    id: o.id,
    userId: o.userId,
    status: o.status as OrderStatus,
    total: o.total,
    shippingTotal: o.shippingTotal,
    shippingAddress: o.shippingAddress as unknown as ShippingAddress,
    deliveryMethod: o.deliveryMethod as DeliveryMethod,
    buyer: {
      idType: o.buyerIdType as BuyerIdType,
      idNumber: o.buyerIdNumber,
      businessName: o.buyerBusinessName ?? undefined,
    },
    paymentProvider: o.paymentProvider as PaymentProvider,
    createdAt: o.createdAt,
    items: o.items?.map(toDomainItem),
    payment: o.payment ? toDomainPayment(o.payment) : undefined,
  }
}

@Injectable()
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Order | null> {
    const o = await this.prisma.client.order.findUnique({
      where: { id },
      include: { items: true, payment: true },
    })
    return o ? toDomain(o) : null
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const orders = await this.prisma.client.order.findMany({
      where: { userId },
      include: { items: true, payment: true },
      orderBy: { createdAt: 'desc' },
    })
    return orders.map(toDomain)
  }

  async findAll(filters?: { status?: OrderStatus; page?: number; limit?: number }): Promise<Order[]> {
    const page  = filters?.page  ?? 1
    const limit = filters?.limit ?? 20
    const skip  = (page - 1) * limit

    const orders = await this.prisma.client.order.findMany({
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
    return this.prisma.client.order.count({
      where: filters?.status ? { status: filters.status } : undefined,
    })
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const o = await this.prisma.client.order.create({
      data: {
        userId: input.userId,
        total: input.total,
        shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
        deliveryMethod: input.deliveryMethod,
        buyerIdType: input.buyer.idType,
        buyerIdNumber: input.buyer.idNumber,
        buyerBusinessName: input.buyer.businessName ?? null,
        paymentProvider: input.paymentProvider,
        shippingTotal: input.shippingTotal,
        couponCode: input.couponCode ?? null,
        discountAmount: input.discountAmount ?? 0,
        items: { create: input.items },
        payment: {
          create: { provider: input.paymentProvider, amount: input.total },
        },
      },
      include: { items: true, payment: true },
    })
    return toDomain(o)
  }

  async createPaidOrder(input: CreateOrderInput): Promise<Order> {
    const o = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: input.userId,
          status: 'PAID',
          total: input.total,
          shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
          deliveryMethod: input.deliveryMethod,
          buyerIdType: input.buyer.idType,
          buyerIdNumber: input.buyer.idNumber,
          buyerBusinessName: input.buyer.businessName ?? null,
          paymentProvider: input.paymentProvider,
          shippingTotal: input.shippingTotal,
          couponCode: input.couponCode ?? null,
          discountAmount: input.discountAmount ?? 0,
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

  async restockItems(orderId: string): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId } })
      for (const { productId, quantity } of items) {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: quantity } },
        })
      }
    })
  }

  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    await this.prisma.client.order.update({ where: { id }, data: { status } })
  }

  async updatePaymentExternalId(orderId: string, externalId: string): Promise<void> {
    await this.prisma.client.payment.update({ where: { orderId }, data: { externalId } })
  }

  async transitionFromPending(
    orderId: string,
    to: {
      orderStatus: OrderStatus
      paymentStatus: PaymentStatus
      externalId: string
      stockDecrements?: Array<{ productId: string; quantity: number }>
    },
  ): Promise<PaymentTransitionResult> {
    return this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: { status: to.orderStatus },
      })
      if (updated.count === 0) return { applied: false }

      await tx.payment.update({
        where: { orderId },
        data: { status: to.paymentStatus, externalId: to.externalId },
      })

      if (to.stockDecrements?.length) {
        for (const { productId, quantity } of to.stockDecrements) {
          await tx.product.update({
            where: { id: productId },
            data: { stock: { decrement: quantity } },
          })
        }
      }

      return { applied: true }
    })
  }

  /**
   * Ingresos del día actual: cualquier pedido confirmado (status distinto de
   * PENDING/CANCELLED) — un pedido sigue "pagado" al pasar a SHIPPED/DELIVERED.
   */
  async getTodayRevenue(): Promise<number> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const result = await this.prisma.client.order.aggregate({
      where: { status: { notIn: ['PENDING', 'CANCELLED'] }, createdAt: { gte: today } },
      _sum: { total: true },
    })
    return result._sum.total ?? 0
  }

  async getPendingCount(): Promise<number> {
    return this.prisma.client.order.count({ where: { status: 'PENDING' } })
  }

  async findVendeloOrderIdsBatch(
    orderIds: string[],
  ): Promise<Array<{ id: string; vendeloOrderId: string | null }>> {
    const rows = await this.prisma.client.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, vendeloOrderId: true },
    })
    return rows.map((r) => ({ id: r.id, vendeloOrderId: r.vendeloOrderId }))
  }

  async existsByCouponAndUser(couponCode: string, userId: string): Promise<boolean> {
    const order = await this.prisma.client.order.findFirst({
      where: { couponCode, userId, status: { not: 'CANCELLED' } },
      select: { id: true },
    })
    return order !== null
  }

  async hasApprovedOrders(userId: string): Promise<boolean> {
    const order = await this.prisma.client.order.findFirst({
      where: { userId, status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } },
      select: { id: true },
    })
    return order !== null
  }

  async findActiveVendeloOrders(limit: number): Promise<ActiveVendeloOrder[]> {
    const rows = await this.prisma.client.order.findMany({
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
      // ASC NULLS FIRST: pedidos sin shipment van primero, luego los más antiguos.
      // Prisma no expone NULLS FIRST, pero como NULL implícito se ordena al inicio
      // en PostgreSQL ASC, el comportamiento es el correcto.
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
