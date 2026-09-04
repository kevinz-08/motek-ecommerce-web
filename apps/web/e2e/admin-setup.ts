/**
 * Setup project — corre antes de los specs del panel admin (chromium-admin).
 *
 * Inicia sesión con el ADMIN determinista que crea `pnpm db:seed`
 * (motekdev@gmail.com) y guarda el estado en playwright/.auth/admin.json.
 *
 * A diferencia de `global-setup.ts` no crea un usuario nuevo: el rol tiene que
 * existir ANTES del login, porque el callback `jwt` de NextAuth lee el rol al
 * firmar el token — promover a un usuario recién registrado dejaría una sesión
 * de CUSTOMER y `/admin` redirigiría. Todo el setup va por HTTP y no importa
 * `@motek/database`: el transpilador de Playwright no puede cargar el cliente
 * de Prisma generado.
 *
 * Requiere que la base tenga el seed aplicado. Las credenciales se pueden
 * sobreescribir con E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const AUTH_FILE = path.join(__dirname, '../playwright/.auth/admin.json')
const TUNNEL_URL = process.env.TUNNEL_URL ?? 'http://localhost:3000'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'motekdev@gmail.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin123!'

setup('authenticate admin', async ({ playwright }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

  const requestCtx = await playwright.request.newContext({ baseURL: TUNNEL_URL })

  const { csrfToken } = await (await requestCtx.get('/api/auth/csrf')).json()
  const loginRes = await requestCtx.post('/api/auth/callback/credentials', {
    form: {
      csrfToken,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      callbackUrl: `${TUNNEL_URL}/`,
      json: 'true',
    },
  })
  expect(loginRes.ok(), `signIn falló: ${loginRes.status()}`).toBeTruthy()

  const session = await (await requestCtx.get('/api/auth/session')).json()
  expect(
    session?.user?.role,
    `la sesión no es ADMIN — ¿corriste 'pnpm db:seed'? sesión: ${JSON.stringify(session)}`,
  ).toBe('ADMIN')
  console.log(`[admin-setup] ✓ Sesión ADMIN activa (${ADMIN_EMAIL})`)

  await requestCtx.storageState({ path: AUTH_FILE })
  await requestCtx.dispose()
})
