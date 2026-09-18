import { test, expect, type Page } from '@playwright/test'

/**
 * Checkout de invitado — corre SIN sesión (proyecto `chromium`).
 *
 * Es el punto del flujo: si estos tests necesitaran `storageState`, no estarían
 * probando lo que dicen probar.
 *
 * Dos cosas hay que preparar para que sean deterministas:
 *
 *  1. `GUEST_CHECKOUT_ENABLED` — el flujo nace apagado. El `beforeAll` lo
 *     enciende y el `afterAll` lo vuelve a apagar (su default documentado), todo
 *     por HTTP contra la API con las credenciales del ADMIN del seed. No se
 *     importa `@motek/database`: el transpilador de Playwright no puede cargar
 *     el cliente de Prisma generado — mismo motivo que en `admin-setup.ts`.
 *
 *  2. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — con la site key de prueba de Cloudflare
 *     (`1x00000000000000000000AA`) el widget se resuelve solo, sin interacción.
 *     Sin ella el botón queda deshabilitado a propósito, así que el test de
 *     envío se salta con un mensaje explícito en vez de fallar.
 *
 * Las llamadas al API de NestJS se interceptan con page.route(): estos tests
 * verifican el comportamiento del frontend, no la pasarela.
 */

const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

const MOCK_GUEST_ORDER_RESPONSE = {
  order: {
    id: 'test-guest-order-e2e',
    userId: null,
    guestId: 'guest-e2e',
    contactEmail: 'invitado.e2e@motek.test',
    total: 8500000,
    status: 'PENDING',
    shippingAddress: {
      fullName: 'Invitado E2E',
      address: 'Calle 45 # 23-10',
      city: 'Medellín',
      department: 'Antioquia',
      phone: '3001234567',
    },
  },
  payment: {
    publicKey: 'pub_test_mock_key',
    integritySignature: 'mock-integrity-sig',
    reference: 'test-ref-guest-e2e',
    amountInCents: 8500000,
    currency: 'COP',
  },
  trackingToken: 'token-de-prueba-e2e',
  trackingUrl: '/pedidos/seguimiento?token=token-de-prueba-e2e',
}

/** El carrito de invitado vive bajo la clave `guest` — ver apps/web/src/lib/cart.ts. */
async function seedGuestCart(page: Page) {
  await page.evaluate(
    (cartData) => localStorage.setItem('motek-store-cart-guest', cartData),
    JSON.stringify({
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
  )
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'motekdev@gmail.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin123!'

/** Enciende o apaga el kill-switch de guest checkout vía la API de admin. */
async function setGuestCheckout(
  request: import('@playwright/test').APIRequestContext,
  enabled: boolean,
) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  expect(
    login.ok(),
    `No se pudo autenticar el ADMIN del seed (${ADMIN_EMAIL}). ¿Corriste 'pnpm db:seed'?`,
  ).toBe(true)

  const { accessToken } = await login.json()
  const res = await request.patch(`${API_URL}/admin/settings/guest-checkout`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { enabled },
  })
  expect(res.ok(), 'No se pudo cambiar GUEST_CHECKOUT_ENABLED').toBe(true)
}

test.beforeAll(async ({ request }) => {
  await setGuestCheckout(request, true)
})

test.afterAll(async ({ request }) => {
  // Se restaura al default documentado (apagado), no al valor previo: no hay
  // endpoint de lectura y dejar el flujo abierto por accidente es peor que
  // dejarlo cerrado.
  await setGuestCheckout(request, false)
})

test.describe('Checkout de invitado', () => {
  test('el checkout ya no redirige a login sin sesión', async ({ page }) => {
    // Es el cambio de comportamiento que habilita todo lo demás: antes,
    // proxy.ts mandaba a /auth/login a cualquiera sin sesión.
    await page.goto('/checkout')
    await expect(page).not.toHaveURL(/\/auth\/login/)
  })

  test('muestra el formulario con el aviso de compra como invitado', async ({ page }) => {
    await page.goto('/carrito')
    await seedGuestCart(page)
    await page.goto('/checkout')

    await expect(page.getByText(/estás comprando como invitado/i)).toBeVisible({ timeout: 10_000 })
    // El aviso invita a entrar, pero nunca bloquea ni dice si el correo tiene cuenta.
    await expect(page.getByRole('link', { name: /iniciar sesión/i }).first()).toBeVisible()
    await expect(page.locator('#checkout-email')).toBeEditable()
  })

  test('no ofrece pago contra entrega a un invitado', async ({ page }) => {
    // COD exige cuenta: se confirma sin ninguna autorización de pago, así que
    // sin identidad el fraude sale gratis.
    await page.goto('/carrito')
    await seedGuestCart(page)
    await page.goto('/checkout')

    await expect(page.locator('#checkout-email')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/pago contra entrega/i)).toHaveCount(0)
  })

  test('el botón de envío exige aceptar las políticas', async ({ page }) => {
    await page.goto('/carrito')
    await seedGuestCart(page)
    await page.goto('/checkout')

    await expect(page.locator('#checkout-email')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /continuar al pago/i })).toBeDisabled()
  })

  test('envía el pedido y avanza al paso de pago', async ({ page }) => {
    test.skip(
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY !== TURNSTILE_TEST_SITE_KEY,
      `Requiere NEXT_PUBLIC_TURNSTILE_SITE_KEY=${TURNSTILE_TEST_SITE_KEY} (site key de prueba de Cloudflare)`,
    )

    await page.route('**/orders/guest', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GUEST_ORDER_RESPONSE),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/carrito')
    await seedGuestCart(page)
    await page.goto('/checkout')

    await expect(page.locator('#checkout-fullName')).toBeVisible({ timeout: 10_000 })
    await page.fill('#checkout-fullName', 'Invitado E2E')
    await page.fill('#checkout-address', 'Calle 45 # 23-10, Apto 302')
    await page.fill('#checkout-phone', '3001234567')
    await page.fill('#checkout-email', 'invitado.e2e@motek.test')
    await page.getByLabel(/retiro en tienda/i).check()
    await page.locator('#checkout-policies').check()

    const submit = page.getByRole('button', { name: /continuar al pago/i })
    await expect(submit).toBeEnabled({ timeout: 15_000 })
    await submit.click()

    await expect(page.getByText(/pago seguro con wompi/i)).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Seguimiento de pedido sin sesión', () => {
  test('un token inválido muestra el mismo mensaje que un pedido inexistente', async ({ page }) => {
    // Sin distinción observable: cualquier diferencia convertiría la página en
    // un oráculo para descubrir qué pedidos existen.
    await page.goto('/pedidos/seguimiento?token=token-que-no-existe-jamas')
    await expect(page.getByRole('heading', { name: /pedido no encontrado/i })).toBeVisible()
  })

  test('sin token muestra el mismo mensaje', async ({ page }) => {
    await page.goto('/pedidos/seguimiento')
    await expect(page.getByRole('heading', { name: /pedido no encontrado/i })).toBeVisible()
  })

  test('la página de recuperación de enlace es pública', async ({ page }) => {
    await page.goto('/pedidos/seguimiento/solicitar')
    await expect(page).not.toHaveURL(/\/auth\/login/)
    await expect(page.getByRole('heading', { name: /recupera el enlace/i })).toBeVisible()
  })
})
