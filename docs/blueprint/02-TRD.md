# TRD — Technical Requirement Document
## Plataforma E-commerce de Repuestos para Motocicletas

| Campo | Valor |
|---|---|
| Documento | TRD v1.0 |
| Complementa | `01-PRD.md` |
| Audiencia | Equipo de ingeniería / agentes de generación de código |
| Estado | Especificación de referencia |

---

## 1. Stack tecnológico recomendado

### 1.1 Selección

| Capa | Tecnología | Versión mínima | Justificación |
|---|---|---|---|
| Gestor de paquetes | **pnpm** (workspaces) | 9.x | Enlaces simbólicos estrictos; evita dependencias fantasma en un monorepo |
| Orquestador de build | **Turborepo** | 2.x | Grafo de tareas con caché; `^build` garantiza orden entre paquetes |
| Lenguaje | **TypeScript** (`strict: true`) | 5.9 | Contrato de tipos entre capas del monorepo |
| Frontend | **Next.js** (App Router) | 16.x | Server Components para SSR de catálogo; caché por etiquetas nativa |
| Runtime UI | **React** | 19.x | Server Components + React Compiler |
| Estilos | **Tailwind CSS** | 4.x | Utilidades + tokens CSS custom; sin runtime CSS-in-JS |
| Backend | **NestJS** | 10.x | Inyección de dependencias por token, guards globales, filtros de excepción |
| ORM | **Prisma** | 7.x | Tipado end-to-end, migraciones versionadas, adaptador driver nativo |
| Base de datos | **PostgreSQL** | 16.x | Transacciones, tipos array nativos, operaciones atómicas |
| Autenticación web | **NextAuth/Auth.js** v5 | 5.x | Estrategia JWT + adaptador de base de datos + OAuth |
| Autenticación API | **JWT** (`@nestjs/jwt` + passport-jwt) | — | Stateless entre web y API |
| Estado cliente | **Zustand** (con `persist`) | 5.x | Carrito en `localStorage`, mínimo boilerplate |
| Validación entrada API | **class-validator** + `ValidationPipe` | — | DTOs declarativos con whitelist estricta |
| Validación cliente/forms | **Zod** | 4.x | Esquemas compartibles con inferencia de tipos |
| Emails | Proveedor transaccional HTTP (tipo Resend) | — | Sin SMTP; API idempotente y con webhooks |
| Imágenes | CDN con transformaciones (tipo Cloudinary) | — | Optimización, `secure_url` + `public_id` para borrado |
| Hash de contraseñas | **bcrypt** (cost 12) | — | Estándar; cost calibrado a ~250 ms |
| Observabilidad | **Sentry** (web + API) | 10.x | Trazas, errores, profiling |
| Gráficos admin | **Recharts** | 3.x | Serie de ingresos en el dashboard |
| Documentos PDF | Renderer React-to-PDF | — | Comprobante de venta |
| Hojas de cálculo | Parser XLSX | — | Sincronización de stock |
| Pruebas unitarias | **Vitest** | 4.x | Rápido, compatible ESM, cobertura integrada |
| Pruebas E2E | **Playwright** | 1.6x | Estado de autenticación reutilizable entre specs |

### 1.2 Restricciones de versión

- Node.js ≥ 20.10 (requerido por Next 16 y por el adaptador de Prisma).
- El cliente de Prisma se genera en tiempo de build y **no** se versiona en Git. Todo comando de build debe ejecutar `db:generate` antes de compilar.

---

## 2. Arquitectura general

### 2.1 Estilo arquitectónico

**Clean Architecture + Domain-Driven Design**, con la regla de dependencia estricta hacia el dominio.

```
                       ┌──────────────────────────┐
                       │      packages/domain     │
                       │  (TypeScript puro, 0 deps)│
                       │  entidades · interfaces  │
                       │  de repositorio · casos  │
                       │  de uso · Result<T,E>    │
                       └───────────▲──────────────┘
                                   │ implementa / consume
              ┌────────────────────┼────────────────────┐
              │                    │                    │
   ┌──────────┴────────┐ ┌─────────┴────────┐ ┌────────┴─────────┐
   │  packages/database│ │     apps/api     │ │     apps/web     │
   │  Prisma + repos   │ │  NestJS (REST)   │ │  Next.js (SSR)   │
   └───────────────────┘ └──────────────────┘ └──────────────────┘
```

