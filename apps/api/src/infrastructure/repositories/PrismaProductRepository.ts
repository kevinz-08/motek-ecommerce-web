import { Injectable } from '@nestjs/common'
import {
  IProductRepository,
  PaginatedProducts,
  Product,
  ProductFilters,
  MotorcycleCompatibility,
} from '@motek/domain'
import { PrismaService } from '../database/prisma.service'

type PrismaProductRow = {
  id: string; name: string; slug: string; description: string
  price: number; stock: number; sku: string; images: string[]
  isActive: boolean; categoryId: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null
  weightKg: number | null; heightCm: number | null; widthCm: number | null; lengthCm: number | null
  compatible?: Array<{ id: string; productId: string; brand: string; model: string; year: number | null }>
  category?: { parentId: string | null } | null
}

function toDomain(p: PrismaProductRow): Product {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    stock: p.stock,
    sku: p.sku,
    images: p.images,
    isActive: p.isActive,
    weightKg: p.weightKg,
    heightCm: p.heightCm,
    widthCm: p.widthCm,
    lengthCm: p.lengthCm,
    categoryId: p.categoryId,
    parentCategoryId: p.category?.parentId ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    deletedAt: p.deletedAt,
    compatible: p.compatible?.map(
      (c): MotorcycleCompatibility => ({ id: c.id, brand: c.brand, model: c.model, year: c.year ?? 0 }),
    ),
  }
}

@Injectable()
export class PrismaProductRepository implements IProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Product | null> {
    const p = await this.prisma.client.product.findUnique({
      where: { id, deletedAt: null },
      include: { compatible: true, category: { select: { parentId: true } } },
    })
    return p ? toDomain(p) : null
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const p = await this.prisma.client.product.findUnique({
      where: { slug, deletedAt: null },
      include: { compatible: true },
    })
    return p ? toDomain(p) : null
  }

  async findBySku(sku: string): Promise<Product | null> {
    const p = await this.prisma.client.product.findUnique({
      where: { sku, deletedAt: null },
      include: { compatible: true },
    })
    return p ? toDomain(p) : null
  }

  async findAll(filters: ProductFilters): Promise<PaginatedProducts> {
    const page  = filters.page  ?? 1
    const limit = filters.limit ?? 12
    const skip  = (page - 1) * limit

    let categoryIdFilter: { in: string[] } | undefined
    if (filters.categorySlug) {
      const cat = await this.prisma.client.category.findUnique({
        where: { slug: filters.categorySlug },
        include: { children: { select: { id: true } } },
      })
      if (cat) {
        categoryIdFilter = { in: [cat.id, ...cat.children.map((c) => c.id)] }
      }
    }

    const where = {
      deletedAt: null,
      ...(!filters.includeInactive && { isActive: true }),
      ...(filters.inStock  && { stock: { gt: 0 } }),
      ...(categoryIdFilter && { categoryId: categoryIdFilter }),
      ...(filters.search && {
        OR: [
          { name:        { contains: filters.search, mode: 'insensitive' as const } },
          { description: { contains: filters.search, mode: 'insensitive' as const } },
          { sku:         { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
      ...(filters.minPrice !== undefined && { price: { gte: filters.minPrice } }),
      ...(filters.maxPrice !== undefined && { price: { lte: filters.maxPrice } }),
      ...(filters.motorcycleBrand && {
        compatible: {
          some: {
            brand: { equals: filters.motorcycleBrand, mode: 'insensitive' as const },
            ...(filters.motorcycleModel && { model: { equals: filters.motorcycleModel, mode: 'insensitive' as const } }),
          },
        },
      }),
    }

    const [items, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where, include: { compatible: true }, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.product.count({ where }),
    ])

    return { items: items.map(toDomain), total, page, limit }
  }

  async findLowStock(threshold: number): Promise<Product[]> {
    const items = await this.prisma.client.product.findMany({
      where: { stock: { lte: threshold }, isActive: true, deletedAt: null },
      include: { compatible: true },
      orderBy: { stock: 'asc' },
    })
    return items.map(toDomain)
  }

  async save(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const p = await this.prisma.client.product.create({
      data: {
        name: data.name, slug: data.slug, description: data.description,
        price: data.price, stock: data.stock, sku: data.sku,
        images: data.images, isActive: data.isActive, categoryId: data.categoryId,
        weightKg: data.weightKg ?? null, heightCm: data.heightCm ?? null,
        widthCm: data.widthCm ?? null, lengthCm: data.lengthCm ?? null,
        compatible: data.compatible
          ? { create: data.compatible.map(({ id: _id, ...c }) => c) }
          : undefined,
      },
      include: { compatible: true },
    })
    return toDomain(p)
  }

  async update(id: string, data: Partial<Product>): Promise<Product> {
    const p = await this.prisma.client.product.update({
      where: { id },
      data: {
        ...(data.name        !== undefined && { name:        data.name }),
        ...(data.slug        !== undefined && { slug:        data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.price       !== undefined && { price:       data.price }),
        ...(data.stock       !== undefined && { stock:       data.stock }),
        ...(data.sku         !== undefined && { sku:         data.sku }),
        ...(data.images      !== undefined && { images:      data.images }),
        ...(data.isActive    !== undefined && { isActive:    data.isActive }),
        ...(data.weightKg    !== undefined && { weightKg:    data.weightKg }),
        ...(data.heightCm    !== undefined && { heightCm:    data.heightCm }),
        ...(data.widthCm     !== undefined && { widthCm:     data.widthCm }),
        ...(data.lengthCm    !== undefined && { lengthCm:    data.lengthCm }),
        ...(data.categoryId  !== undefined && { categoryId:  data.categoryId }),
        ...(data.compatible !== undefined && {
          // Reemplaza la lista completa — mismo patrón que benefits/compatibility de ProductDescription.
          compatible: {
            deleteMany: {},
            create: data.compatible.map(({ id: _id, ...c }) => c),
          },
        }),
      },
      include: { compatible: true },
    })
    return toDomain(p)
  }

  async updateStock(id: string, newStock: number): Promise<void> {
    await this.prisma.client.product.update({ where: { id }, data: { stock: newStock } })
  }

  async decrementStock(id: string, by: number): Promise<void> {
    await this.prisma.client.product.update({ where: { id }, data: { stock: { decrement: by } } })
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.product.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async restore(id: string): Promise<void> {
    await this.prisma.client.product.update({ where: { id }, data: { deletedAt: null } })
  }

  async findDeleted(): Promise<Product[]> {
    const items = await this.prisma.client.product.findMany({
      where: { deletedAt: { not: null } },
      include: { compatible: true },
      orderBy: { deletedAt: 'desc' },
    })
    return items.map(toDomain)
  }
}
