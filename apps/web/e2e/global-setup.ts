/**
 * Setup project — corre antes de los specs autenticados (chromium-auth).
 *
 * Crea un usuario fresco vía API (registro → OTP del log → verificación),
 * inicia sesión vía NextAuth credentials endpoint, y guarda:
 *   - playwright/.auth/user.json      → storageState (cookies de NextAuth)
 *   - playwright/.auth/user-info.json → { email, userId, password } para los specs
 *
 * Esto evita los problemas de React Compiler con inputs controlled del form de UI.
 * Patrón Playwright: https://playwright.dev/docs/auth#authenticate-with-setup-project
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const AUTH_FILE      = path.join(__dirname, '../playwright/.auth/user.json')
const USER_INFO_FILE = path.join(__dirname, '../playwright/.auth/user-info.json')
const DEV_LOG        = process.env.DEV_LOG    ?? '/tmp/dev-server.log'
const TUNNEL_URL     = process.env.TUNNEL_URL ?? 'http://localhost:3000'
const API_URL        = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function uniqueEmail(): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `e2e+${id}@motek-store.test`
}

async function waitForOtp(email: string, timeoutMs = 30_000): Promise<string> {
  const re = new RegExp(`\\[DEV\\] OTP(?: \\(resend\\))? para ${email.replace(/[+.]/g, '\\$&')}: (\\d{6})`)
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(DEV_LOG)) {
      const contents = fs.readFileSync(DEV_LOG, 'utf8')
      const matches = [...contents.matchAll(new RegExp(re.source, 'g'))]
      if (matches.length > 0) return matches[matches.length - 1][1]
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`[setup] Timeout esperando OTP para ${email} en ${DEV_LOG}`)
}

setup('authenticate', async ({ playwright }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

  const email = uniqueEmail()
  const password = 'Test1234!'
  const name = 'Cliente E2E'

  // Usamos un request context dedicado para preservar las cookies de NextAuth
  const requestCtx = await playwright.request.newContext({ baseURL: TUNNEL_URL })

  // 1. Registrar usuario vía API
  const regRes = await requestCtx.post(`${API_URL}/auth/register`, {
    data: { name, email, password },
  })
  expect(regRes.ok(), `register failed: ${regRes.status()}`).toBeTruthy()
  console.log(`[setup] ✓ Usuario creado: ${email}`)

  // 2. Leer OTP del log del dev-server y verificar
  const otp = await waitForOtp(email)
  const verifyRes = await requestCtx.post(`${API_URL}/auth/verify-email`, {
    data: { email, code: otp },
  })
  expect(verifyRes.ok(), `verify failed: ${verifyRes.status()}`).toBeTruthy()
  console.log(`[setup] ✓ Email verificado (OTP ${otp})`)

  // 3. Login vía NextAuth credentials → cookie de sesión queda en requestCtx
  const csrfRes = await requestCtx.get(`/api/auth/csrf`)
  const { csrfToken } = await csrfRes.json()
  const loginRes = await requestCtx.post(`/api/auth/callback/credentials`, {
    form: { csrfToken, email, password, callbackUrl: `${TUNNEL_URL}/`, json: 'true' },
  })
  expect(loginRes.ok(), `signIn failed: ${loginRes.status()}`).toBeTruthy()

  // 4. Verificar sesión y obtener userId
  const sessionRes = await requestCtx.get(`/api/auth/session`)
  const session = await sessionRes.json()
  expect(session?.user?.id, `sesión vacía: ${JSON.stringify(session)}`).toBeTruthy()
  console.log(`[setup] ✓ Sesión activa (userId: ${session.user.id}, role: ${session.user.role})`)

  // 5. Guardar storageState + user-info
  await requestCtx.storageState({ path: AUTH_FILE })
  fs.writeFileSync(
    USER_INFO_FILE,
    JSON.stringify({ email, userId: session.user.id, password }, null, 2),
  )
  console.log(`[setup] ✓ storageState → ${AUTH_FILE}`)

  await requestCtx.dispose()
})
