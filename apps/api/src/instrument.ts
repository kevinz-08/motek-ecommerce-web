import * as Sentry from '@sentry/nestjs'

// Must be the first import in main.ts — initializes Sentry before any other module loads.
// If SENTRY_DSN is not set, Sentry runs in no-op mode (zero overhead).
Sentry.init({
  dsn: process.env['SENTRY_DSN'],
  environment: process.env['NODE_ENV'] ?? 'development',
  // 10% of traces in production to keep within free quota; 100% in dev for visibility
  tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
  enabled: !!process.env['SENTRY_DSN'],
})
