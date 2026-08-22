/**
 * Helper one-off: busca una ciudad en el catálogo de Venndelo por substring.
 *
 * Uso:
 *   pnpm exec tsx scripts/find-vendelo-city.ts <substring>
 */
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const API_KEY = process.env['VENDELO_API_KEY']
const API_URL = process.env['VENDELO_API_URL'] ?? 'https://api.venndelo.com'

async function main() {
  const needle = process.argv[2]
  if (!needle) {
    console.error('Uso: pnpm exec tsx scripts/find-vendelo-city.ts <substring>')
    process.exit(1)
  }
  if (!API_KEY) {
    console.error('VENDELO_API_KEY no configurado')
    process.exit(1)
  }

  const regex = new RegExp(needle, 'i')
  let pageToken = ''
  let scanned = 0
  let matches = 0

  do {
    const qs = new URLSearchParams({ page_size: '500' })
    if (pageToken) qs.set('page_token', pageToken)
    const res = await fetch(`${API_URL}/v1/admin/region/cities?${qs}`, {
      headers: { 'X-Venndelo-Api-Key': API_KEY },
    })
    if (!res.ok) {
      console.error(`HTTP ${res.status}: ${await res.text()}`)
      process.exit(1)
    }
    const data = await res.json() as {
      items: Array<{ code: string; name: string; subdivision_name?: string; subdivision_code: string; country_code: string }>
      next_page_token: string
    }
    for (const c of data.items) {
      if (regex.test(c.name)) {
        console.log(`${c.code}  ${c.name.padEnd(40)} ${c.subdivision_name ?? '?'} (sub_code=${c.subdivision_code}, country=${c.country_code})`)
        matches++
      }
    }
    scanned += data.items.length
    pageToken = data.next_page_token
  } while (pageToken)

  console.log(`\nEscaneadas ${scanned} ciudades, ${matches} coincidencias.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
