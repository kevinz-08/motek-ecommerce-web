/**
 * GET /api/admin/vendelo/orders/[id]/guia?format=LETTER_2PP&disposition=inline
 *
 * Devuelve la etiqueta de envío de Vendelo como PDF.
 *
 * Pide siempre `output: 'BASE64'` a NestJS: la alternativa (`URL`) devuelve un
 * enlace temporal de Vendelo que expira, mientras que el PDF re-emitido desde
 * acá siempre funciona y permite `<a download>` sin exponer credenciales.
 *
 * Autorización: solo ADMIN.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, API_BASE } from '@/lib/admin-vendelo-proxy'

const VALID_FORMATS = ['LETTER_2PP', 'LABEL_10x10', 'LABEL_10x15'] as const
type LabelFormat = (typeof VALID_FORMATS)[number]

function parseFormat(raw: string | null): LabelFormat {
  return VALID_FORMATS.includes(raw as LabelFormat) ? (raw as LabelFormat) : 'LETTER_2PP'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const { id } = await params
  const format = parseFormat(req.nextUrl.searchParams.get('format'))
  // inline → se abre en el visor del navegador; attachment → descarga directa.
  const disposition = req.nextUrl.searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment'

  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE}/admin/vendelo/generate-labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guard.accessToken}`,
      },
      body: JSON.stringify({ orderIds: [id], format, output: 'BASE64' }),
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo conectar con la API para generar la guía.' },
      { status: 502 },
    )
  }

  // NestJS responde JSON —no PDF— cuando ningún pedido tenía vendeloOrderId
  // (`skipped`) o cuando la llamada a Vendelo falló.
  const contentType = upstream.headers.get('content-type') ?? ''
  if (!upstream.ok || !contentType.includes('application/pdf')) {
    const data = (await upstream.json().catch(() => ({}))) as { message?: string; error?: string }
    return NextResponse.json(
      {
        error:
          data.message ??
          data.error ??
          'Vendelo no devolvió una etiqueta para este pedido. Verifica que el envío ya esté creado.',
      },
      { status: upstream.ok ? 422 : upstream.status },
    )
  }

  const pdf = await upstream.arrayBuffer()

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="guia-${id.slice(-8).toUpperCase()}.pdf"`,
      'Content-Length': String(pdf.byteLength),
      'Cache-Control': 'no-store',
    },
  })
}
