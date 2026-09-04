import { test, expect } from '@playwright/test'

test.describe('Formularios de autenticación', () => {
  test('login — renderiza campos y label vinculados', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible()
    await expect(page.getByLabel(/contraseña/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible()
  })

  test('login — muestra error con credenciales incorrectas', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('#email', 'noexiste@test.com')
    await page.fill('#password', 'contraseñamala')
    await page.click('button[type="submit"]')

    // role="alert" que agregamos en 11.2 debe anunciarse
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible({ timeout: 8_000 })
    await expect(alert).toContainText(/incorrectos|verifica/i)
  })

  test('login — botón mostrar/ocultar contraseña cambia el tipo del input', async ({
    page,
  }) => {
    await page.goto('/auth/login')
    const passwordInput = page.locator('#password')
    await expect(passwordInput).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: /mostrar contraseña/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: /ocultar contraseña/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('login — redirige a /auth/login si se accede a ruta protegida', async ({
    page,
  }) => {
    await page.goto('/pedidos')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('forgot-password — renderiza campo de email con ARIA correcto', async ({
    page,
  }) => {
    await page.goto('/auth/forgot-password')
    const emailInput = page.locator('#forgot-email')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('aria-required', 'true')
  })

  test('forgot-password — muestra error de validación con correo inválido', async ({
    page,
  }) => {
    await page.goto('/auth/forgot-password')
    await page.fill('#forgot-email', 'no-es-un-correo')
    await page.click('button[type="submit"]')

    const fieldAlert = page.locator('#forgot-email-error')
    await expect(fieldAlert).toBeVisible()
    const input = page.locator('#forgot-email')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  test('forgot-password — muestra confirmación con correo válido', async ({
    page,
  }) => {
    // Mockea la llamada al API para no depender del servidor NestJS
    await page.route('**/auth/forgot-password', async (route) => {
      await route.fulfill({ status: 200, body: '{}' })
    })

    await page.goto('/auth/forgot-password')
    await page.fill('#forgot-email', 'test@example.com')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/revisa tu correo/i)).toBeVisible({
      timeout: 6_000,
    })
  })
})
