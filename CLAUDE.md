# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@AUDITORIA.md

## Documentación obligatoria de cambios (HISTORIAL_TECNICO.md)

**Regla obligatoria:** cualquier cambio de código (fix, feature, refactor, cambio de config/env, migración, etc.) hecho en este repo **debe** quedar registrado en `HISTORIAL_TECNICO.md` antes de dar la tarea por terminada. Esto aplica sin excepción, incluso para cambios que parezcan pequeños.

Formato de cada entrada (ver plantilla al inicio del archivo):

```md
## YYYY-MM-DD — Título corto del cambio

**Problema/Motivo:** por qué se hizo el cambio.

**Cambios:**

- `ruta/al/archivo.ts` — qué se modificó.

**Verificación:** cómo se comprobó que funciona.
```

- Usar la fecha real (ver `currentDate` del contexto de sesión), formato `YYYY-MM-DD`.
- Cada entrada nueva se agrega al final del archivo (orden cronológico ascendente).
- No editar ni reescribir entradas anteriores — solo agregar.
- Si una tarea toca varios archivos relacionados, una sola entrada agrupando todos los cambios es suficiente; no crear una entrada por archivo.
- Cambios puramente exploratorios que no modifican el repo (lectura de código, diagnóstico sin aplicar fix) no requieren entrada — solo se documentan cambios reales aplicados.

## Testing

> **Note:** AGENTS.md says "No tests" — that is outdated. Tests now exist across three layers.

| Layer | Runner | Command |
|-------|--------|---------|
| Domain unit tests | Vitest | `pnpm --filter @motek/domain test` |
| API unit tests | Vitest | `pnpm --filter @motek/api test` |
| E2E (web) | Playwright | `pnpm --filter @motek/web exec playwright test` |
| Single unit file | Vitest | `pnpm --filter @motek/domain exec vitest run src/__tests__/ConfirmPayment.test.ts` |
| Domain coverage | Vitest | `pnpm --filter @motek/domain exec vitest run --coverage` |

Coverage thresholds are enforced in `packages/domain/vitest.config.ts` (80 % lines/functions/statements, 70 % branches). The API vitest config has no coverage configured yet.

E2E specs live in `apps/web/e2e/` (auth, cart, catalog, checkout). `checkout.spec.ts` depends on a `setup` project that writes auth state to `playwright/.auth/user.json`. Run `pnpm dev` before running Playwright locally; CI starts the server automatically via `webServer`.

## Architecture: Clean Architecture + DDD

The project follows Clean Architecture strictly. Dependency direction: `apps/* → packages/domain ← packages/database`.

```
packages/domain        Pure TS — entities, repository interfaces, use cases, Result<T,E>
packages/database      Prisma 7 — implements domain repository interfaces
apps/api               NestJS — HTTP layer, wires domain use cases via DI
apps/web               Next.js 16 — SSR reads Prisma directly; mutations go through NestJS
```

**Never** import `@motek/database` (Prisma) inside `packages/domain`. Domain is infrastructure-free by design.

## Data Flow Patterns

**SSR reads (catalog, product pages):** Server Component → `{ prisma }` from `@motek/database` → direct DB query. No HTTP round-trip to NestJS.

**Authenticated mutations (checkout, orders):** Client Component → `fetch('/api/...')` with Bearer JWT → NestJS → domain use case → Prisma repository.

**Admin operations:** `apps/web/src/app/admin/` Server Components → NestJS REST (with `x-internal-secret` or ADMIN JWT) → `@Roles('ADMIN')` guards.

## Key File Map

| Concern | File |
|---------|------|
| Auth config (NextAuth v5) | `apps/web/src/lib/auth.ts` |
| Route protection (proxy) | `apps/web/src/proxy.ts` (solo `/admin/*`) |
| Guest checkout (API) | `apps/api/src/orders/guest-orders.controller.ts` |
| Captcha (Turnstile) | `apps/api/src/infrastructure/services/TurnstileService.ts` |
| Seguimiento sin sesión | `apps/web/src/app/(store)/pedidos/seguimiento/page.tsx` |
| API HTTP client factory | `apps/web/src/lib/api-client.ts` |
| Cart state (Zustand) | `apps/web/src/lib/cart.ts` |
| NestJS DI symbols | `apps/api/src/infrastructure/injection-tokens.ts` |
| Domain entities | `packages/domain/src/entities/` |
| Domain use cases | `packages/domain/src/use-cases/` |
| Result<T,E> + AppError | `packages/domain/src/shared/Result.ts` |
| Prisma schema | `packages/database/prisma/schema.prisma` |
| Cache functions + TTLs | `apps/web/src/lib/cache.ts` |
| Cache tag constants | `apps/web/src/lib/cache-tags.ts` |
| Admin cache invalidation | `apps/web/src/app/api/admin/revalidate/route.ts` |
| Email retry queue | `apps/api/src/infrastructure/services/EmailQueueService.ts` |
| NestJS health check | `apps/api/src/app.controller.ts` (`GET /health`) |
| Sitemap (dynamic) | `apps/web/src/app/sitemap.ts` |
| Sentry config (web) | `apps/web/sentry.{client,server,edge}.config.ts` |
| Sentry init (API) | `apps/api/src/instrument.ts` |

