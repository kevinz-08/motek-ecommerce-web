/**
 * Helper compartido por los route handlers de `/api/admin/vendelo/*`.
 *
 * Estos handlers son un BFF delgado: el navegador no puede hablar con NestJS
 * directamente porque el `accessToken` de ADMIN vive en la sesión de NextAuth
 * (cookie httpOnly), no en el cliente. Cada handler valida el rol y reenvía la
 * llamada al endpoint equivalente de `/admin/vendelo/*`, que a su vez está
 * protegido por `@Roles('ADMIN')` en NestJS (defensa en profundidad).
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Guarded = { ok: true; accessToken: string } | { ok: false; response: NextResponse }

/** Corta la petición con 403 si el llamante no es ADMIN. */
export async function requireAdmin(): Promise<Guarded> {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, accessToken: session.user.accessToken ?? '' }
}

/**
 * Reenvía a NestJS y devuelve la respuesta JSON tal cual, preservando el status.
 * Los errores upstream se normalizan a `{ error: string }` para que la UI
 * siempre tenga un mensaje que mostrar — incluido el `lastError` crudo de Vendelo.
 */
export async function proxyJson(
  path: string,
  accessToken: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<NextResponse> {
  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo conectar con la API. Verifica que el servicio esté disponible.' },
      { status: 502 },
    )
  }

  const data = (await upstream.json().catch(() => ({}))) as { message?: string; error?: string }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: data.message ?? data.error ?? `Error ${upstream.status}` },
      { status: upstream.status },
    )
  }

  return NextResponse.json(data, { status: upstream.status })
}

export { API_BASE }
