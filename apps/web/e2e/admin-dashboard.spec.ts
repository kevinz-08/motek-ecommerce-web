import { test, expect } from '@playwright/test'

/**
 * Dashboard admin — la pantalla principal del panel.
 *
 * Lo que se protege aquí es el contrato del rediseño: que el filtro de rango
 * acota TODA la pantalla y no solo el gráfico de ingresos, y que cada módulo
 * sigue montándose con datos reales.
 */
test.describe('Dashboard admin', () => {
  test('carga con los módulos principales visibles', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()

    // Los seis módulos de la pantalla principal
    for (const titulo of [
      'Ingresos',
      'Ciclo del pedido',
      'Tendencia',
      'Top productos',
      'Actividad reciente',
      'Stock crítico',
    ]) {
      await expect(page.getByText(titulo, { exact: true }).first()).toBeVisible()
    }
  })

  test('el filtro de rango recalcula toda la pantalla, no solo el gráfico', async ({ page }) => {
    await page.goto('/admin')

    const filter = page.getByRole('navigation', { name: 'Rango de fechas' })
    await expect(filter).toBeVisible()

    // Por defecto: 2 semanas, sin ?range= en la URL
    await expect(filter.getByRole('link', { name: '2 semanas' })).toHaveAttribute('aria-current', 'page')

    await filter.getByRole('link', { name: '3 meses' }).click()
    await expect(page).toHaveURL(/\?range=3m/)
    await expect(filter.getByRole('link', { name: '3 meses' })).toHaveAttribute('aria-current', 'page')

    // El rango alcanza al KPI héroe, al gráfico y al ciclo del pedido a la vez.
    // Descontando el propio botón del filtro, «3 meses» debe seguir apareciendo
    // en varios módulos; si solo cambiara el gráfico, quedaría una sola mención.
    const mencionesFuera = await page
      .locator('main')
      .getByText('3 meses')
      .filter({ hasNot: page.getByRole('link') })
      .count()
    expect(mencionesFuera).toBeGreaterThan(1)
  })

  test('la tendencia alterna entre pedidos y clientes nuevos', async ({ page }) => {
    await page.goto('/admin')

    const tabs = page.getByRole('tablist', { name: 'Serie de la tendencia' })

    // El módulo solo aparece cuando hay actividad en el período.
    if ((await tabs.count()) === 0) {
      test.skip(true, 'Sin actividad en el período por defecto: la tendencia muestra su estado vacío')
      return
    }

    await expect(tabs.getByRole('tab', { name: 'Pedidos' })).toHaveAttribute('aria-selected', 'true')

    await tabs.getByRole('tab', { name: 'Clientes nuevos' }).click()
    await expect(tabs.getByRole('tab', { name: 'Clientes nuevos' })).toHaveAttribute('aria-selected', 'true')
    await expect(tabs.getByRole('tab', { name: 'Pedidos' })).toHaveAttribute('aria-selected', 'false')
  })

  test('un rango inválido cae al rango por defecto en vez de romper', async ({ page }) => {
    await page.goto('/admin?range=no-existe')

    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Rango de fechas' }).getByRole('link', { name: '2 semanas' }),
    ).toHaveAttribute('aria-current', 'page')
  })
})
