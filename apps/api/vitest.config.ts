import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['reflect-metadata'],
  },
  resolve: {
    alias: {
      '@/domain': path.resolve(__dirname, '../../packages/domain/src'),
    },
  },
})