**Regla inviolable:** `packages/domain` no importa Prisma, NestJS, Next, ni ninguna librería de infraestructura. Si el dominio necesita hablar con el exterior, define una **interfaz** y la infraestructura la implementa.

### 2.2 Estructura del monorepo

```
.
├── apps/
│   ├── web/                      Next.js — storefront + panel admin
│   │   ├── src/app/
│   │   │   ├── (store)/          Rutas públicas y de cliente
│   │   │   ├── admin/            Panel administrativo
│   │   │   ├── auth/             Login, registro, recuperación
│   │   │   └── api/              Route handlers (auth, revalidate, uploads)
│   │   ├── src/components/       Componentes de UI
│   │   ├── src/lib/              auth, api-client, cart, cache, cache-tags
│   │   ├── src/proxy.ts          Protección de rutas (equivalente a middleware)
│   │   └── e2e/                  Specs Playwright
│   │
│   └── api/                      NestJS — API REST
│       ├── src/<módulo>/         controller + service + dtos por dominio
│       ├── src/infrastructure/
│       │   ├── injection-tokens.ts
│       │   ├── repositories/     Implementaciones de las interfaces del dominio
│       │   └── services/         Email, colas, pasarelas, logística
│       ├── src/common/           Guards, filtros, decoradores, pipes
│       ├── src/instrument.ts     Init de observabilidad (primer import)
│       └── src/main.ts           Bootstrap + validación de entorno
│
└── packages/
    ├── domain/                   Núcleo de negocio, sin dependencias
    │   ├── src/entities/
    │   ├── src/repositories/     Interfaces (puertos)
    │   ├── src/use-cases/
    │   ├── src/shared/Result.ts
    │   └── src/__tests__/
    ├── database/                 Prisma: schema, migraciones, seeds, singleton
    └── types/                    DTOs compartidos web ↔ api
```

### 2.3 Patrones obligatorios

#### 2.3.1 `Result<T, E>` — los casos de uso nunca lanzan

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

interface AppError {
  code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN'
      | 'PAYMENT_ERROR' | 'STOCK_UNAVAILABLE' | 'INTERNAL_ERROR'
  message: string
  details?: unknown
}
```

El filtro global de excepciones de la API mapea cada código a un estado HTTP:

| Código | HTTP |
|---|---|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `STOCK_UNAVAILABLE` | 409 |
| `PAYMENT_ERROR` | 402 |
| `INTERNAL_ERROR` | 500 |

#### 2.3.2 Inyección por símbolo, nunca por clase

```ts
// infrastructure/injection-tokens.ts
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY')

// consumo
constructor(@Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository) {}
```

Motivo: el dominio expone interfaces, no clases. El token de clase acoplaría el módulo HTTP a la implementación de Prisma.

#### 2.3.3 Puerto y adaptador para cada integración externa

Toda pasarela de pago, operador logístico, proveedor de email o CDN se declara como interfaz en el dominio (o en `types`) y se implementa en `apps/api/src/infrastructure/services/`. Cambiar de proveedor debe ser cambiar un módulo, no reescribir casos de uso.

#### 2.3.4 Outbox / cola persistida para efectos secundarios

Ningún efecto secundario no transaccional (email, creación de guía) se ejecuta en línea. Se persiste una fila de cola dentro del mismo flujo, y un worker la procesa:

```
webhook APPROVED ──► [tx] order.status = PAID
                        stock.decrement (atómico)
                        emailQueue.insert(PENDING)
                        shippingQueue.insert(PENDING)
                 ──► responde 200 inmediatamente

worker (cada 2 min) ──► toma filas PENDING con nextRetry <= now
                    ──► procesa; en fallo: attempts++, backoff 5s→30s→120s
                    ──► attempts >= 3 ⇒ FAILED (visible en el panel)
