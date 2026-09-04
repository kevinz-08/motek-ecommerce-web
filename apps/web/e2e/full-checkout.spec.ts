/**
 * E2E completo: usuario autenticado (vía storageState creado en global-setup)
 * agrega un producto al carrito, navega al checkout, llena envío y para
 * justo antes del widget de Wompi.
 *
 * Sesión: cookie de NextAuth pre-establecida → useSession devuelve user en
 * el PRIMER render (no hay flip guest→user) → Zustand cart store se crea
 * con la key correcta desde el inicio.
 *
 * Header X-E2E-Trace en todas las requests para identificar en logs.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const TUNNEL_URL = process.env.TUNNEL_URL ?? 'http://localhost:3000'
const API_URL    = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const TRACE      = process.env.E2E_TRACE_HEADER ?? 'e2e-full-checkout'

const USER_INFO_FILE = path.join(__dirname, '../playwright/.auth/user-info.json')

test.use({
  baseURL: TUNNEL_URL,
  extraHTTPHeaders: { 'X-E2E-Trace': TRACE },
})

test.setTimeout(120_000)

test('compra completa: catálogo → producto → carrito → checkout (antes de tarjeta)', async ({ page }) => {
  // La tabla VendeloCity se llena vía POST /admin/vendelo/sync-cities (ADMIN).
  // Para el test mockeamos el endpoint que consulta el CitySelector.
  await page.route('**/api/vendelo/cities*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { code: '11001', name: 'Bogotá', subdivisionCode: '11' },
      ]),
    })
  })

  // Cargamos info del usuario creado por global-setup
  const userInfo = JSON.parse(fs.readFileSync(USER_INFO_FILE, 'utf8')) as {
    email: string
    userId: string
    password: string
  }
  console.log(`✓ Sesión pre-cargada: ${userInfo.email} (userId: ${userInfo.userId})`)

  // ── 1. Obtener un producto activo con stock ────────────────────────────────
  const productsRes = await page.request.get(`${API_URL}/products`)
  const productsBody = await productsRes.json()
  const products: Array<{ id: string; name: string; stock: number; slug: string }> =
    Array.isArray(productsBody) ? productsBody : productsBody.items ?? productsBody.data ?? []
  expect(products.length).toBeGreaterThan(0)
  const product = products.find((p) => p.stock > 0) ?? products[0]
  console.log(`✓ Producto: ${product.name} (${product.slug}, stock: ${product.stock})`)

  // ── 2. Navegar al producto y agregar al carrito ────────────────────────────
  await page.goto(`/producto/${product.slug}`)
  await page.waitForLoadState('networkidle')
  expect(page.url()).toContain(`/producto/${product.slug}`)

  const addBtn = page.getByRole('button', { name: /agregar al carrito/i }).first()
  await expect(addBtn).toBeVisible({ timeout: 15_000 })

  // Esperar a que React hidrate completamente (handlers bound)
  // Heurística: el SessionProvider de NextAuth debe haber resuelto useSession.
  await page.waitForFunction(
    async () => {
      const r = await fetch('/api/auth/session').then((x) => x.json()).catch(() => null)
      return !!r?.user?.id
    },
    null,
    { timeout: 10_000 },
  )

  // Capturar errores y logs del browser para diagnóstico
  page.on('pageerror', (err) => console.log('[page error]', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser ${msg.type()}]`, msg.text().slice(0, 200))
    }
  })

  // Esperar a que React 19 hidrate el client component.
  // Heurística: chequear que el botón tiene fiber de React (__reactFiber* o __reactProps*).
  await page.waitForFunction(
    () => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const btn = buttons.find((b) => /agregar al carrito/i.test(b.textContent ?? ''))
      if (!btn) return false
      return Object.keys(btn).some((k) => k.startsWith('__react'))
    },
    null,
    { timeout: 20_000 },
  )
  console.log(`✓ Botón hidratado por React`)

  await addBtn.click()
  await page.waitForFunction(
    (uid) => !!localStorage.getItem(`motek-store-cart-${uid}`),
    userInfo.userId,
    { timeout: 10_000 },
  )
  console.log(`✓ Producto agregado al carrito`)

  // Esperar a que Zustand persist escriba el cart con la key del usuario
  await page.waitForFunction(
    (uid) => {
      const raw = localStorage.getItem(`motek-store-cart-${uid}`)
      if (!raw) return false
      return raw.includes('"items"') || raw.startsWith('[')
    },
    userInfo.userId,
    { timeout: 10_000 },
  )
  console.log(`✓ Producto agregado al carrito`)

  // ── 3. Ir al carrito y finalizar ───────────────────────────────────────────
  await page.goto('/carrito')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(product.name, { exact: false }).first()).toBeVisible({ timeout: 10_000 })

  const finalizeLink = page.getByRole('link', { name: /finalizar pedido/i })
  await expect(finalizeLink).toBeVisible()
  await finalizeLink.click()
  console.log(`✓ Click en "Finalizar pedido"`)

  // ── 4. Checkout: llenar datos de envío ─────────────────────────────────────
  await page.waitForURL(/\/checkout/, { timeout: 15_000 })
  await page.waitForLoadState('networkidle')

  // Helper: setter nativo + dispatch input event (workaround React Compiler)
  async function reactFill(selector: string, value: string) {
    await page.locator(selector).evaluate((el, val) => {
      const proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
      setter.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, value)
  }

  await reactFill('#checkout-fullName', 'Cliente E2E')
  await reactFill('#checkout-address', 'Calle 45 # 23-10, Apto 302')
  await reactFill('#checkout-phone', '3001234567')

  // CitySelector: typeahead con debounce (300ms) + fetch. Necesitamos que
  // setQuery se dispare → pressSequentially simula teclado real char por char.
  const cityInput = page.locator('#checkout-city')
  await cityInput.click()
  await cityInput.pressSequentially('Bogot', { delay: 50 })

  // Esperar a que aparezca el dropdown con resultados (300ms debounce + API call)
  const optionsList = page.locator('ul[role="listbox"]')
  await optionsList.waitFor({ state: 'visible', timeout: 10_000 })
  const firstOption = optionsList.locator('li[role="option"]').first()
  await firstOption.waitFor({ state: 'visible', timeout: 5_000 })

  // CitySelector usa onMouseDown (no onClick) en las opciones
  await firstOption.dispatchEvent('mousedown')
  console.log(`✓ Ciudad seleccionada`)

  // Aceptar políticas (checkbox aria-required, no atributo required)
  const policiesCheckbox = page.locator('input[type="checkbox"][aria-required="true"]').first()
  await policiesCheckbox.evaluate((el: HTMLInputElement) => el.click())
  await expect(policiesCheckbox).toBeChecked()
  console.log(`✓ Políticas aceptadas`)

  // ── 5. PARAR antes del widget de Wompi ─────────────────────────────────────
  const continueBtn = page.getByRole('button', { name: /continuar al pago/i })
  await expect(continueBtn).toBeVisible({ timeout: 5_000 })
  await expect(continueBtn).toBeEnabled({ timeout: 15_000 })
  console.log(`✓ Botón "Continuar al pago" habilitado — flujo pre-Wompi OK`)

  console.log(`\n🎉 Flujo completo validado para usuario: ${userInfo.email}`)
})
