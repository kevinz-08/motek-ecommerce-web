import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Configura el estado de autenticación antes de correr los tests que lo necesitan
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },
    // Crea la sesión ADMIN para los specs del panel
    {
      name: 'admin-setup',
      testMatch: /admin-setup\.ts/,
    },
    // Tests públicos — sin sesión
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /[\\/](checkout|admin-dashboard)\.spec\.ts$/,
    },
    // Tests autenticados — dependen del setup
    {
      name: 'chromium-auth',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      // Anclado con separador de ruta: sin él, este patrón también capturaría
      // `guest-checkout.spec.ts`, que debe correr SIN sesión.
      testMatch: /[\\/]checkout\.spec\.ts$/,
      dependencies: ['setup'],
    },
    // Panel admin — depende de una sesión con rol ADMIN
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      testMatch: /admin-dashboard\.spec\.ts/,
      dependencies: ['admin-setup'],
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
