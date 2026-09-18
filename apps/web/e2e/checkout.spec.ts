import { test, expect } from '@playwright/test'

/**
 * Tests de checkout — requieren sesión autenticada.
 * La sesión se crea en global-setup.ts usando TEST_USER_EMAIL / TEST_USER_PASSWORD.
 *
 * Las llamadas al API de NestJS se mockean con page.route() para que los tests
 * no dependan del servidor NestJS ni de Wompi.
 */

const MOCK_ORDER_RESPONSE = {
  order: {
    id: 'test-order-e2e',
    total: 8500000,
    status: 'PENDING',
    shippingAddress: {
      fullName: 'Test User',
      address: 'Calle 45 # 23-10',
      city: 'Medellín',
      department: 'Antioquia',
      phone: '3001234567',
    },
  },
  payment: {
    publicKey: 'pub_test_mock_key',
    integritySignature: 'mock-integrity-sig',
    reference: 'test-ref-e2e',
    amountInCents: 8500000,
    currency: 'COP',
  },
}

async function seedCart(page: import('@playwright/test').Page, userId: string) {
  const key = `motek-store-cart-${userId}`
  await page.evaluate(
    ({ storageKey, cartData }) => localStorage.setItem(storageKey, cartData),
    {
      storageKey: key,
      // Zustand `persist` espera { state, version } — no un array plano.
      // Ver apps/web/src/lib/cart.ts (createCartStore usa persist() sin version custom → default 0).
      cartData: JSON.stringify({
        state: {
          items: [
            {
              product: {
                id: 'test-prod-1',
                name: 'Pastilla de freno Brembo YZF-R3',
                slug: 'pastilla-freno-brembo-yzf-r3',
                price: 8500000,
                stock: 10,
                sku: 'BRE-001',
                images: [],
                description: 'Test product',
                isActive: true,
                categoryId: 'cat-1',
                compatible: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              quantity: 1,
            },
          ],
          selectedCity: null,
        },
        version: 0,
      }),
    },
  )
}

test.describe('Checkout — flujo completo (autenticado)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercepta las llamadas al API de NestJS
    await page.route('**/orders', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ORDER_RESPONSE),
        })
      } else {
        await route.continue()
      }
    })
  })

  test('checkout — accesible sin sesión desde que existe el guest checkout', async ({
    browser,
  }) => {
    // Antes este test esperaba un redirect a /auth/login: `proxy.ts` protegía
    // /checkout. Con la compra sin registro, un visitante debe poder llegar al
    // formulario; quién puede completarlo lo decide el backend
    // (GUEST_CHECKOUT_ENABLED) y lo cubre `guest-checkout.spec.ts`.
    //
    // Contexto explícitamente sin cookies — el proyecto chromium-auth define
    // storageState por defecto, así que hay que sobrescribirlo a vacío o esta
    // "sesión limpia" hereda la autenticación del setup.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    await page.goto('http://localhost:3000/checkout')
    await expect(page).not.toHaveURL(/\/auth\/login/)
    await ctx.close()
  })

  test('checkout — muestra el formulario de envío con sesión activa', async ({
    page,
  }) => {
    // Obtiene el userId de la sesión para construir la clave del carrito
    const session = await page.request.get('/api/auth/session')
    const sessionData = await session.json()
    const userId: string = sessionData?.user?.id ?? 'guest'

    await page.goto('/carrito')
    await seedCart(page, userId)

    await page.goto('/checkout')
    await expect(
      page.getByRole('heading', { name: /datos de envío/i }),
    ).toBeVisible({ timeout: 10_000 })

    // Verifica que los campos ARIA estén presentes (11.2)
    await expect(page.locator('#checkout-fullName')).toBeVisible()
    await expect(page.locator('#checkout-address')).toBeVisible()
    await expect(page.locator('#checkout-city')).toBeVisible()
    await expect(page.locator('#checkout-phone')).toBeVisible()
  })

  test('checkout — happy path: envío → avanza al paso de pago', async ({
    page,
  }) => {
    const session = await page.request.get('/api/auth/session')
    const sessionData = await session.json()
    const userId: string = sessionData?.user?.id ?? 'guest'

    await page.goto('/carrito')
    await seedCart(page, userId)

    await page.goto('/checkout')
    await expect(page.locator('#checkout-fullName')).toBeVisible({
      timeout: 10_000,
    })

    // Rellena el formulario de envío
    await page.fill('#checkout-fullName', 'Juan Pérez E2E')
    await page.fill('#checkout-address', 'Calle 45 # 23-10, Apto 302')
    await page.fill('#checkout-phone', '3001234567')
    await page.fill('#buyer-id-number', '1000123456')

    // CitySelector es un autocomplete — hay que escribir y elegir una opción
    // del listbox, no basta con `fill` (eso no dispara la selección real).
    await page.route('**/api/vendelo/cities*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ code: '05001', name: 'Medellín', subdivisionCode: '01' }]),
      })
    })
    const cityInput = page.locator('#checkout-city')
    await cityInput.click()
    await cityInput.pressSequentially('Mede', { delay: 50 })
    const firstOption = page.locator('ul[role="listbox"] li[role="option"]').first()
    await firstOption.waitFor({ state: 'visible', timeout: 10_000 })
    await firstOption.dispatchEvent('mousedown')

    const policiesCheckbox = page.locator('input[type="checkbox"][aria-required="true"]').first()
    await policiesCheckbox.check()

    await page.getByRole('button', { name: /continuar al pago/i }).click()

    // Tras la respuesta mockeada del API, avanza al paso de pago
    await expect(
      page.getByRole('heading', { name: /pago seguro con wompi/i }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('checkout — validación: no avanza si faltan campos requeridos', async ({
    page,
  }) => {
    const session = await page.request.get('/api/auth/session')
    const sessionData = await session.json()
    const userId: string = sessionData?.user?.id ?? 'guest'

    await page.goto('/carrito')
    await seedCart(page, userId)

    await page.goto('/checkout')
    await expect(page.locator('#checkout-fullName')).toBeVisible({
      timeout: 10_000,
    })

    // Sin ciudad seleccionada ni políticas aceptadas, el botón permanece
    // deshabilitado — el formulario no se puede enviar.
    await expect(
      page.getByRole('button', { name: /continuar al pago/i }),
    ).toBeDisabled()
    await expect(
      page.getByRole('heading', { name: /datos de envío/i }),
    ).toBeVisible()
  })

  test('retiro en tienda — oculta ciudad/dirección y muestra el mapa de la tienda', async ({
    page,
  }) => {
    const session = await page.request.get('/api/auth/session')
    const sessionData = await session.json()
    const userId: string = sessionData?.user?.id ?? 'guest'

    await page.goto('/carrito')
    await seedCart(page, userId)

    await page.goto('/checkout')
    await expect(page.locator('#checkout-fullName')).toBeVisible({ timeout: 10_000 })

    // Por defecto es HOME_DELIVERY — dirección y ciudad visibles
    await expect(page.locator('#checkout-address')).toBeVisible()
    await expect(page.locator('#checkout-city')).toBeVisible()

    await page.getByText('Retiro en tienda').click()

    // Al elegir retiro en tienda, dirección/ciudad desaparecen y aparece el mapa
    await expect(page.locator('#checkout-address')).toHaveCount(0)
    await expect(page.locator('#checkout-city')).toHaveCount(0)
    await expect(
      page.frameLocator('iframe[title="Ubicación de la tienda en Google Maps"]').locator('body'),
    ).toBeAttached()
    await expect(page.getByText('Cra 21 #21-58', { exact: false })).toBeVisible()
  })

  test('retiro en tienda — envía deliveryMethod=STORE_PICKUP sin exigir ciudad', async ({
    page,
  }) => {
    const session = await page.request.get('/api/auth/session')
    const sessionData = await session.json()
    const userId: string = sessionData?.user?.id ?? 'guest'

    await page.goto('/carrito')
    await seedCart(page, userId)

    await page.goto('/checkout')
    await expect(page.locator('#checkout-fullName')).toBeVisible({ timeout: 10_000 })

    await page.getByText('Retiro en tienda').click()
    await page.fill('#checkout-fullName', 'Juan Pérez E2E')
    await page.fill('#checkout-phone', '3001234567')
    await page.fill('#buyer-id-number', '1000123456')

    const policiesCheckbox = page.locator('input[type="checkbox"][aria-required="true"]').first()
    await policiesCheckbox.check()

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/orders') && req.method() === 'POST'),
      page.getByRole('button', { name: /continuar al pago/i }).click(),
    ])

    const body = request.postDataJSON() as {
      deliveryMethod?: string
      shippingAddress?: { address?: string; city?: string }
    }
    expect(body.deliveryMethod).toBe('STORE_PICKUP')
    expect(body.shippingAddress?.address).toContain('Cra 21 #21-58')
    expect(body.shippingAddress?.city).toBe('Bucaramanga')

    // Con la respuesta mockeada del API, igual avanza al paso de pago
    await expect(
      page.getByRole('heading', { name: /pago seguro con wompi/i }),
    ).toBeVisible({ timeout: 10_000 })
  })
})
