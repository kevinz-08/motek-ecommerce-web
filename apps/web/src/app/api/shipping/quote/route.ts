import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const PROXY_TIMEOUT_MS = 8_000

/**
 * Validación local — fail fast antes de pegarle a NestJS (que tiene su propio
 * class-validator + rate limit). Es una validación de forma, no de negocio:
 * el use case real (QuoteShipping) resuelve precios/stock desde la BD, este
 * endpoint nunca confía en montos del cliente.
 */
const QuoteRequestSchema = z.object({
  shippingCityCode: z.string().regex(/^\d{8}$/),
  shippingSubdivisionCode: z.string().regex(/^\d{2}$/),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
  })).min(1).max(50),
  paymentMethod: z.enum(['COD', 'EXTERNAL_PAYMENT']),
})

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null)
  const parsed = QuoteRequestSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud de cotización inválida' }, { status: 400 })
  }

  try {
    const res = await fetch(`${API_BASE}/shipping/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    })

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      // No propagamos el mensaje interno de NestJS/Vendelo al cliente — degrada
      // elegante: el carrito/checkout muestra "no se pudo calcular" y no bloquea.
      return NextResponse.json({ error: 'No se pudo calcular el envío en este momento' }, { status: res.status })
    }

    return NextResponse.json(body)
  } catch {
    // Timeout o Vendelo/NestJS caído — mismo mensaje genérico, log solo en NestJS/Sentry.
    return NextResponse.json({ error: 'No se pudo calcular el envío en este momento' }, { status: 502 })
  }
}
