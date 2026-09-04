import { test, expect } from '@playwright/test'

const GUEST_CART_KEY = 'motek-store-cart-guest'

function makeCartItem(overrides: Partial<{ stock: number; price: number }> = {}) {
  return {
    product: {
      id: 'test-prod-1',
      name: 'Pastilla de freno Brembo YZF-R3',
      slug: 'pastilla-freno-brembo-yzf-r3',
      price: 8500000, // 85.000 COP en centavos
      stock: overrides.stock ?? 10,
      sku: 'BRE-001',
      images: [],
      description: 'Pastilla de freno original Brembo para Yamaha YZF-R3',
      isActive: true,
      categoryId: 'cat-frenos',
      compatible: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    quantity: 1,
  }
}

test.describe('Carrito de compras', () => {
  test('carrito vacío — muestra empty state con link al catálogo', async ({
    page,
  }) => {
    await page.goto('/carrito')
    await expect(page.getByText(/carrito está vacío/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /ver catálogo/i })).toBeVisible()
  })

  test('carrito con ítems — muestra el producto y el total', async ({ page }) => {
    // Inyecta un ítem en localStorage antes de cargar la página
    await page.goto('/carrito')
    await page.evaluate(
      ({ key, item }) => localStorage.setItem(key, JSON.stringify([item])),
      { key: GUEST_CART_KEY, item: makeCartItem() },
    )
    await page.reload()

    await expect(page.getByText(/Pastilla de freno Brembo/i)).toBeVisible()
    // El total debe aparecer en la página
    await expect(page.getByText(/\$85\.000|\$ 85\.000|85,000/)).toBeVisible()
  })

  test('carrito — botón "+" incrementa la cantidad', async ({ page }) => {
    await page.goto('/carrito')
    await page.evaluate(
      ({ key, item }) => localStorage.setItem(key, JSON.stringify([item])),
      { key: GUEST_CART_KEY, item: makeCartItem() },
    )
    await page.reload()

    const qty = page.locator('span').filter({ hasText: /^1$/ }).first()
    await expect(qty).toBeVisible()

    await page.getByRole('button', { name: /aumentar cantidad/i }).click()
    await expect(page.locator('span').filter({ hasText: /^2$/ }).first()).toBeVisible()
  })

  test('carrito — botón "−" a 0 elimina el ítem', async ({ page }) => {
    await page.goto('/carrito')
    await page.evaluate(
      ({ key, item }) => localStorage.setItem(key, JSON.stringify([item])),
      { key: GUEST_CART_KEY, item: makeCartItem() },
    )
    await page.reload()

    await page.getByRole('button', { name: /reducir cantidad/i }).click()
    // Cuando llega a 0, useCart elimina el ítem → carrito vacío
    await expect(page.getByText(/carrito está vacío/i)).toBeVisible({
      timeout: 5_000,
    })
  })

  test('carrito — eliminar ítem individualmente muestra empty state', async ({
    page,
  }) => {
    await page.goto('/carrito')
    await page.evaluate(
      ({ key, item }) => localStorage.setItem(key, JSON.stringify([item])),
      { key: GUEST_CART_KEY, item: makeCartItem() },
    )
    await page.reload()

    await page.getByRole('button', { name: /eliminar producto/i }).click()
    await expect(page.getByText(/carrito está vacío/i)).toBeVisible({
      timeout: 5_000,
    })
  })

  test('carrito — el botón "+" queda deshabilitado al alcanzar el stock máximo', async ({
    page,
  }) => {
    const itemConStock1 = makeCartItem({ stock: 1 })
    await page.goto('/carrito')
    await page.evaluate(
      ({ key, item }) => localStorage.setItem(key, JSON.stringify([item])),
      { key: GUEST_CART_KEY, item: itemConStock1 },
    )
    await page.reload()

    const incrementBtn = page.getByRole('button', { name: /aumentar cantidad/i })
    await expect(incrementBtn).toBeDisabled()
  })

  test('carrito — link "Finalizar pedido" apunta a /checkout', async ({
    page,
  }) => {
    await page.goto('/carrito')
    await page.evaluate(
      ({ key, item }) => localStorage.setItem(key, JSON.stringify([item])),
      { key: GUEST_CART_KEY, item: makeCartItem() },
    )
    await page.reload()

    const checkoutLink = page.getByRole('link', { name: /finalizar pedido/i })
    await expect(checkoutLink).toHaveAttribute('href', '/checkout')
  })
})
