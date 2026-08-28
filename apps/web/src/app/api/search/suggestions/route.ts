import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@motek/database'
import { detectCategorySlugs, extractSearchWords } from '@/lib/search'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''

const TRANSFORMS = 'f_auto,q_auto,w_200,c_limit'

function toImageUrl(publicIdOrUrl: string | undefined): string | null {
  if (!publicIdOrUrl) return null
  if (publicIdOrUrl.startsWith('http')) {
    // Inyectar transformaciones si ya es URL de Cloudinary
    const match = publicIdOrUrl.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)/)
    if (match) return `${match[1]}${TRANSFORMS}/${publicIdOrUrl.slice(match[1].length).replace(/^[^v][^/]*\//, '')}`
    return publicIdOrUrl
  }
  if (!CLOUD_NAME) return null
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${TRANSFORMS}/${publicIdOrUrl}`
}

function toCOP(cents: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(cents / 100)
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const words = extractSearchWords(q)
  const matchedSlugs = detectCategorySlugs(q)
  const searchWords = words.filter((w) => !matchedSlugs.includes(w))

  const where: Record<string, unknown> = { isActive: true }

  const wordConditions: Record<string, unknown>[] = []
  if (searchWords.length > 0) {
    for (const word of searchWords) {
      wordConditions.push({
        OR: [
          { name: { contains: word, mode: 'insensitive' } },
          { description: { contains: word, mode: 'insensitive' } },
          { sku: { contains: word, mode: 'insensitive' } },
        ],
      })
    }
  }

  if (matchedSlugs.length > 0) {
    const cats = await prisma.category.findMany({
      where: { slug: { in: matchedSlugs } },
      include: { children: { select: { id: true } } },
    })
    const ids = cats.flatMap((c) => [c.id, ...c.children.map((ch) => ch.id)])
    if (ids.length > 0) {
      if (wordConditions.length > 0) {
        where.AND = [{ categoryId: { in: ids } }, ...wordConditions]
      } else {
        where.categoryId = { in: ids }
      }
    } else if (wordConditions.length > 0) {
      if (wordConditions.length === 1) {
        where.OR = (wordConditions[0] as { OR: Record<string, unknown>[] }).OR
      } else {
        where.AND = wordConditions
      }
    }
  } else if (wordConditions.length > 0) {
    if (wordConditions.length === 1) {
      where.OR = (wordConditions[0] as { OR: Record<string, unknown>[] }).OR
    } else {
      where.AND = wordConditions
    }
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      images: true,
      stock: true,
      category: { select: { name: true, slug: true } },
    },
    take: 6,
    orderBy: { stock: 'desc' },
  })

  const results = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    priceLabel: toCOP(p.price),
    image: toImageUrl(p.images[0]),
    stock: p.stock,
    categoryName: p.category?.name ?? null,
    categorySlug: p.category?.slug ?? null,
  }))

  return NextResponse.json({ results })
}
