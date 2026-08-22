/**
 * Registra (o re-registra) la conexión Chatbot de Venndelo que apunta a
 * nuestro endpoint `/vendelo/webhook`.
 *
 * Patrón de seguridad: como Venndelo aún no firma los webhooks (jun 2026),
 * usamos su campo `metadata` como secreto compartido. El guard del backend
 * valida que cada webhook traiga `metadata[].motek_webhook_secret` con el
 * mismo valor que está en VENDELO_WEBHOOK_SECRET.
 *
 * Uso:
 *   cd apps/api
 *   pnpm exec tsx scripts/register-vendelo-webhook.ts [--list|--delete <id>]
 *
 * Variables requeridas (lee de .env y .env.local):
 *   - VENDELO_API_KEY
 *   - VENDELO_API_URL          (default: https://api.venndelo.com)
 *   - VENDELO_WEBHOOK_SECRET   (el mismo que está en Cloud Run Secret Manager)
 *   - VENDELO_WEBHOOK_URL      (URL pública del backend + /vendelo/webhook)
 */
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true })

const API_URL = (process.env['VENDELO_API_URL'] ?? 'https://api.venndelo.com').replace(/\/$/, '')
const API_KEY = process.env['VENDELO_API_KEY']
const SECRET  = process.env['VENDELO_WEBHOOK_SECRET']
// Sin default: un fallback equivocado registra en Venndelo un webhook que no
// apunta a ningún backend y falla en silencio. Mejor exigir la URL explícita.
const HOOK_URL = process.env['VENDELO_WEBHOOK_URL']

const CONNECTION_NAME = 'Motek Store — Backend webhook (prod)'

// Eventos que nuestro backend procesa (ver vendelo-webhook.controller.ts)
const EVENTS = [
  'ORDER_CREATED',
  'ORDER_CANCELLED',
  'ORDER_CONFIRMATION_REQUESTED',
  'ORDER_PREPARED',
  'ORDER_READY_FOR_PICKUP',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'SHIPMENT_EXCEPTION_CREATED',
  'SHIPMENT_STATUS_UPDATED',
] as const

// Header oficial según la doc de Venndelo (jun 2026)
const AUTH_HEADER = 'X-Venndelo-Api-Key'

function assertEnv() {
  const missing: string[] = []
  if (!API_KEY) missing.push('VENDELO_API_KEY')
  if (!SECRET)  missing.push('VENDELO_WEBHOOK_SECRET')
  if (!HOOK_URL) missing.push('VENDELO_WEBHOOK_URL')
  if (missing.length) {
    console.error(`❌  Faltan env vars: ${missing.join(', ')}`)
    process.exit(1)
  }
}

async function vendeloFetch<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T | string }> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      [AUTH_HEADER]: API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  let body: T | string = text
  try { body = JSON.parse(text) as T } catch { /* keep raw */ }
  return { status: res.status, body }
}

interface Connection {
  id: string
  name: string
  status: 'ENABLED' | 'DISABLED' | 'PAUSED' | 'ACTIVATING'
  settings: { url: string; events: string[] }
}

interface ListResponse {
  curr_page_token: string
  next_page_token: string
  page_item_count: number
  items: Connection[]
}

async function list(): Promise<Connection[]> {
  const all: Connection[] = []
  let pageToken = ''
  do {
    const qs = new URLSearchParams({ page_size: '500' })
    if (pageToken) qs.set('page_token', pageToken)
    const { status, body } = await vendeloFetch<ListResponse>(`/v1/admin/chatbot/connections?${qs}`)
    if (status !== 200 || typeof body === 'string') {
      throw new Error(`list failed: HTTP ${status} — ${typeof body === 'string' ? body : JSON.stringify(body)}`)
    }
    all.push(...body.items)
    pageToken = body.next_page_token
  } while (pageToken)
  return all
}

async function create(): Promise<Connection> {
  const payload = {
    name: CONNECTION_NAME,
    settings: {
      url: HOOK_URL!, // assertEnv() ya garantizó que está definida
      events: EVENTS,
      sources: ['API'],
      excluded_sales_channels: [],
    },
    // Patrón de seguridad: el guard del backend valida este campo
    metadata: [{ motek_webhook_secret: SECRET }],
  }

  const { status, body } = await vendeloFetch<Connection>('/v1/admin/chatbot/connections', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (status !== 201 && status !== 200) {
    throw new Error(`create failed: HTTP ${status} — ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }
  return body as Connection
}

async function del(id: string): Promise<void> {
  const { status, body } = await vendeloFetch(`/v1/admin/chatbot/connections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (status !== 204 && status !== 200) {
    throw new Error(`delete failed: HTTP ${status} — ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }
}

async function main() {
  assertEnv()
  const arg = process.argv[2]

  if (arg === '--list') {
    const items = await list()
    console.log(`\n${items.length} conexion(es):\n`)
    items.forEach((c) =>
      console.log(`  • ${c.id}  ${c.status.padEnd(10)}  url=${c.settings.url}  name="${c.name}"`),
    )
    return
  }

  if (arg === '--delete') {
    const id = process.argv[3]
    if (!id) {
      console.error('Uso: --delete <connectionId>')
      process.exit(1)
    }
    await del(id)
    console.log(`✓ Conexión ${id} eliminada`)
    return
  }

  console.log(`Conexion al endpoint: ${HOOK_URL}`)
  console.log(`Nombre: ${CONNECTION_NAME}`)
  console.log(`Eventos: ${EVENTS.length}`)
  console.log(`Secret en metadata: ${SECRET!.slice(0, 8)}*** (longitud ${SECRET!.length})\n`)

  // Verificar si ya existe una conexión apuntando al mismo URL — evita duplicados
  const existing = await list()
  const dupe = existing.find((c) => c.settings?.url === HOOK_URL)
  if (dupe) {
    console.log(`⚠  Ya existe una conexión apuntando a esa URL (id=${dupe.id}, status=${dupe.status})`)
    console.log(`   Bórrala primero con: pnpm exec tsx scripts/register-vendelo-webhook.ts --delete ${dupe.id}`)
    process.exit(1)
  }

  console.log('→ Registrando conexión nueva...')
  const created = await create()
  console.log('\n✓ Conexión creada:')
  console.log(`  id:     ${created.id}`)
  console.log(`  status: ${created.status}`)
  console.log(`  url:    ${created.settings.url}`)
  console.log(`  events: ${created.settings.events.join(', ')}`)
  console.log(`\nGuarda ${created.id} por si necesitas borrarla luego.`)
}

main().catch((e) => {
  console.error(`\n❌  ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