```

El worker de logística marca la fila como `PROCESSING` con `processingStartedAt`; un **sweeper** la devuelve a `PENDING` si supera 5 minutos sin avanzar (protege contra reinicios de contenedor).

### 2.4 Flujos de datos

| Escenario | Ruta | Justificación |
|---|---|---|
| Lectura de catálogo / ficha de producto | Server Component → Prisma directo | Elimina un salto HTTP; permite caché con etiquetas del framework |
| Mutación autenticada (crear pedido, validar cupón) | Client Component → `fetch` con `Bearer` → API → caso de uso → repositorio | Centraliza la lógica de negocio y los guards |
| Operación administrativa | Server Component del panel → API REST con JWT de admin (o secreto interno) | Guard de rol en el servidor, no en el navegador |
| Webhook de tercero | Proveedor → API (endpoint público con verificación de firma) | La API es el único punto que toca dinero y stock |
| Invalidación de caché | Panel → route handler interno → revalidación por etiqueta | Refresco inmediato sin redeploy |

**Regla:** el frontend **nunca** escribe en la base de datos directamente. Solo lee.

### 2.5 Estrategia de caché

Caché de lecturas por etiqueta, con TTL por tipo de dato:

| Dato | TTL | Etiquetas |
|---|---|---|
| Categorías | 3600 s | `categories` |
| Banners del hero | 3600 s | `hero` |
| Productos destacados de home | 300 s | `products`, `home` |
| Listado de catálogo | 300 s | `products`, `catalog`, `categories` |
| Facetas/filtros del catálogo | 180 s | `products`, `catalog`, `categories` |
| Ficha de producto | 300 s | `products` |
| Catálogo de ciudades | 24 h | `cities` |

Las etiquetas se declaran como constantes en un único módulo (`cache-tags`). Toda mutación administrativa dispara una revalidación explícita de las etiquetas afectadas mediante un endpoint interno protegido por sesión de administrador.

---

## 3. Dependencias críticas

### 3.1 Servicios externos

| Servicio | Criticidad | Modo de fallo | Estrategia de degradación |
|---|---|---|---|
| PostgreSQL | **Crítica** | Sitio caído | Pooling + singleton de cliente + réplica de lectura (futuro) |
| Pasarela de pago principal | **Crítica** | Sin ventas en línea | Pasarela de respaldo conmutable por configuración + COD |
| Pasarela de respaldo | Alta | Sin alternativa | Interruptor en panel para desactivarla |
| Operador logístico | Media | Sin guías automáticas | El pedido se completa igual; guía manual desde el panel; flete = 0 si falla la cotización |
| Proveedor de email | Media | Cliente sin confirmación | Cola con 3 reintentos; bandeja de fallidos en el panel |
| CDN de imágenes | Media | Fichas sin foto | Imagen placeholder; el catálogo sigue operativo |
| Observabilidad | Baja | Ceguera operativa | No bloquea nada |

### 3.2 Contratos de integración

**Pasarela de pago principal (modelo redirección + webhook)**
- Firma de integridad calculada en el servidor (SHA-256 sobre referencia + monto + moneda + secreto).
- Webhook validado con SHA-256 sobre las propiedades declaradas por el proveedor + timestamp + secreto de eventos.

**Pasarela de respaldo (modelo preferencia + webhook)**
- Creación de preferencia vía SDK del proveedor.
- Webhook validado con HMAC-SHA256 y **verificación activa**: se consulta el estado real de la transacción contra la API del proveedor antes de confirmar (nunca se confía en el payload).

**Operador logístico**
- `POST` de cotización: origen, destino (código de ciudad oficial), peso, dimensiones → valor del flete.
- `POST` de creación de pedido/guía → identificador externo + número de guía.
- `POST` de generación de etiquetas → URL del PDF.
- `POST` de solicitud de recogida.
- Webhooks entrantes de cambio de estado del envío.
- Sincronización periódica del catálogo de ciudades (códigos oficiales DIVIPOLA).

### 3.3 Variables de entorno

**Obligatorias al arranque de la API** — el proceso debe abortar con código 1 si falta alguna:

```
DATABASE_URL
JWT_SECRET
INTERNAL_API_SECRET
PAYMENT_EVENTS_SECRET
PAYMENT_INTEGRITY_SECRET
```

**Conjunto completo:**

| Variable | Ámbito | Descripción |
|---|---|---|
| `DATABASE_URL` | api, web, database | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | api | Firma de los tokens de la API |
| `JWT_EXPIRES_IN` | api | Vigencia del token (ej. `7d`) |
| `INTERNAL_API_SECRET` | api, web | Handshake servidor-a-servidor (debe coincidir) |
| `AUTH_SECRET` | web | Cifrado de la sesión del framework de auth |
| `AUTH_URL` | web | URL canónica del sitio |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | web, api | OAuth |
| `PAYMENT_PUBLIC_KEY` | web | Clave pública de la pasarela |
| `PAYMENT_INTEGRITY_SECRET` | api | Firma de integridad de la transacción |
| `PAYMENT_EVENTS_SECRET` | api | Validación del webhook |
| `ALT_PAYMENT_ACCESS_TOKEN` | api | Pasarela de respaldo |
| `ALT_PAYMENT_WEBHOOK_SECRET` | api | HMAC del webhook de respaldo |
| `LOGISTICS_API_URL` / `LOGISTICS_API_KEY` | api | Operador logístico |
| `LOGISTICS_WEBHOOK_SECRET` | api | Validación de webhooks logísticos |
| `LOGISTICS_DEFAULT_WEIGHT_KG` | api | Peso por defecto si el producto no lo declara |
| `EMAIL_API_KEY` / `EMAIL_FROM` | api | Proveedor transaccional |
| `CDN_CLOUD_NAME` / `CDN_API_KEY` / `CDN_API_SECRET` | api, web | CDN de imágenes |
| `NEXT_PUBLIC_API_URL` | web | Base de la API para el cliente |
| `SENTRY_DSN` | api, web | Observabilidad |

**Regla:** las variables prefijadas para el cliente solo contienen valores públicos. Ningún secreto viaja al navegador.

---

## 4. Requisitos de rendimiento

### 4.1 Objetivos de nivel de servicio

| Métrica | Objetivo | Medición |
|---|---|---|
| LCP en home y catálogo (móvil 4G) | < 2.5 s | Datos de campo (RUM) |
| INP | < 200 ms | RUM |
| CLS | < 0.1 | RUM |
| Latencia p95 de la API (lecturas) | < 300 ms | Trazas APM |
| Latencia p95 de la API (creación de pedido) | < 800 ms | Trazas APM |
| Respuesta a webhook de pago | < 500 ms | El worker asume el trabajo pesado |
| Disponibilidad mensual | ≥ 99.5 % | Health check externo |
| Arranque en frío de la API | < 3 s | Métrica de la plataforma serverless |

### 4.2 Estrategias

**Base de datos**
- Índices compuestos alineados a los filtros reales, no especulativos:
  - `(categoryId, isActive, stock)` — filtro dominante del catálogo.
  - `(isActive, createdAt)` — listados por novedad.
  - `(deletedAt)` — exclusión de soft-deleted y vista de papelera.
  - `(status, createdAt)` en pedidos — panel y agregaciones de ingresos.
  - `(status, nextRetry)` en las colas — barrido del worker.
- Cliente de base de datos **singleton** vía `globalThis` para evitar agotar el pool en desarrollo con hot reload.
- Paginación obligatoria en todo listado; nunca `findMany` sin `take`.
- Selección explícita de campos en listados (no traer descripciones completas para una grilla).

**Frontend**
- Server Components por defecto; componentes cliente solo donde hay interactividad (carrito, filtros, formularios).
- Caché por etiqueta con revalidación dirigida en lugar de TTL corto global.
- Imágenes servidas por CDN con transformación de tamaño y formato moderno; `priority` únicamente en el LCP.
- Compilador de React habilitado para memoización automática.
- División de código: el panel administrativo nunca entra en el bundle del storefront.

**API**
- Compresión de respuestas habilitada.
- Rate limiting global (100 req/min por IP), con límites más estrictos en autenticación y validación de cupones.
- Los webhooks responden inmediatamente y delegan a colas.

### 4.3 Escalabilidad

- La API es **stateless**: escala horizontalmente sin afinidad de sesión.
- Los workers de cola son idempotentes y usan reclamo de fila (`PROCESSING` + timestamp) para tolerar múltiples instancias.
- El frontend escala en la capa de CDN del proveedor de hosting.
- Cuello de botella esperado: conexiones a la base de datos. Mitigación: pooling y caché de lecturas.

---

## 5. Requisitos de seguridad

### 5.1 Autenticación

| Flujo | Mecanismo |
|---|---|
| Credenciales | El framework de auth delega en la API (`POST /auth/login`) → la API devuelve un JWT propio que se guarda en la sesión como `accessToken` |
| OAuth (Google) | El adaptador crea el usuario → en el callback de JWT se llama `POST /auth/session-token` con el header de secreto interno → devuelve el JWT de la API |
| Verificación de email | OTP de 6 dígitos, almacenado como SHA-256, expiración 10 min, máximo 5 intentos |
| Recuperación de contraseña | Token aleatorio de alta entropía, almacenado como SHA-256, un solo uso, expiración corta |

**Forma de la sesión:** `{ user: { id, role, accessToken } }`. El `accessToken` viaja como `Authorization: Bearer` hacia la API.

### 5.2 Autorización — defensa en profundidad

Tres capas independientes protegen el área administrativa. Ninguna confía en la anterior:

1. **Proxy/middleware de rutas** — redirige a los no administradores antes de renderizar.
2. **Layout del panel en el servidor** — verifica la sesión y renderiza 403 si el rol no corresponde.
3. **Guard de rol en la API** — rechaza la petición aunque las dos capas anteriores fueran evadidas.

Guards globales de la API, en orden: rate limiting → autenticación JWT (con decorador de exclusión explícita para rutas públicas) → roles.

**Regla:** las rutas públicas se declaran con un decorador explícito. El estado por defecto de cualquier endpoint nuevo es *protegido*.

### 5.3 Validación de entrada

- Pipe de validación global con `whitelist: true` y `forbidNonWhitelisted: true`: cualquier campo no declarado en el DTO provoca un 400. Esto bloquea *mass assignment* por diseño.
- Transformación de tipos activada, con conversión implícita deshabilitada donde el tipo importe (montos).
- Los identificadores de recurso se validan como CUID/UUID antes de tocar la base de datos.

### 5.4 Protección de webhooks

| Requisito | Implementación |
|---|---|
| Autenticidad | Verificación de firma criptográfica antes de cualquier efecto secundario |
| Comparación segura | Comparación en tiempo constante de las firmas |
| Idempotencia | Se consulta el estado actual del pedido; si ya está confirmado, se responde 200 sin actuar |
| Anti-replay | Se incluye el timestamp del proveedor en el cálculo de la firma |
| Verificación activa | En la pasarela de respaldo, se consulta el estado real vía API antes de confirmar |
| Cuerpo crudo | El endpoint recibe el body sin parsear cuando la firma se calcula sobre el raw payload |

### 5.5 Datos y privacidad

- Contraseñas con bcrypt cost 12. Nunca en logs, respuestas ni errores.
- OTP y tokens de recuperación almacenados hasheados.
- Los secretos jamás se exponen al cliente ni se registran en trazas (scrubbing configurado en la herramienta de observabilidad).
- Cumplimiento Ley 1581/2012 (Colombia):
  - `acceptedTermsAt` + `acceptedTermsVersion` en el usuario.
  - `policiesAcceptedAt` inmutable en cada pedido (evidencia para disputas).
  - `marketingConsent` como campo **independiente**, opcional, nunca preseleccionado.
- Los datos de tarjeta **nunca** tocan la infraestructura propia: la captura ocurre íntegramente en la pasarela.

### 5.6 Endurecimiento de la superficie HTTP

- Cabeceras de seguridad estándar (CSP, HSTS, X-Content-Type-Options, Referrer-Policy) mediante middleware de seguridad.
- CORS restringido a los orígenes del frontend en producción.
- Rate limiting diferenciado: global 100 req/min; login y registro más estrictos; validación de cupón limitada para impedir fuerza bruta sobre códigos.
- El endpoint de documentación de la API se expone **solo** en entornos no productivos.
- La subida de imágenes valida tipo MIME, extensión y tamaño máximo antes de enviar al CDN.

### 5.7 Checklist de seguridad previo a producción

- [ ] `assertEnvVars()` aborta el arranque ante secretos faltantes.
- [ ] Ningún endpoint queda público por omisión.
- [ ] Todos los webhooks verifican firma.
- [ ] Los guards de rol están aplicados en cada controlador administrativo.
- [ ] Documentación de API deshabilitada en producción.
- [ ] Secretos rotables y almacenados en el gestor de secretos de la nube, no en el repositorio.
- [ ] Dependencias auditadas sin vulnerabilidades críticas.

---

## 6. Estrategia de pruebas

| Capa | Herramienta | Alcance | Umbral |
|---|---|---|---|
| Dominio | Vitest | Casos de uso con repositorios simulados; toda regla de negocio | 80 % líneas/funciones/sentencias, 70 % ramas |
| API | Vitest | Servicios de infraestructura: firmas de webhook, backoff de colas, mapeo de errores | Sin umbral formal; obligatorio para lógica crítica |
| E2E | Playwright | Autenticación, catálogo, carrito, checkout | Flujos críticos, ejecutados en CI |

- Los tests de E2E de checkout dependen de un proyecto de *setup* que persiste el estado de autenticación en disco y lo reutiliza; no se repite el login en cada spec.
- La suite de dominio debe poder ejecutarse **sin base de datos, sin red y sin variables de entorno**. Si un test de dominio necesita infraestructura, la arquitectura está rota.

---

## 7. Estrategia de despliegue e infraestructura

### 7.1 Topología

```
                       ┌──────────────────┐
   Navegador ─────────►│  Frontend (edge  │
                       │  + Node runtime) │
                       │  Next.js         │
                       └───┬──────────┬───┘
                           │ SSR      │ fetch (Bearer JWT)
                           │ directo  │
                           ▼          ▼
                    ┌────────────┐  ┌──────────────────┐
                    │ PostgreSQL │◄─┤  API contenerizada│
                    │ gestionado │  │  NestJS (autoscale)│
                    └────────────┘  └───┬───────────┬──┘
                                        │           │
                        webhooks entrantes    llamadas salientes
                                        │           │
                              ┌─────────┴───┐  ┌────┴──────────┐
                              │ Pasarelas   │  │ Logística/CDN │
                              │ de pago     │  │ Email         │
                              └─────────────┘  └───────────────┘
