import { Injectable } from '@nestjs/common'
import {
  ICouponRepository,
  CreateCouponInput,
  UpdateCouponInput,
  Coupon,
  CouponType,
  CouponRestriction,
} from '@motek/domain'
import { PrismaService } from '../database/prisma.service'

type PrismaCouponRow = {
  id: string
  code: string
  type: string
  value: number
  restriction: string
  isActive: boolean
  expiresAt: Date
  createdAt: Date
  categoryId: string | null
  productId: string | null
}

function toDomain(c: PrismaCouponRow): Coupon {
  return {
    id: c.id,
    code: c.code,
    type: c.type as CouponType,
    value: c.value,
    restriction: c.restriction as CouponRestriction,
    isActive: c.isActive,
    expiresAt: c.expiresAt,
    createdAt: c.createdAt,
    categoryId: c.categoryId,
    productId: c.productId,
  }
}

@Injectable()
export class PrismaCouponRepository implements ICouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(code: string): Promise<Coupon | null> {
    const c = await this.prisma.client.coupon.findUnique({ where: { code } })
    return c ? toDomain(c) : null
  }

  async findAll(): Promise<Coupon[]> {
    const coupons = await this.prisma.client.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return coupons.map(toDomain)
  }

  async create(data: CreateCouponInput): Promise<Coupon> {
    const c = await this.prisma.client.coupon.create({
      data: {
        code: data.code,
        type: data.type,
        value: data.value,
        restriction: data.restriction,
        expiresAt: data.expiresAt,
        categoryId: data.categoryId ?? null,
        productId: data.productId ?? null,
      },
    })
    return toDomain(c)
  }

  async update(id: string, data: UpdateCouponInput): Promise<Coupon> {
    const c = await this.prisma.client.coupon.update({
      where: { id },
      data: {
        ...(data.code        !== undefined && { code:        data.code }),
        ...(data.type        !== undefined && { type:        data.type }),
        ...(data.value       !== undefined && { value:       data.value }),
        ...(data.restriction !== undefined && { restriction: data.restriction }),
        ...(data.expiresAt   !== undefined && { expiresAt:   data.expiresAt }),
        ...(data.isActive    !== undefined && { isActive:    data.isActive }),
        // undefined = no tocar; null = limpiar el FK
        ...('categoryId' in data && { categoryId: data.categoryId ?? null }),
        ...('productId'  in data && { productId:  data.productId  ?? null }),
      },
    })
    return toDomain(c)
  }

  /** Soft delete: pone isActive = false preservando el historial de órdenes. */
  async delete(id: string): Promise<void> {
    await this.prisma.client.coupon.update({
      where: { id },
      data: { isActive: false },
    })
  }
}
