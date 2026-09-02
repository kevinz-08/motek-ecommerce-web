import type { Metadata } from 'next'
import { prisma } from '@/infrastructure/database/prisma-client'
import {
  CouponManager,
  type CouponRow,
  type CategoryOption,
  type ProductOption,
} from '@/components/admin/CouponManager'

export const metadata: Metadata = { title: 'Cupones' }

export default async function AdminCuponesPage() {
  const [couponRows, categoryRows, productRows] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.category.findMany({ orderBy: [{ parentId: 'asc' }, { name: 'asc' }], select: { id: true, name: true, parentId: true } }),
    prisma.product.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const coupons: CouponRow[] = couponRows.map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type as CouponRow['type'],
    value: c.value,
    restriction: c.restriction as CouponRow['restriction'],
    isActive: c.isActive,
    expiresAt: c.expiresAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    categoryId: c.categoryId,
    productId: c.productId,
  }))

  const categories: CategoryOption[] = categoryRows.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
  }))

  const products: ProductOption[] = productRows.map((p) => ({
    id: p.id,
    name: p.name,
  }))

  return <CouponManager initialCoupons={coupons} categories={categories} products={products} />
}
