# Despliegue a producción

Guía del primer lanzamiento de Motek Store.

> **Secretos de producción:** `C:\Users\pagin\VSC-Business\motek-deploy\` — junto al repo pero
> **fuera de git** a propósito (`api.env.production`, `api.env.yaml`, `web.env.production`).
> Nunca moverla dentro del repositorio. Estado de partida y pendientes:
`docs/faltantes-deploy.md`. Vendelo: `docs/vendelo-activacion.md`.

| Pieza | Dónde | Identificador |
|---|---|---|
| API (NestJS) | Cloud Run | proyecto `motek-app-web`, región `us-east5`, servicio `motek-api` |
| Imágenes | Artifact Registry | `us-east5-docker.pkg.dev/motek-app-web/motek/motek-api` |
| Secretos | Secret Manager | uno por variable de `C:\Users\pagin\VSC-Business\motek-deploy\api.env.production` |
| Web (Next.js) | Vercel | dominio `www.tiendamotek.com` |
| Base de datos | Neon | rama principal = producción; rama `dev` = desarrollo local |

Región `us-east5` (Ohio): la más cercana a la base de Neon (`aws us-east-2`, Ohio).

> **Cuenta de gcloud:** usar siempre `--account=motekdev@gmail.com --project=motek-app-web`.
> La cuenta activa por defecto en este equipo es de otro proyecto (H2R).

---

## Fase 1 — Base de datos (Neon)

1. **Respaldo.** En la consola de Neon, crear una rama `respaldo-prelanzamiento` desde la
   rama principal (copia instantánea; permite volver atrás si algo sale mal).
2. **Rama de desarrollo.** Crear una rama `dev` desde la principal y poner su URL de
   conexión en `packages/database/.env`, `apps/api/.env` y `apps/web/.env.local`. Desde
   aquí, el desarrollo local deja de escribir sobre producción.
3. **Limpiar pedidos de prueba** (contra la rama principal):

   ```bash
   # simulación: lista lo que se borraría
   pnpm --filter @motek/database exec tsx prisma/limpiar-pedidos-prueba.ts
   # borrado real
   pnpm --filter @motek/database exec tsx prisma/limpiar-pedidos-prueba.ts --confirmar
   ```

   Luego: anular en el panel de Vendelo los pedidos de prueba que llegaron allá, y
   resincronizar el stock real desde `/admin` (los pagos de prueba descontaron unidades).
4. **Migraciones:**

   ```bash
   pnpm --filter @motek/database exec prisma migrate deploy
   ```

## Fase 2 — API en Cloud Run

```bash
G="--account=motekdev@gmail.com --project=motek-app-web"
REGION=us-east5
```

1. **Repositorio de imágenes** (una sola vez):

   ```bash
   gcloud artifacts repositories create motek --repository-format=docker --location=$REGION $G
   ```

2. **Secretos** (una sola vez; para actualizar uno: `gcloud secrets versions add NOMBRE --data-file=-`).
   Se crea un secreto por cada variable con valor de `C:\Users\pagin\VSC-Business\motek-deploy\api.env.production`
   (las vacías se omiten). La cuenta de servicio de Cloud Run necesita
   `roles/secretmanager.secretAccessor`.

3. **Build** (Cloud Build, no requiere Docker local):

   ```bash
   TAG=$(git rev-parse --short HEAD)
   gcloud builds submit --config cloudbuild.api.yaml \
     --substitutions=_IMAGE=$REGION-docker.pkg.dev/motek-app-web/motek/motek-api:$TAG $G .
   ```

4. **Deploy** (escala a cero: sin tráfico no hay instancias encendidas):

   ```bash
   # --set-secrets: uno por secreto creado en el paso 2 (NOMBRE=NOMBRE:latest, separados por coma)
   gcloud run deploy motek-api $G --region=$REGION \
     --image=$REGION-docker.pkg.dev/motek-app-web/motek/motek-api:$TAG \
     --env-vars-file=C:/Users/pagin/VSC-Business/motek-deploy/api.env.yaml \
     --set-secrets=DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest \
     --min-instances=0 --max-instances=3 \
     --cpu=1 --memory=512Mi --allow-unauthenticated
   ```

   `api.env.yaml` debe incluir `BACKGROUND_JOBS_MODE: "scheduler"` y Secret Manager el
   secreto `CRON_SECRET`.

5. **Verificación:** `curl https://<url-cloud-run>/health`. Para probar una tarea a mano con
   curl hay que enviar cuerpo (`-d ''`): el balanceador de Google responde 411 a un POST sin
   `Content-Length`.

   URL de producción: `https://motek-api-995699039803.us-east5.run.app`.