## Domain Layer Patterns

**Result type** — use cases never throw; they return `Result<T, AppError>`:
```ts
import { ok, err, Result } from '@motek/domain'
// AppError codes: NOT_FOUND | VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN
//                 PAYMENT_ERROR | STOCK_UNAVAILABLE | INTERNAL_ERROR
```
The NestJS `HttpExceptionFilter` maps these codes to HTTP status codes.

**Repository injection** — always inject via Symbol, never class token:
```ts
constructor(@Inject(PRODUCT_REPOSITORY) private repo: IProductRepository) {}
```

## Email Queue Pattern

Confirmation emails are **never** sent inline. After a payment webhook succeeds, `EmailQueueService.enqueue(to, orderId)` writes a row to the `EmailQueue` Prisma table. A `setInterval` in `EmailQueueService` (every 2 min) polls for `PENDING` rows and calls `ResendEmailService`. Retries: max 3 attempts with backoff of 5 s → 30 s → 120 s. Failed entries reach status `FAILED` and stay in the DB.

This pattern replaces the old fire-and-forget `.catch()` approach. Never revert to sending emails directly in a webhook handler.

## Cache Invalidation Pattern

Admin mutations in Next.js call `POST /api/admin/revalidate` with `{ tags: string[] }` (requires ADMIN session). This calls `revalidateTag` for each tag, invalidating all `unstable_cache` entries tagged with it.

Use `CACHE_TAGS` constants from `apps/web/src/lib/cache-tags.ts`:
```ts
import { CACHE_TAGS } from '@/lib/cache'
// Tags: products | categories | home | catalog
```

## Startup Validation

`apps/api/src/main.ts` calls `assertEnvVars()` on bootstrap. If any of `DATABASE_URL`, `JWT_SECRET`, `INTERNAL_API_SECRET`, `WOMPI_EVENTS_SECRET`, or `WOMPI_INTEGRITY_SECRET` are missing, the process exits with code 1. Do not remove this check.

## Stock & Payment Patterns

- Stock is **not** decremented on order creation — only when a payment webhook fires `APPROVED`.
- `decrementStock(id, quantity)` is atomic; safe for concurrent webhooks.
- Both Wompi and Mercado Pago webhooks are idempotent — `ConfirmPayment` checks `order.status` before acting.
- Wompi: SHA-256 signature. Mercado Pago: HMAC-SHA256 + extra API call to fetch transaction status.

## Price Convention

All prices are integers (centavos COP). **Never** use floats for money.

```ts
// Display
(price / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })
// Store
Math.round(parseFloat(input) * 100)
```

## Guest Checkout

La compra sin registro convive con el flujo autenticado; **ninguna** de las dos rutas
comparte handler con la otra.

- `Order.userId` es nullable. Un pedido pertenece a un `User` **o** a un
  `GuestCustomer`, nunca a ambos — lo garantiza el CHECK `order_owner_exclusive`
  (SQL crudo; Prisma no gestiona constraints CHECK).
- `Order.contactEmail` está **siempre** presente. Webhooks, `EmailQueueService` y
  `VendeloService` lo leen de ahí: no hacer join a `User` para obtener el email.
- `Order.trackingToken` (32 bytes base64url) es una **credencial**. Solo sale en la
  respuesta de `POST /orders/guest` y en el correo. Nunca en listados, logs, ni en
  props de Client Components (se serializan en el payload RSC).
- **COD y cupones restringidos exigen cuenta.** Las reglas viven en el dominio
  (`CreateOrder` paso 0, `ValidateCoupon`), no en el controlador, para que valgan
  en cualquier caller.
- Un pedido de invitado se vincula a una cuenta solo con propiedad del email
  probada: login explícito (`POST /orders/claim`) o verificación de OTP al
  registrarse. Nunca automáticamente en el checkout.
- Kill-switch: `Settings.GUEST_CHECKOUT_ENABLED`, **default `false`**.
- Captcha obligatorio (Cloudflare Turnstile), fail-closed.

## Authentication Flow

1. **Credentials:** NextAuth `authorize()` → `POST /auth/login` (NestJS) → returns NestJS JWT stored in session as `accessToken`.
2. **Google OAuth:** PrismaAdapter creates user → NextAuth `jwt` callback → `POST /auth/session-token` with `x-internal-secret` header → fetches NestJS JWT.

Session shape: `{ user: { id, role, accessToken } }`. The `accessToken` is sent as `Authorization: Bearer` to NestJS.

## Admin Protection (triple-layer)

1. `proxy.ts` — redirects non-ADMIN users before the route renders.
2. `apps/web/src/app/admin/layout.tsx` — server-side session check, renders 403 if role missing.
3. NestJS `@Roles('ADMIN')` guard — rejects requests even if the first two are bypassed.
