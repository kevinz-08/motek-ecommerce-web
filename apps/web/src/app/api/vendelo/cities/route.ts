import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@motek/database'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) {
    return NextResponse.json([])
  }

  const cities = await prisma.vendeloCity.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    select: { code: true, name: true, subdivisionCode: true },
    orderBy: { name: 'asc' },
    take: 10,
  })

  return NextResponse.json(cities)
}
