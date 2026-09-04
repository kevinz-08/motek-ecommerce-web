/**
 * Lanza Playwright Codegen contra el túnel Cloudflare con un header
 * personalizado (`X-E2E-Trace`) inyectado en todas las requests.
 *
 * Uso:
 *   TUNNEL_URL=https://xxxx.trycloudflare.com pnpm tsx scripts/codegen-with-header.ts
 *
 * Flujo recomendado:
 *   1. Se abre Chromium + Playwright Inspector (por page.pause()).
 *   2. Click ⏺ Record en el Inspector y graba: registro → email → contraseña.
 *   3. Cuando llegue a "Ingresa el código de verificación":
 *        - Click ⏸ Pause en el Inspector.
 *        - Pega el código manualmente (no se grabará).
 *        - Click ⏺ Record otra vez y haz click en "Verificar".
 *   4. Continúa: catálogo → producto → carrito → checkout (datos de envío).
 *   5. Justo antes del widget de Wompi, click ⏸ Pause y copia el código generado.
 *   6. Cierra el browser para terminar.
 */
import { chromium } from '@playwright/test'

const TUNNEL_URL = process.env.TUNNEL_URL ?? 'http://localhost:3000'
const TRACE_HEADER = process.env.E2E_TRACE_HEADER ?? 'playwright-codegen-checkout'

;(async () => {
  console.log(`▶  Codegen target: ${TUNNEL_URL}`)
  console.log(`▶  X-E2E-Trace:    ${TRACE_HEADER}`)

  const browser = await chromium.launch({ headless: false })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'X-E2E-Trace': TRACE_HEADER,
    },
  })

  const page = await context.newPage()
  await page.goto(TUNNEL_URL + '/auth/register')

  // Abre el Playwright Inspector y queda en pausa, listo para grabar.
  await page.pause()

  // Cuando cierres el browser, guarda el storage state para reusar el login.
  context.on('close', async () => {
    try {
      await context.storageState({ path: 'playwright/.auth/user.json' })
      console.log('✓ storageState guardado en playwright/.auth/user.json')
    } catch (err) {
      console.warn('No se pudo guardar storageState:', err)
    }
  })

  page.on('close', async () => {
    await browser.close()
    process.exit(0)
  })
})().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
