# Faltantes de variables de entorno para el primer deploy a producción

> Generado el 2026-08-11. Este documento es un snapshot del estado en esa fecha — antes de
> tomar decisiones sobre él, verificar contra los `.env.example` actuales y el estado real
> de Vercel / Cloud Run / GitHub, ya que puede quedar desactualizado.

Resume qué variables de entorno faltan configurar (o están vacías localmente) para poder
lanzar Motek Store a producción, separado por plataforma: GitHub, Vercel (`apps/web`) y
Google Cloud Platform / Cloud Run (`apps/api`).

## 1. GitHub (Actions / CI-CD)

El workflow actual (`.github/workflows/ci.yml`) solo corre lint, type-check, tests y un
build de validación de `apps/api`. **No hace deploy a ningún lado.** El job de deploy a
Cloud Run fue removido intencionalmente (comentario en el propio workflow: "TODO: pendiente
de configurar para Motek Store — proyecto GCP, Artifact Registry, Workload Identity
Federation y GitHub Secrets propios").

Para automatizar el deploy a Cloud Run vía GitHub Actions hace falta crear estos **repo
secrets** (ninguno existe hoy):

- `GCP_PROJECT_ID`
- Credenciales de auth a GCP — dos opciones:
  - `GCP_SA_KEY` (JSON de service account), o
  - Workload Identity Federation: `GCP_WIF_PROVIDER` + `GCP_SERVICE_ACCOUNT` (recomendado,
    evita manejar llaves JSON de larga duración)
- Región y nombre del servicio Cloud Run (pueden ir hardcodeados en el workflow o como
  secrets, ej. `GCP_REGION`, `GCP_SERVICE_NAME`)

`railway.toml` en la raíz del repo está **obsoleto** — la API migró a Cloud Run, no usar
como referencia.

## 2. Vercel (`apps/web`)

Variables a configurar en Vercel → Settings → Environment Variables. Basado en
`apps/web/.env.example` más variables usadas en código que no están documentadas ahí.

| Variable | Estado local (`.env.local`) | Notas |
|---|---|---|
| `DATABASE_URL` | ✅ configurada | Neon Postgres |
| `DATABASE_POOL_MAX` | opcional (default 5) | bajar a 3-5 en serverless |
| `NEXTAUTH_SECRET` | ✅ configurada en dev | **generar un valor nuevo para prod**, no reusar el de dev |
| `NEXTAUTH_URL` | apunta a localhost | debe apuntar a la URL pública de prod |
| `API_URL` | apunta a localhost | debe apuntar a la URL del servicio Cloud Run |
| `NEXT_PUBLIC_API_URL` | apunta a localhost | idem, pública (bundle de cliente) |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | apuntan a localhost | usadas en sitemap y emails |
| `INTERNAL_API_SECRET` | ✅ configurada | ⚠️ debe ser **idéntico** al `INTERNAL_API_SECRET` de la API |
| `GOOGLE_CLIENT_ID` | ❌ **vacía** | login con Google no funcionará sin esto |
| `GOOGLE_CLIENT_SECRET` | ❌ **vacía** | idem |
| `WOMPI_PUBLIC_KEY` | ✅ configurada | confirmar que sea la llave de **producción**, no sandbox |
| `WOMPI_PRIVATE_KEY` | ✅ configurada | idem |
| `WOMPI_INTEGRITY_SECRET` | ✅ configurada | idem |
| `WOMPI_EVENTS_SECRET` | ✅ configurada | idem |
| `WOMPI_ENV` | ✅ configurada | cambiar de `sandbox` a `production` |
| `MP_ACCESS_TOKEN` | ❌ **vacía** | Mercado Pago — usada en `MercadoPagoService.ts` y `CheckoutForm.tsx`; **no está documentada en `.env.example`** |
| `MP_PUBLIC_KEY` | ❌ **vacía** | idem |
| `MP_WEBHOOK_SECRET` | ❌ **vacía** | idem |
| `RESEND_API_KEY` | ❌ **vacía** | confirmar si el web realmente la necesita en runtime (la API sí la tiene) |
| `RESEND_FROM_EMAIL` | ❌ **vacía** | idem |
| `CLOUDINARY_CLOUD_NAME` | ✅ configurada | |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | ✅ configurada | |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | ✅ configuradas | |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | ✅ configurada | |
| `NEXT_PUBLIC_SENTRY_DSN` | verificar | observabilidad de errores en cliente/servidor |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | opcionales | solo si se quiere subir sourcemaps para stack traces legibles |

## 3. Google Cloud Platform (`apps/api` → Cloud Run)

`apps/api/src/main.ts` corre `assertEnvVars()` al arrancar — **si falta cualquiera de
estas, el proceso muere con exit code 1** (no arranca el servicio):

```
DATABASE_URL
JWT_SECRET
INTERNAL_API_SECRET
WOMPI_PUBLIC_KEY
WOMPI_PRIVATE_KEY
WOMPI_EVENTS_SECRET
WOMPI_INTEGRITY_SECRET
RESEND_API_KEY
VENDELO_API_KEY
VENDELO_WEBHOOK_SECRET
```

Resto de variables según `apps/api/.env.example` y lo que está vacío localmente:

| Variable | Estado local (`.env`) | Notas |
|---|---|---|
| `DATABASE_URL` | ✅ configurada | |
| `DATABASE_POOL_MAX` | opcional (default 5) | |
| `JWT_SECRET` | ✅ configurada | generar valor nuevo para prod |
| `JWT_EXPIRES_IN` | ✅ configurada | |
| `INTERNAL_API_SECRET` | ✅ configurada | ⚠️ debe coincidir con el de Vercel |
| `GOOGLE_CLIENT_ID` | ❌ **vacía** | |
| `GOOGLE_CLIENT_SECRET` | ❌ **vacía** | |
| `WOMPI_PUBLIC_KEY/PRIVATE_KEY/INTEGRITY_SECRET/EVENTS_SECRET` | ✅ configuradas | confirmar que sean de producción |
| `WOMPI_ENV` | ✅ configurada | cambiar a `production` |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | ✅ configuradas | confirmar dominio verificado en Resend |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | ✅ configuradas | |
| `NODE_ENV` | ✅ configurada | debe ser `production` en Cloud Run |
| `PORT` | ✅ configurada | Cloud Run la inyecta automáticamente, no hace falta setearla a mano |
| `FRONTEND_URL` | ✅ configurada | debe apuntar a la URL pública del web en prod |
| `VENDELO_API_KEY` | ✅ configurada | |
| `VENDELO_API_URL` | ✅ configurada | |
| `VENDELO_WEBHOOK_SECRET` | ✅ configurada | |
| `VENDELO_WALLET_ALERT_THRESHOLD` | ✅ configurada (default) | |
| `VENDELO_STORE_NAME` | ❌ **vacía** | bloquea creación de envíos (pickup_info) |
| `VENDELO_STORE_PHONE` | ❌ **vacía** | idem |
| `VENDELO_STORE_ADDRESS` | ❌ **vacía** | idem |
| `VENDELO_STORE_CITY_CODE` | ❌ **vacía** | código DIVIPOLA de 8 dígitos |
| `VENDELO_STORE_SUBDIVISION_CODE` | ❌ **vacía** | idem |
| `VENDELO_DEFAULT_WEIGHT_KG/HEIGHT_CM/WIDTH_CM/LENGTH_CM` | ✅ configuradas (defaults) | |
| `VENDELO_POLL_ENABLED/INTERVAL_MS/BATCH_SIZE/REQUEST_DELAY_MS` | ✅ configuradas (defaults) | |
| `SENTRY_DSN` | ❌ **vacía** | sin observabilidad de errores en prod |
| `MP_ACCESS_TOKEN` | usada en código | **no está en `.env.example`** — usada en `MercadoPagoService.ts` y `orders.controller.ts`; agregar y setear |
| `MP_WEBHOOK_SECRET` | usada en código | idem, no documentada |
| `MAX_SHIPPING_CHARGE_CENTS` | usada en código | **no está en `.env.example`** — usada en la lógica de shipping |

## Resumen — bloqueantes reales para el primer deploy

1. **Credenciales de Google OAuth** (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) — vacías
   en ambos apps. Sin esto, login con Google no funciona.
2. **Credenciales de Mercado Pago** (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`)
   — vacías, y ni siquiera documentadas en los `.env.example` actuales.
3. **Datos de tienda para Vendelo** (`VENDELO_STORE_NAME/PHONE/ADDRESS/CITY_CODE/
   SUBDIVISION_CODE`) — vacíos, bloquean la creación de envíos.
4. **`SENTRY_DSN`** en la API — vacía, sin monitoreo de errores en producción.
5. **`RESEND_API_KEY` / `RESEND_FROM_EMAIL`** en el web — vacías (confirmar si el web
   realmente las necesita en runtime, o si es una variable residual sin uso real).
6. **Toda la configuración de despliegue GCP↔GitHub** — no existe: faltan los secrets de
   auth (`GCP_PROJECT_ID`, WIF o `GCP_SA_KEY`) y el propio job de deploy en `ci.yml`.
7. **URLs de producción** (`NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`,
   `NEXT_PUBLIC_API_URL`, `API_URL`, `FRONTEND_URL`) — todas apuntan a `localhost`
   actualmente, hay que actualizarlas a las URLs reales de Vercel y Cloud Run.
8. **`.env.example` desactualizados** — a ambos les faltan `MP_ACCESS_TOKEN`,
   `MP_PUBLIC_KEY`/`MP_WEBHOOK_SECRET` y `MAX_SHIPPING_CHARGE_CENTS`; conviene
   documentarlas ahí para que el próximo `pnpm install` no deje a nadie adivinando.
