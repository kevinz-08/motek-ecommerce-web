import { test, expect } from '@playwright/test'

test.describe('Páginas públicas', () => {
  test('home — carga y muestra el hero', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Motek Store/)
    // El hero del catálogo tiene un heading visible
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })

  test('home — enlace al catálogo es accesible', async ({ page }) => {
    await page.goto('/')
    const catalogLink = page.getByRole('link', { name: /ver catálogo|explorar/i }).first()
    await expect(catalogLink).toBeVisible()
    await catalogLink.click()
    await expect(page).toHaveURL(/\/catalogo/)
  })

  test('catálogo — carga el grid completo por defecto', async ({ page }) => {
    await page.goto('/catalogo')
    await expect(page.getByRole('heading', { level: 1, name: 'Todo el catálogo' })).toBeVisible()
    // El FilterDrawer confirma que estamos en la vista grid (no landing)
    await expect(page.getByRole('button', { name: /seleccionar filtros/i })).toBeVisible()
    // Espera a que haya al menos una tarjeta de producto (link a /producto/)
    await expect(page.locator('a[href^="/producto/"]').first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('catálogo — ?showAll=true redirige a /catalogo', async ({ page }) => {
    const response = await page.goto('/catalogo?showAll=true')
    expect(response?.url()).toBe(new URL('/catalogo', page.url()).toString())
  })

  test('catálogo — filtro de búsqueda actualiza la URL', async ({ page }) => {
    await page.goto('/catalogo')
    const searchInput = page.getByRole('searchbox').or(
      page.locator('input[placeholder*="Buscar"]'),
    )
    if (await searchInput.isVisible()) {
      await searchInput.fill('freno')
      await expect(page).toHaveURL(/q=freno/, { timeout: 5_000 })
    }
  })

  test('detalle de producto — carga nombre, precio y botón de carrito', async ({
    page,
  }) => {
    await page.goto('/catalogo')
    // Toma el primer link a un producto y navega
    const firstProduct = page.locator('a[href^="/producto/"]').first()
    const productHref = await firstProduct.getAttribute('href')
    await page.goto(productHref!)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // El precio aparece (formato COP)
    await expect(page.getByText(/\$/).first()).toBeVisible()
    // El botón de agregar al carrito existe (puede estar deshabilitado si no hay stock)
    await expect(
      page.getByRole('button', { name: /agregar al carrito|agotado/i }),
    ).toBeVisible()
  })

  test('producto inexistente — muestra 404', async ({ page }) => {
    const response = await page.goto('/producto/slug-que-no-existe-xyz-abc')
    expect(response?.status()).toBe(404)
  })
})
