import { Injectable } from '@nestjs/common'
import { IProductDescriptionRepository, ProductDescription, UpsertDescriptionInput } from '@motek/domain'
import { PrismaService } from '../database/prisma.service'

type PrismaDescRow = {
  id: string
  productId: string
  generalDescription: string | null
  createdAt: Date
  updatedAt: Date
  benefits: Array<{ id: string; title: string | null; body: string; order: number }>
  compatibility: Array<{ id: string; body: string; order: number }>
}

function toDomain(row: PrismaDescRow): ProductDescription {
  return {
    id: row.id,
    productId: row.productId,
    generalDescription: row.generalDescription ?? undefined,
    benefits: row.benefits
      .sort((a, b) => a.order - b.order)
      .map((b) => ({
        id: b.id,
        title: b.title ?? undefined,
        body: b.body,
        order: b.order,
      })),
    compatibility: row.compatibility
      .sort((a, b) => a.order - b.order)
      .map((c) => ({
        id: c.id,
        body: c.body,
        order: c.order,
      })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

@Injectable()
export class PrismaProductDescriptionRepository implements IProductDescriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProductId(productId: string): Promise<ProductDescription | null> {
    const row = await this.prisma.client.productDescription.findUnique({
      where: { productId },
      include: { benefits: true, compatibility: true },
    })
    return row ? toDomain(row) : null
  }

  async upsert(input: UpsertDescriptionInput): Promise<ProductDescription> {
    const row = await this.prisma.client.$transaction(async (tx) => {
      const desc = await tx.productDescription.upsert({
        where: { productId: input.productId },
        create: {
          productId: input.productId,
          generalDescription: input.generalDescription ?? null,
        },
        update: {
          generalDescription: input.generalDescription ?? null,
        },
        select: { id: true },
      })

      // Reemplazar beneficios y compatibilidad completos — listas pequeñas
      // (max 10 y 30 respectivamente), delete+recreate es más simple que diff
      await tx.productBenefit.deleteMany({ where: { descriptionId: desc.id } })
      await tx.productCompatibilityItem.deleteMany({ where: { descriptionId: desc.id } })

      if (input.benefits.length > 0) {
        await tx.productBenefit.createMany({
          data: input.benefits.map((b) => ({
            descriptionId: desc.id,
            title: b.title ?? null,
            body: b.body,
            order: b.order,
          })),
        })
      }

      if (input.compatibility.length > 0) {
        await tx.productCompatibilityItem.createMany({
          data: input.compatibility.map((c) => ({
            descriptionId: desc.id,
            body: c.body,
            order: c.order,
          })),
        })
      }

      return tx.productDescription.findUniqueOrThrow({
        where: { id: desc.id },
        include: { benefits: true, compatibility: true },
      })
    })

    return toDomain(row)
  }
}