6. **Tareas programadas (Cloud Scheduler).** Con `BACKGROUND_JOBS_MODE=scheduler` la API no
   programa timers: las colas y el polling se disparan desde Cloud Scheduler con
   `POST /internal/jobs/:job` y la cabecera `x-cron-secret`. El endpoint responde cuando la
   tarea termina, así que corre con CPU aunque Cloud Run esté en modo "CPU solo durante
   peticiones". Habilitar la API una vez: `gcloud services enable cloudscheduler.googleapis.com $G`.
   Cloud Scheduler no existe en `us-east5`: las tareas viven en `us-east1` (solo es el origen
   del disparo; la API sigue en `us-east5`).

   ```bash
   URL=https://<url-cloud-run>
   CRON=$(grep '^CRON_SECRET=' C:/Users/pagin/VSC-Business/motek-deploy/api.env.production | cut -d= -f2-)
   crear() {  # nombre, cron, job
     gcloud scheduler jobs create http "motek-$1" $G --location=us-east1 \
       --schedule="$2" --time-zone="America/Bogota" \
       --uri="$URL/internal/jobs/$3" --http-method=POST \
       --headers="x-cron-secret=$CRON,Content-Type=application/json" --message-body='{}'        --attempt-deadline=300s --max-retry-attempts=2
   }
   crear vendelo-orders  "*/2 * * * *"  vendelo-orders
   crear emails          "*/2 * * * *"  emails
   crear shipments       "*/10 * * * *" shipments
   crear wompi-reconcile "*/15 * * * *" wompi-reconcile
   crear expired-orders  "0 * * * *"    expired-orders
   crear vendelo-wallet  "0 8 * * *"    vendelo-wallet
   ```

   | Tarea | Cada | Qué hace |
   |---|---|---|
   | `vendelo-orders` | 2 min | Envía a Vendelo los pedidos pagados |
   | `emails` | 2 min | Envía los correos de confirmación |
   | `shipments` | 10 min | Sincroniza el estado de los envíos |
   | `wompi-reconcile` | 15 min | Confirma pagos cuyo webhook de Wompi no llegó |
   | `expired-orders` | 1 h | Cancela pedidos sin pagar de más de 2 h |
   | `vendelo-wallet` | 8:00 diario | Alerta si el saldo de Vendelo está bajo |

   Probar una tarea a mano: `gcloud scheduler jobs run motek-emails $G --location=us-east1`.
   `VENDELO_POLL_ENABLED` debe ser `"true"` en `api.env.yaml`: con `false` la tarea
   `shipments` no hace nada y los estados de envío no se actualizan.

   Costo: las peticiones caen dentro de la capa gratuita de Cloud Run; Cloud Scheduler
   cobra USD 0,10/mes por tarea después de las 3 primeras (≈ USD 0,30/mes). Efecto
   secundario útil: los disparos cada 2 min mantienen una instancia tibia la mayor parte
   del tiempo, así que los clientes casi nunca esperan un arranque en frío.

## Fase 3 — Web en Vercel

1. Importar el repositorio en Vercel (proyecto nuevo `motek-store`). Root Directory:
   la raíz del repo (usa `vercel.json`).
2. Variables de entorno de producción: las de `C:\Users\pagin\VSC-Business\motek-deploy\web.env.production`, con
   `API_URL` y `NEXT_PUBLIC_API_URL` = URL de Cloud Run (paso 2.5).
3. Dominio: agregar `tiendamotek.com` y `www.tiendamotek.com` (redirigir el apex a `www`)
   y crear los registros DNS que indique Vercel.
4. Verificar que `FRONTEND_URL` de la API sea exactamente `https://www.tiendamotek.com`
   (CORS de producción solo acepta ese origen).

## Fase 4 — Integraciones

| Servicio | Configuración |
|---|---|
| Wompi (producción) | URL de eventos: `https://<url-cloud-run>/payments/wompi/webhook` |
| Google Cloud Console (OAuth) | Origen `https://www.tiendamotek.com`; redirección `https://www.tiendamotek.com/api/auth/callback/google` |
| Resend | Verificar el dominio `tiendamotek.com` (registros DNS) para enviar desde `pedidos@tiendamotek.com` |

## Fase 5 — Pruebas finales

1. Admin → `POST /admin/vendelo/sync-cities` (o el botón equivalente) y `GET /admin/vendelo/health`.
2. Compra real pequeña con Wompi → el pedido pasa a pagado, llega el correo y en ≤ 2 min
   aparece en Vendelo.
3. Pedido contra entrega con una cuenta.
4. Anular un pedido no despachado desde el admin → queda anulado en Motek y en Vendelo.
5. Revisar el seguimiento en `/pedidos/seguimiento`.

## Después del lanzamiento

- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` para monitoreo de errores.
- `TURNSTILE_SECRET_KEY` antes de activar el checkout de invitado.
- Migrar Vendelo a OAuth cuando soporte entregue el refresh token (`docs/vendelo-activacion.md`).
- Automatizar el deploy en `ci.yml` (hoy es manual).
