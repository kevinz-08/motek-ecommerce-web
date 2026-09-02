import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
