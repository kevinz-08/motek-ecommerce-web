# Vendelo — activación de credenciales

Guía para poner en marcha la integración con Venndelo cuando soporte entregue las
credenciales. El código ya está listo: estos pasos solo cargan configuración y
verifican. Contrato de la API: `API_VENDELO_DOCUMENTACION.md`.

## 0. Antes del deploy (una sola vez)

1. Aplicar la migración `20261015120000_vendelo_oauth_and_city_status`:

   ```bash
   pnpm --filter @motek/database exec prisma migrate deploy
   ```

   Crea `VendeloCredential`, agrega cobertura a `VendeloCity`, detalle de
   seguimiento a `Shipment` y el índice `Order.vendeloOrderId`.

2. Generar la clave que cifra los tokens y guardarla en Secret Manager como
   `VENDELO_TOKEN_ENCRYPTION_KEY`:

   ```bash
   openssl rand -base64 32
   ```

   Perderla obliga a pedir un refresh token nuevo a soporte (los tokens en BD
   quedan ilegibles).

## 1. Cargar el refresh token (cuando lo entregue soporte)

Desde `apps/api`, con `DATABASE_URL` y `VENDELO_TOKEN_ENCRYPTION_KEY` de producción:

```bash
VENDELO_REFRESH_TOKEN=<token> pnpm exec tsx scripts/seed-vendelo-refresh-token.ts
```

El script lo guarda cifrado, hace el primer intercambio y verifica contra
`GET /v1/admin/check-auth`. Debe terminar en `✓ Autenticación OK`.

No dejar `VENDELO_REFRESH_TOKEN` en el entorno de Cloud Run: el token rota y
la copia vigente vive en la tabla `VendeloCredential`.

## 2. Activar OAuth en la API

Variables en Cloud Run:

| Variable | Valor |
|---|---|
| `VENDELO_AUTH_MODE` | `oauth` |
| `VENDELO_TOKEN_ENCRYPTION_KEY` | (secreto del paso 0) |
| `VENDELO_API_URL` | `https://api.venndelo.com` |

Redeploy y verificar con un admin: `GET /admin/vendelo/health` → `{"ok":true,"authMode":"oauth",...}`.

Rollback inmediato si algo falla: `VENDELO_AUTH_MODE=apikey` (mientras Venndelo
siga aceptando la API Key).

## 3. Catálogo de ciudades

`POST /admin/vendelo/sync-cities` (admin). La respuesta trae `synced` y
`suspended`; las ciudades suspendidas quedan visibles pero no seleccionables en
el checkout y el dominio rechaza pedidos hacia ellas.

## 4. Webhook (si la cuenta tiene Chatbot Connections habilitadas)

Desde `apps/api`, con las variables de `register-vendelo-webhook.ts`:

```bash
pnpm exec tsx scripts/register-vendelo-webhook.ts --list   # ver conexiones y formato de metadata
pnpm exec tsx scripts/register-vendelo-webhook.ts          # registrar (formato {key, value})
```

Si Venndelo responde `Provider id inválido`, la cuenta no tiene webhooks: no
pasa nada, el polling cubre las transiciones.

Tras el primer evento real, revisar en Cloud Logging la línea
`[VendeloWebhook] Estructura del evento <EVENTO>: ...` (solo claves y tipos) y
confirmar que `parseVendeloWebhook` encuentra `external_order_id` y los envíos.

## 5. Verificación de punta a punta

1. Pedido de prueba pagado → en ≤ 2 min aparece `vendeloOrderId` (cola `VendeloOrderQueue` en `SENT`).
2. `POST /admin/vendelo/create-shipments` → luego `generate-labels` (202 mientras Vendelo procesa, luego PDF).
3. El estado del envío avanza en `/pedidos/seguimiento?token=...` (webhook o polling cada 5 min).
4. Anular un pedido de prueba no despachado desde el admin → queda `CANCELLED` en Motek **y** en Vendelo.

## Pendiente de confirmar con soporte

- Vigencia y política de rotación del refresh token; si el anterior sigue válido unos segundos tras rotar.
- Formato exacto del webhook y si habrá firma HMAC.
- Si `external_order_id` es único (permitiría reintentar un 5xx al crear el pedido).
- Hasta qué estado se puede anular un pedido y si el flete vuelve a la billetera.
- `line_items[].type`: hoy se envía `STANDARD`; el spec lo define como "producto
  previamente creado en Venndelo" (los nuestros no existen allá — quizá corresponde `VIRTUAL`).
