import { Injectable } from '@nestjs/common'
import {
  IStockSyncRepository,
  StockSyncUpdate,
  Product,
  normalizeProductName,
} from '@motek/domain'
import { PrismaService } from '../database/prisma.service'

// ── Row mapper ────────────────────────────────────────────────────────────────

type PrismaRow = {
  id: string; name: string; slug: string; description: string
  price: number; compareAtPrice: number | null; stock: number; sku: string; images: string[]
  isActive: boolean; categoryId: string; createdAt: Date; updatedAt: Date
  weightKg: number | null; heightCm: number | null; widthCm: number | null; lengthCm: number | null
}

function toDomain(p: PrismaRow): Product {
  return {
    id: p.id, name: p.name, slug: p.slug, description: p.description,
    price: p.price, compareAtPrice: p.compareAtPrice, stock: p.stock, sku: p.sku, images: p.images,
    isActive: p.isActive, categoryId: p.categoryId,
    weightKg: p.weightKg, heightCm: p.heightCm, widthCm: p.widthCm, lengthCm: p.lengthCm,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  }
}

// ── Repository ────────────────────────────────────────────────────────────────

@Injectable()
export class PrismaStockSyncRepository implements IStockSyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySkus(skus: string[]): Promise<Map<string, Product>> {
    if (skus.length === 0) return new Map()

    const rows = await this.prisma.client.product.findMany({
      where: { sku: { in: skus }, isActive: true },
    })

    return new Map(rows.map(p => [p.sku, toDomain(p)]))
  }

  async findByNormalizedNames(normalizedNames: string[]): Promise<Map<string, Product>> {
    if (normalizedNames.length === 0) return new Map()

    // Fetch all active products and filter in memory.
    // The catalog is bounded (~750 products) so a full scan is acceptable and
    // avoids coupling to a PostgreSQL-specific unaccent extension.
    const all = await this.prisma.client.product.findMany({
      where: { isActive: true },
    })

    const targetSet = new Set(normalizedNames)
    const result = new Map<string, Product>()

    for (const row of all) {
      const key = normalizeProductName(row.name)
      if (targetSet.has(key) && !result.has(key)) {
        result.set(key, toDomain(row))
      }
    }

    return result
  }

  async bulkUpdateStockAndPrice(updates: StockSyncUpdate[]): Promise<void> {
    if (updates.length === 0) return

    // Estado actual de precios de los productos cuyo precio cambia — necesario para
    // (a) limpiar el precio ancla si el ERP lo alcanza/supera (el CHECK de BD rompería
    // toda la transacción) y (b) registrar historial.
    const priced = updates.filter((u) => u.price !== undefined)
    const current = priced.length > 0
      ? await this.prisma.client.product.findMany({
          where: { id: { in: priced.map((u) => u.productId) } },
          select: { id: true, price: true, compareAtPrice: true },
        })
      : []
    const currentById = new Map(current.map((p) => [p.id, p]))

    const productWrites = updates.map(({ productId, stock, price }) => {
      const prev = currentById.get(productId)
      const clearAnchor = price !== undefined && prev?.compareAtPrice != null && price >= prev.compareAtPrice
      return this.prisma.client.product.update({
        where: { id: productId },
        data: {
          stock,
          ...(price !== undefined && { price }),
          ...(clearAnchor && { compareAtPrice: null }),
        },
      })
    })

    const historyRows = priced.flatMap(({ productId, price }) => {
      const prev = currentById.get(productId)
      if (!prev || price === undefined || prev.price === price) return []
      const compareAtPrice = prev.compareAtPrice != null && price < prev.compareAtPrice ? prev.compareAtPrice : null
      return [{ productId, price, compareAtPrice, source: 'ERP_SYNC' }]
    })

    await this.prisma.client.$transaction([
      ...productWrites,
      ...(historyRows.length > 0 ? [this.prisma.client.productPriceHistory.createMany({ data: historyRows })] : []),
    ])
  }
}
