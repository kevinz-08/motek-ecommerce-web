import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { CACHE_TAGS } from '@/lib/cache'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  const upstream = await fetch(`${API_BASE}/admin/products/${id}/stock`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.user.accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}))
    return NextResponse.json(data, { status: upstream.status })
  }

  revalidateTag(CACHE_TAGS.products, {})

  const data = await upstream.json()
  return NextResponse.json(data)
}
