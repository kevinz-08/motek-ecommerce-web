/**
 * Pobla la tabla VendeloCity en producción descargando el catálogo completo
 * desde Venndelo (~9.6k ciudades de Colombia).
 *
 * Se ejecuta una sola vez al lanzar y luego solo cuando Venndelo agregue
 * ciudades nuevas. Es idempotente: el controller hace `deleteMany` antes
 * de `createMany` dentro de una transacción, así que correrlo dos veces
 * deja la tabla con el mismo estado.
 *
 * Flujo del script:
 *   1. Login en NestJS con credenciales ADMIN → JWT
 *   2. POST /admin/vendelo/sync-cities con `Authorization: Bearer <jwt>`
 *   3. Imprime la cantidad sincronizada
 *
 * Uso:
 *   cd apps/api
 *   ADMIN_EMAIL=...@... ADMIN_PASSWORD=... pnpm exec tsx scripts/sync-vendelo-cities.ts
 *
 * Variables opcionales:
 *   - API_URL  (default: http://localhost:3001)
 *   - ADMIN_EMAIL / ADMIN_PASSWORD: si no están seteadas como env vars,
 *     el script las pide por stdin de forma interactiva.
 */
import readline from 'readline'

const API_URL = (process.env['API_URL'] ?? 'http://localhost:3001').replace(/\/$/, '')

async function prompt(label: string, hideInput = false): Promise<string> {
  // Usar console.log fuerza el flush a stdout — process.stdout.write quedaba
  // bufferizado en algunos terminales (especialmente PowerShell + tsx) y el
  // label nunca aparecía. La desventaja es que el input queda en línea siguiente.
  console.log(label)

  // Pequeña espera para que el I/O termine de drenar antes de crear el readline.
  await new Promise<void>((r) => setImmediate(r))

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    if (hideInput) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(rl as any)._writeToOutput = (str: string) => {
        if (/[\r\n]/.test(str)) (rl as any).output.write(str)
      }
    }
    rl.question('', (answer) => {
      rl.close()
      if (hideInput) process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Login falló (HTTP ${res.status}): ${text}`)
  }
  const body = JSON.parse(text) as { accessToken: string; role?: string }
  if (body.role && body.role !== 'ADMIN') {
    throw new Error(`Usuario "${email}" no es ADMIN (rol: ${body.role})`)
  }
  return body.accessToken
}

async function syncCities(jwt: string): Promise<{ synced: number }> {
  const res = await fetch(`${API_URL}/admin/vendelo/sync-cities`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Sync falló (HTTP ${res.status}): ${text}`)
  }
  return JSON.parse(text) as { synced: number }
}

async function main() {
  console.log(`→ API: ${API_URL}\n`)

  const email = process.env['ADMIN_EMAIL'] ?? (await prompt('Email admin: '))
  const password = process.env['ADMIN_PASSWORD'] ?? (await prompt('Password admin: ', true))

  if (!email || !password) {
    console.error('❌  Email y password son obligatorios')
    process.exit(1)
  }

  console.log('\n→ Autenticando...')
  const jwt = await login(email, password)
  console.log(`  ✓ JWT (${jwt.slice(0, 18)}...)`)

  console.log('\n→ Sincronizando ciudades (puede tardar varios segundos por paginación)...')
  const start = Date.now()
  const result = await syncCities(jwt)
  const dur = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\n🎉 ${result.synced} ciudades sincronizadas en ${dur}s`)
  console.log('   Verifica con: curl "https://motek-store.vercel.app/api/vendelo/cities?q=Bogo"')
}

main().catch((e) => {
  console.error(`\n❌  ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