```

- **Frontend:** plataforma de hosting con soporte nativo del framework (CDN global + funciones de servidor).
- **API:** contenedor en plataforma serverless de contenedores, con escalado automático y `PORT` inyectado por el entorno.
- **Base de datos:** PostgreSQL gestionado con pooling.
- **Assets:** CDN de imágenes externo.

### 7.2 Empaquetado de la API

Dockerfile multi-etapa (base → deps → builder → runner):
1. **base:** imagen Node LTS slim, habilitación del gestor de paquetes.
2. **deps:** instalación con lockfile congelado, aprovechando la caché de capas.
3. **builder:** generación del cliente ORM + compilación de la API a un bundle.
4. **runner:** imagen mínima, usuario sin privilegios, solo el artefacto compilado y las dependencias de runtime.

**Detalle crítico:** el empaquetador de la API debe tener los paquetes internos del monorepo en la lista de módulos a *incluir en el bundle*. Si se tratan como externos, el runtime intentará resolver TypeScript sin compilar y el contenedor fallará al arrancar.

### 7.3 Comandos de build

| Destino | Comando |
|---|---|
| Frontend | `pnpm install --frozen-lockfile && pnpm --filter database generate && pnpm --filter web build` |
| API | `pnpm db:generate && pnpm --filter api build` → salida en `dist/main.js` |
| Migraciones (producción) | `pnpm --filter database exec prisma migrate deploy` |

**Orden obligatorio:** generar el cliente ORM antes de cualquier build o arranque en desarrollo. El cliente generado está en `.gitignore`.

### 7.4 Pipeline de CI/CD

```
push / pull request
  ├─ install (con caché de pnpm)
  ├─ generate (cliente ORM)
  ├─ lint
  ├─ type-check
  ├─ test:domain  (con umbral de cobertura)
  ├─ test:api
  ├─ build (web + api)
  └─ e2e (Playwright, servidor levantado por la configuración de tests)

