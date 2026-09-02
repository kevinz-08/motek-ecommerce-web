import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

/**
 * Endpoint interno de revalidación de caché.
 * Solo acepta peticiones del API NestJS con el header x-internal-secret correcto.
 * Usado por el webhook controller de Vendelo para invalidar la caché de pedidos
 * cuando cambia el estado de un envío.
 *
 * POST /api/internal/revalidate
 * Headers: x-internal-secret: <INTERNAL_API_SECRET>
 * Body: { tags: string[] }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  const expected = process.env['INTERNAL_API_SECRET']

  if (!secret || !expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { tags?: unknown }
  if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== 'string')) {
    return NextResponse.json({ error: 'tags must be a string[]' }, { status: 400 })
  }

  const tags = body.tags as string[]
  for (const tag of tags) {
    revalidateTag(tag, 'max')
  }

  return NextResponse.json({ revalidated: tags })
}