merge a rama principal
  ├─ migrate deploy   (paso manual aprobado o automático con revisión)
  ├─ deploy api       (build de imagen + despliegue de revisión)
  └─ deploy web       (build + promoción)
```

Reglas:
- Las migraciones se aplican **antes** de desplegar el código que las requiere, y deben ser retrocompatibles con la versión anterior (expandir → migrar → contraer).
- Despliegue de la API con revisión gradual y capacidad de rollback inmediato.

### 7.5 Configuración de entornos

| Entorno | Base de datos | Pasarelas | Documentación API |
|---|---|---|---|
| Local | Instancia de desarrollo | Modo sandbox | Habilitada |
| Staging | Rama de base de datos aislada | Modo sandbox | Habilitada |
| Producción | Instancia principal con backups | Producción | **Deshabilitada** |

Se requieren tres archivos de entorno en local (frontend, API y paquete de base de datos), todos con la cadena de conexión, y el secreto interno idéntico entre frontend y API.

### 7.6 Observabilidad y operación

| Necesidad | Implementación |
|---|---|
| Salud del servicio | `GET /health` público, usado por el orquestador |
| Errores | Captura automática en web y API, con filtrado de datos sensibles |
| Trazas | Instrumentación inicializada como **primer import** del proceso de la API |
| Métricas de negocio | Dashboard administrativo (ingresos, pedidos, stock bajo) |
| Salud de las colas | Bandeja de emails fallidos y de excepciones de envío en el panel |
| Alertas | Tasa de error > 1 %, latencia p95 degradada, colas con acumulación de estados fallidos |

**Runbooks mínimos a documentar:** webhook de pago no recibido; cola de guías atascada; agotamiento del pool de conexiones; rotación de secretos de pasarela.

### 7.7 Respaldo y recuperación

- Backups automáticos diarios de la base de datos con retención mínima de 7 días y recuperación a punto en el tiempo.
- Objetivo de recuperación: RPO ≤ 1 h, RTO ≤ 4 h.
- Las imágenes residen en el CDN externo; su ciclo de vida se gestiona por `public_id` para evitar huérfanos al eliminar o reemplazar recursos.

---

## 8. Deuda técnica a evitar desde el inicio

| Antipatrón | Consecuencia | Alternativa correcta |
|---|---|---|
| Importar el ORM dentro del dominio | El dominio deja de ser testeable sin base de datos | Interfaz de repositorio + implementación en infraestructura |
| Enviar emails dentro del webhook | Timeout del webhook, reintento del proveedor, emails duplicados | Cola persistida + worker |
| Descontar stock al crear el pedido | Inventario fantasma por carritos abandonados | Descuento atómico solo al confirmar pago |
| Usar `float` para dinero | Errores de redondeo acumulativos | Enteros en centavos |
| Borrado físico de productos | Pedidos históricos con referencias rotas | Soft delete |
| Confiar en el retorno del navegador para confirmar el pago | Pedidos falsamente confirmados | El webhook firmado es la única fuente de verdad |
| Instanciar el cliente ORM por petición | Agotamiento del pool | Singleton global |
| Validar cupones solo en el cliente | Descuentos arbitrarios | Revalidación en el servidor al crear el pedido |
