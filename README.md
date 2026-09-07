# ⚡ Motek Store — E-commerce de Repuestos para Motos

[![CI](https://github.com/kevinz-08/motek-store/actions/workflows/ci.yml/badge.svg)](https://github.com/kevinz-08/motek-store/actions/workflows/ci.yml)

E-commerce completo para una tienda de motos colombiana. Permite a los clientes comprar
repuestos en línea con pago a través de **Wompi** (principal) o **Mercado Pago** (respaldo),
despacho logístico integrado con **Vendelo**, y confirmaciones automáticas por correo
electrónico. Los administradores gestionan productos, pedidos y stock desde un panel dedicado.

---

## Tabla de contenidos

1. [Stack tecnológico](#1-stack-tecnológico)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Estructura del monorepo](#3-estructura-del-monorepo)
4. [Flujo de datos general](#4-flujo-de-datos-general)
5. [Esquema de base de datos](#5-esquema-de-base-de-datos)
6. [Flujo de autenticación](#6-flujo-de-autenticación)
7. [Flujo de pago con Wompi](#7-flujo-de-pago-con-wompi)
8. [Flujo de pago con Mercado Pago](#8-flujo-de-pago-con-mercado-pago)
9. [Integración de despacho con Vendelo](#9-integración-de-despacho-con-vendelo)
   - [9.1 Pago contra entrega (COD)](#91-pago-contra-entrega-cod)
10. [Servicios de background (colas y reconciliación)](#10-servicios-de-background-colas-y-reconciliación)
11. [API NestJS — Referencia completa](#11-api-nestjs--referencia-completa)
12. [Variables de entorno](#12-variables-de-entorno)
13. [Instalación y ejecución local](#13-instalación-y-ejecución-local)
14. [Despliegue en producción](#14-despliegue-en-producción)
15. [Credenciales de prueba](#15-credenciales-de-prueba)
16. [Panel de administración](#16-panel-de-administración)
17. [Roles de usuario](#17-roles-de-usuario)
18. [Manejo de precios (centavos COP)](#18-manejo-de-precios-centavos-cop)
19. [Detalles técnicos: Wompi](#19-detalles-técnicos-wompi)
20. [Detalles técnicos: Mercado Pago](#20-detalles-técnicos-mercado-pago)
21. [Preguntas frecuentes](#21-preguntas-frecuentes)

---

## 1. Stack tecnológico

| Capa | Tecnología | Versión | Uso |
|---|---|---|---|
| Monorepo | **pnpm workspaces** + Turborepo | — | Gestión de paquetes y build pipeline |
| Frontend | **Next.js** | 16 (App Router) | SSR, páginas, componentes, sesión |
| Backend | **NestJS** | 10 | REST API, autenticación JWT, webhooks |
| Lenguaje | **TypeScript** | strict | Todo el código |
| Estilos | **Tailwind CSS** | 4 | Diseño UI |
| ORM | **Prisma** | 7 | Acceso a base de datos |
| Base de datos | **PostgreSQL** (Neon) | — | Almacenamiento principal |
| Autenticación | **NextAuth.js** v5 + JWT NestJS | — | Sesiones browser + tokens API |
| Pago (principal) | **Wompi** | URL directa | Tarjetas, Nequi, PSE, Bancolombia |
| Pago (respaldo) | **Mercado Pago** | SDK v2 | Preference + redirect |
| Logística | **Vendelo** | REST API | Despacho y seguimiento de envíos |
| Email | **Resend** | — | Emails transaccionales (con cola de reintentos) |
| Imágenes | **Cloudinary** | — | Subida y almacenamiento de fotos |
| Estado del carrito | **Zustand** | — | Carrito persistido en localStorage |
| Validación API | **class-validator** | — | DTOs en NestJS |
| Hash contraseñas | **bcryptjs** | cost 12 | Usuarios con contraseña |

---

## 2. Arquitectura del sistema

El proyecto es un **monorepo** con dos aplicaciones (`apps/web` y `apps/api`) que comparten
paquetes internos (`packages/domain`, `packages/database`, `packages/types`).

### Visión general

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (browser)                          │
│  React Client Components · Zustand (carrito) · NextAuth session     │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ HTTP
          ┌─────────────▼──────────────────────────┐
          │           apps/web  (Next.js :3000)     │
          │                                         │
          │  Server Components → SSR catálogo/home  │
          │  proxy.ts          → protección rutas   │
          │  /api/auth/[...]   → NextAuth handler   │
          └────────────────────┬────────────────────┘
                               │ fetch con Bearer JWT
          ┌────────────────────▼────────────────────┐
          │           apps/api  (NestJS :3001)       │
          │                                         │
          │  AuthModule       → /auth/*              │
          │  ProductsModule   → /products            │
          │  OrdersModule     → /orders              │
          │  AdminModule      → /admin/*             │
          │  PaymentsModule   → /payments/*          │
          └────────────────────┬────────────────────┘
                               │
          ┌────────────────────▼────────────────────┐
          │        packages/domain (compartido)      │
          │  Entidades · Interfaces · Use Cases      │
          └────────────────────┬────────────────────┘
                               │
          ┌────────────────────▼────────────────────┐
          │       packages/database (compartido)     │
          │  Prisma 7 · PrismaPg · Singleton         │
          └────────────────────┬────────────────────┘
                               │
          ┌────────────────────▼────────────────────┐
          │         PostgreSQL — Neon                │
          └─────────────────────────────────────────┘
```

### Clean Architecture en el dominio

```
┌─────────────────────────────────────────────────────────────────┐
│                           DOMAIN  (packages/domain)             │
│                                                                 │
│  Entidades: Product · Order · User · Category                   │
│  Interfaces: IProductRepository · IOrderRepository · IPayment   │
│  Use Cases: CreateOrder · ConfirmPayment · ListProducts          │
│  Shared: Result<T,E> · AppError                                 │
└───────────────────────────▲─────────────────────────────────────┘
                            │ implementa
┌───────────────────────────┴─────────────────────────────────────┐
│              INFRASTRUCTURE  (apps/api + apps/web)              │
│                                                                 │
│  PrismaProductRepository · PrismaOrderRepository                │
│  WompiService · MercadoPagoService · VendeloService             │
│  ResendEmailService · EmailQueueService · CloudinaryService     │
│  WompiReconciliationService · VendeloOrderQueueService          │
└───────────────────────────▲─────────────────────────────────────┘
                            │ usa
┌───────────────────────────┴─────────────────────────────────────┐
│                    PRESENTATION  (apps/web + apps/api)          │
│                                                                 │
│  NestJS Controllers · Next.js Server Components · Pages         │
└─────────────────────────────────────────────────────────────────┘
```

**Regla de dependencias:** las capas internas no conocen las externas.
El dominio no importa nada de Prisma, NestJS ni Next.js.

---

## 3. Estructura del monorepo

```
motek-store/
│
├── apps/
│   ├── web/                        ← Next.js 16 (frontend + SSR)
│   │   ├── src/
│   │   │   ├── proxy.ts            ← Protección de rutas /admin y /checkout
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts         ← Config NextAuth (Credentials + Google OAuth)
│   │   │   │   ├── api-client.ts   ← Factory apiClient(token) para llamadas al API
│   │   │   │   ├── cache.ts        ← unstable_cache con TTLs y tags de invalidación
│   │   │   │   ├── cache-tags.ts   ← Constantes CACHE_TAGS
│   │   │   │   └── cart.ts         ← Store Zustand del carrito (localStorage)
│   │   │   ├── infrastructure/
│   │   │   │   ├── repositories/   ← Repos Prisma (usados en Server Components)
│   │   │   │   └── services/       ← Servicios (Cloudinary, Resend)
│   │   │   ├── app/
│   │   │   │   ├── (store)/        ← Tienda pública (home, catálogo, producto, carrito)
│   │   │   │   │   └── checkout/confirmacion/  ← Página de confirmación post-pago
│   │   │   │   ├── admin/          ← Panel admin (solo ADMIN)
│   │   │   │   ├── auth/           ← Login, registro
│   │   │   │   └── api/auth/       ← Solo NextAuth handler
│   │   │   └── components/
│   │   │       └── checkout/
│   │   │           ├── CheckoutForm.tsx      ← Formulario de checkout
│   │   │           ├── WompiWidget.tsx       ← Botón de pago Wompi
│   │   │           ├── CartCleaner.tsx       ← Limpia el carrito post-pago
│   │   │           └── OrderStatusPoller.tsx ← Polling del estado del pedido
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   └── api/                        ← NestJS 10 (REST API backend)
│       ├── src/
│       │   ├── main.ts             ← Bootstrap: dotenv, Helmet, CORS, Swagger, validación env
│       │   ├── app.module.ts       ← Módulo raíz + guards globales
│       │   ├── auth/               ← AuthModule: registro, login, JWT, Google session-token
│       │   ├── products/           ← ProductsModule: GET /products (público)
│       │   ├── orders/             ← OrdersModule: POST /orders, PATCH status
│       │   ├── admin/              ← AdminModule: CRUD productos, stock, settings
│       │   ├── payments/           ← PaymentsModule: webhooks Wompi y Mercado Pago
│       │   └── infrastructure/
│       │       ├── services/
│       │       │   ├── WompiService.ts              ← Firma SHA256, validación webhook
│       │       │   ├── WompiReconciliationService.ts← Job cada 15 min (pedidos PENDING)
│       │       │   ├── MercadoPagoService.ts        ← Preference, HMAC, estado
│       │       │   ├── VendeloService.ts            ← Creación y seguimiento de envíos
│       │       │   ├── VendeloHttpClient.ts         ← HTTP client con retry + circuit breaker
│       │       │   ├── VendeloOrderQueueService.ts  ← Cola de despacho (Prisma, cada 2 min)
│       │       │   ├── EmailQueueService.ts         ← Cola de emails (Prisma, cada 2 min)
│       │       │   ├── ResendEmailService.ts        ← Envío real vía Resend API
│       │       │   └── CloudinaryService.ts         ← Upload de imágenes
│       │       └── injection-tokens.ts              ← Symbols para inyección de dependencias
│       ├── webpack.config.js
│       └── package.json
│
├── packages/
│   ├── domain/                     ← Dominio puro — cero dependencias externas
│   │   └── src/
│   │       ├── entities/           ← Product, Order, User, Category
│   │       ├── repositories/       ← IProductRepository, IOrderRepository, IUserRepository
│   │       ├── services/           ← IPaymentService, IVendeloShippingPort
│   │       ├── use-cases/          ← CreateOrder, ConfirmPayment, ListProducts, UpdateStock
│   │       └── shared/             ← Result<T,E>, AppError
│   │
│   ├── database/                   ← Prisma centralizado
│   │   ├── prisma/
│   │   │   ├── schema.prisma       ← Modelos y relaciones
│   │   │   ├── seed.ts             ← Datos iniciales (admin, productos, pedidos)
│   │   │   ├── catalog.ts          ← 85 productos con jerarquía de categorías
│   │   │   └── migrations/         ← Historial de migraciones
│   │   └── src/
│   │       ├── index.ts            ← Singleton PrismaClient + PrismaPg adapter (pool máx 5)
│   │       └── generated/          ← Auto-generado por prisma generate (no editar)
│   │
│   └── types/                      ← DTOs compartidos: auth, product, order, payment, admin
│
├── HISTORIAL_TECNICO.md            ← Registro cronológico de todos los cambios
├── AUDITORIA.md                    ← Auditoría técnica v2.0 (mayo 2026)
├── turbo.json                      ← Pipeline de Turborepo
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## 4. Flujo de datos general

### Catálogo — lectura SSR (sin HTTP a NestJS)

```
Navegador
    │  GET /catalogo
    ▼
apps/web — Server Component
    │  PrismaProductRepository.findAll(filters)  ← acceso directo a BD
    ▼
packages/database — Prisma + Neon
    │  rows[]  →  toDomain()  →  Product[]
    ▼
Next.js renderiza HTML con unstable_cache (TTL 180–3600 s)
    ▼
Respuesta HTML al navegador
```

### Operaciones autenticadas (checkout, admin)

```
Browser — Client Component
    │  apiClient(accessToken).post('/orders', body)
    ▼
apps/api — NestJS :3001
    │  JwtAuthGuard verifica Bearer token
    │  Controller → Use Case → Repository → Prisma → Neon
    ▼
Response JSON  →  Browser actualiza UI
```

### Carrito — estado del cliente

```
Usuario hace click "Agregar al carrito"
    │  useCart().addItem(product)
    ▼
Zustand store (memoria RAM)
    │  persist middleware
    ▼
localStorage["motek-store-cart:{userId}"]
```

---

## 5. Esquema de base de datos

```
┌─────────────┐         ┌──────────────────────────┐
│    User     │         │         Account           │
│─────────────│         │──────────────────────────│
│ id (PK)     │◄────────│ userId (FK)               │
│ email       │  1 : N  │ provider                  │
│ name        │         │ providerAccountId         │
│ image       │         └──────────────────────────┘
│ password?   │         ← NULL para usuarios Google
│ role        │         ← 'ADMIN' o 'CUSTOMER'
│ createdAt   │
└──────┬──────┘
       │ 1 : N
       ▼
┌─────────────┐         ┌─────────────┐
│    Order    │◄────────│   Payment   │
│─────────────│  1 : 1  │─────────────│
│ id (PK)     │         │ orderId(FK) │
│ userId (FK) │         │ provider    │
│ status      │         │ externalId  │ ← ID de Wompi / MP
│ total (Int) │         │ status      │
│ shipping    │         │ amount      │
│ paymentProv │         └─────────────┘
│ createdAt   │
└──────┬──────┘
       │ 1 : N
       ▼
┌─────────────────┐
│   OrderItem     │
│─────────────────│
│ orderId (FK)    │
│ productId (FK)──┼──────────────────┐
│ quantity        │                  │
│ priceAtPurchase │                  ▼
└─────────────────┘      ┌──────────────────────┐
                         │       Product        │
┌──────────────────┐     │──────────────────────│
│    Category      │◄────│ categoryId (FK)      │
│──────────────────│1:N  │ id (PK)              │
│ id (PK)          │     │ name · slug          │
│ name · slug      │     │ description          │
│ parentId?        │     │ price (Int)          │ ← centavos COP
│  (jerarquía)     │     │ stock · sku          │
└──────────────────┘     │ images[]             │
                         │ isActive             │
                         └──────────┬───────────┘
                                    │ 1 : N
                                    ▼
                       ┌─────────────────────────┐
                       │  MotorcycleCompatibility │
                       │─────────────────────────│
                       │ productId (FK)           │
                       │ brand · model · year?    │
                       └─────────────────────────┘

┌─────────────────┐    ┌──────────────────────┐
│    Settings     │    │     EmailQueue       │
│─────────────────│    │──────────────────────│
│ key (UNIQUE)    │    │ orderId · to         │
│ value           │    │ status · attempts    │
└─────────────────┘    │ nextRetry            │
                       └──────────────────────┘

┌──────────────────────────┐
│    VendeloOrderQueue     │
│──────────────────────────│
│ orderId · status         │
│ attempts · nextRetry     │
│ vendeloShipmentId?       │
└──────────────────────────┘
```

### Categorías — jerarquía de tres niveles

```
Sistema Eléctrico
  ├── Ramales · Reguladores · CDI · Baterías · Estatores · Bobinas

Repuestos
  ├── Filtro de Aire · Bujías · Conectores · Frenos · Repuestos Motor

Aceites          → Liquimoly · SKY
Llantas          → (subcategorías)
Accesorios       → Espejos · Exploradoras · Bombillos LED · Equipamiento
```

---

## 6. Flujo de autenticación

### Registro con email y contraseña

```
Browser — /auth/register
    │  fetch(`${NEXT_PUBLIC_API_URL}/auth/register`, { email, password, name })
    ▼
NestJS — POST /auth/register
    │  class-validator valida el DTO
    │  userRepo.findByEmail(email) → ¿ya existe? → 409
    │  bcrypt.hash(password, 12)
    │  prisma.user.create(...)
    │  → 201 { message: "Usuario registrado correctamente" }
    ▼
Browser — redirect a /auth/login
```

### Login con email y contraseña

```
Browser — /auth/login
    │  signIn('credentials', { email, password, redirect: false })
    ▼
NextAuth — Credentials.authorize()
    │  fetch(`${API_URL}/auth/login`, { email, password })
    ▼
NestJS — POST /auth/login
    │  bcrypt.compare(password, hash)
    │  jwtService.sign({ sub, email, role })
    │  → { accessToken, role, userId, name, email }
    ▼
NextAuth — jwt callback
    │  token.accessToken = data.accessToken
    │  token.role = data.role
    ▼
NextAuth — session callback
    │  session.user.accessToken = token.accessToken
    │  session.user.role = token.role
    ▼
Browser — router.push(callbackUrl ?? '/')
```

### Login con Google OAuth

```
Browser — signIn('google')
    ▼
Google — pantalla de consentimiento
    ▼
NextAuth — PrismaAdapter crea/vincula usuario
    ▼
NextAuth — jwt callback (account.provider === 'google')
    │  fetch(`${API_URL}/auth/session-token`, { email })
    │  header: x-internal-secret: INTERNAL_API_SECRET
    ▼
NestJS — POST /auth/session-token (endpoint interno)
    │  jwtService.sign({ sub, email, role })
    │  → { accessToken, role }
    ▼
NextAuth — token.accessToken = data.accessToken
    ▼
Browser — sesión activa con JWT NestJS
```

### Protección de rutas (proxy.ts)

```
Request a /admin/* o /checkout/*
    ▼
proxy.ts  (Node.js runtime)
    │
    ├── /admin/*  → sin sesión → redirect /auth/login
    │             → role !== 'ADMIN' → redirect /
    │             → ADMIN → next() ✓
    │
    └── /checkout/* → sin sesión → redirect /auth/login?callbackUrl=/checkout
                    → con sesión → next() ✓
```

---

## 7. Flujo de pago con Wompi

```mermaid
sequenceDiagram
    participant B as Browser
    participant W as apps/web
    participant A as apps/api (NestJS)
    participant WP as Wompi
    participant DB as PostgreSQL

    B->>W: Completa checkout (dirección + datos)
    W->>A: POST /orders {items, shippingAddress, provider: WOMPI}
    A->>DB: CreateOrder → Order(status=PENDING)
    A->>A: WompiService.createTransaction(order)<br/>SHA256(reference+amount+COP+secret)
    A-->>B: {reference, integritySignature, publicKey, amountInCents}

    B->>WP: Redirect a checkout.wompi.co con query params
    WP->>B: Formulario de pago (tarjeta / Nequi / PSE)
    B->>WP: Usuario paga

    WP->>A: POST /payments/wompi/webhook
    A->>A: Validar firma SHA256 (WOMPI_EVENTS_SECRET)
    A->>DB: ConfirmPayment use case
    alt APPROVED
        A->>DB: Order.status = PAID, decrementStock()
        A->>A: EmailQueueService.enqueue(email, orderId)
        A->>A: VendeloOrderQueueService.enqueue(orderId)
    else DECLINED
        A->>DB: Order.status = CANCELLED
    end
    A-->>WP: 200 OK

    B->>W: Redirect a /checkout/confirmacion?orderId=xxx
    W->>DB: OrderStatusPoller consulta estado
    W-->>B: Página de confirmación
```

> **Por qué no usamos el `widget.js` de Wompi:** el widget usa `document.currentScript`
> para localizar su form padre. Esto solo funciona en scripts parseados desde HTML estático,
> no en scripts añadidos dinámicamente (que es lo que hace React/Next.js siempre).
> La URL directa produce exactamente la misma experiencia de pago.

---

## 8. Flujo de pago con Mercado Pago

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as apps/api (NestJS)
    participant MP as Mercado Pago
    participant DB as PostgreSQL

    B->>A: POST /orders {provider: MERCADO_PAGO}
    A->>DB: ¿Settings.MERCADOPAGO_ENABLED = true?
    alt Deshabilitado
        A-->>B: 403 Forbidden
    else Habilitado
        A->>MP: MercadoPagoService.createTransaction(order)
        MP-->>A: {init_point URL}
        A->>DB: Order(status=PENDING) + Payment(externalId)
        A-->>B: {redirectUrl}
        B->>MP: Redirect completo a Mercado Pago
        B->>MP: Usuario paga
        MP->>A: POST /payments/mercadopago/webhook (IPN)
        A->>A: Validar HMAC-SHA256 (x-signature header)
        A->>MP: getTransactionStatus(externalId) ← consulta activa
        A->>DB: ConfirmPayment (APPROVED / DECLINED / VOIDED)
        MP-->>B: back_url → /checkout/success o /checkout/failure
    end
```

---

## 9. Integración de despacho con Vendelo

Tras la confirmación de pago (webhook `APPROVED`), el pedido se encola automáticamente
para despacho a través de **Vendelo**, el operador logístico integrado.

### Flujo de despacho

```mermaid
sequenceDiagram
    participant WH as Webhook Wompi
    participant VQ as VendeloOrderQueueService
    participant VS as VendeloService
    participant HC as VendeloHttpClient
    participant VE as API Vendelo
    participant DB as PostgreSQL

    WH->>VQ: enqueue(orderId) → VendeloOrderQueue(PENDING)

    loop Cada 2 minutos
        VQ->>DB: findMany {status: PENDING, nextRetry <= now}
        VQ->>VS: createShipment(order)
        VS->>HC: POST /shipments (con retry + circuit breaker)
        HC->>VE: Llamada HTTP
        alt Éxito
            VE-->>HC: {shipment_id, tracking_code}
            HC-->>VS: respuesta
            VS-->>VQ: OK
            VQ->>DB: status=DONE, vendeloShipmentId saved
        else Error transitorio (5xx / 429 / red)
            HC->>HC: Retry con backoff 1s → 2s → 4s
            HC-->>VQ: Error
            VQ->>DB: attempts++, nextRetry = now + backoff(5s/30s/120s)
        else 3 intentos agotados
            VQ->>DB: status=FAILED, lastError logged
        end
    end
```

### Circuit Breaker en `VendeloHttpClient`

El cliente HTTP hacia Vendelo implementa un **circuit breaker** de tres estados para
proteger el sistema cuando la API de Vendelo experimenta fallas sostenidas:

| Estado | Condición | Comportamiento |
|---|---|---|
| `CLOSED` | Normal | Todas las llamadas pasan |
| `OPEN` | ≥ 5 fallos consecutivos | Rechaza llamadas inmediatamente durante 60 s |
| `HALF_OPEN` | Después de 60 s en OPEN | Permite una llamada de prueba |

Si la prueba tiene éxito, el circuito vuelve a `CLOSED`. Si falla, regresa a `OPEN`.

### Endpoints de Vendelo utilizados

| Operación | Endpoint | Descripción |
|---|---|---|
| Autenticación | `POST /auth/token` | Obtiene access token |
| Catálogo de ciudades | `GET /cities` | Ciudades disponibles con paginación |
| Crear envío | `POST /shipments` | Crea la orden de despacho |
| Estado del envío | `GET /shipments/{id}` | Consulta tracking |
| Sincronizar estado | `PATCH /orders/:id/sync-shipment` | Actualiza estado desde Vendelo |
| Cotizar envío | `POST /v1/admin/orders/quotation` | Estima el costo de envío sin crear el pedido |

### Cotización de envío (carrito/checkout)

`POST /shipping/quote` (NestJS, público vía `@Public()`) envuelve el use case `QuoteShipping`
para mostrarle al cliente un estimado de envío **antes de pagar**. Es puramente informativo:
Vendelo cobra el envío directamente al cliente al momento de la entrega, no nuestro Wompi — el
monto cargado en el checkout no cambia. Si el subtotal del carrito alcanza
`FREE_SHIPPING_THRESHOLD_CENTS`, ni siquiera se consulta a Vendelo.

```
/carrito, /checkout
    │  useShippingQuote(city, items) — debounce 500ms, hook compartido
    ↓
POST /api/shipping/quote (Next.js)         ← valida con zod, timeout 8s
    ↓
POST /shipping/quote (NestJS)              ← @Throttle 10 req/min/IP + 100/min global
    │  QuoteShipping use case               ← precios/stock siempre desde la BD
    ↓
VendeloService.quoteOrder()
    ↓
POST /v1/admin/orders/quotation (Vendelo)
```

Cache cliente en `useShippingQuoteStore` (Zustand + `sessionStorage`, TTL 5 min), compartida
entre carrito y checkout por clave `${cityCode}-${items ordenados}`. La ciudad seleccionada se
persiste en el store de carrito (`selectedCity`) para no pedirla dos veces.

### 9.1 Pago contra entrega (COD)

Además de Wompi/Mercado Pago, el checkout ofrece **pago contra entrega** (`paymentProvider: 'COD'`)
— el cliente paga en efectivo al repartidor de Vendelo, no a través de nuestra pasarela. Como no
existe un webhook de pasarela que confirme el pago, el ciclo de vida del pedido es distinto:

| Paso | Online (Wompi/MP) | COD |
| --- | --- | --- |
| Estado inicial del pedido | `PENDING` (espera webhook) | `PAID` (inmediato, sin paso de autorización) |
| Descuento de stock | Al recibir webhook `APPROVED` | En la misma transacción de creación del pedido |
| Encolado en Vendelo / email confirmación | Disparado por el webhook | Disparado directo desde `OrdersController` tras crear el pedido |
| `payment_method_code` enviado a Vendelo | `EXTERNAL_PAYMENT` | `COD` |

**Restock automático:** si Vendelo reporta el envío como `RETURNED` o `CANCELLED` (paquete
rechazado en la puerta), `SyncShipmentStatus` restaura el stock de los `OrderItem` del pedido,
de forma atómica e idempotente — aplica a cualquier método de pago, no solo COD.

No hay restricción de monto ni de ciudad para ofrecer COD (MVP) — disponible en cualquier
ciudad con cobertura Vendelo.

**Toggle admin (`/admin/configuracion`):** el admin puede desactivar COD sin tocar código.
Estado persistido en la tabla `Settings` (clave `COD_ENABLED`, mismo patrón que
`MERCADOPAGO_ENABLED`). Si no existe la fila aún, se trata como **habilitado por defecto**.

| Estado | Checkout (cliente) | `POST /orders` con `paymentProvider: 'COD'` |
| --- | --- | --- |
| Habilitado (o sin fila en Settings) | Muestra el selector "Pago en línea" / "Pago contra entrega" | Acepta el pedido |
| Deshabilitado | Solo aparece "Pago en línea" — el selector ni se renderiza | `403 ForbiddenException` |

No borra ninguna funcionalidad: el código de creación de pedidos COD, Vendelo y el webhook de
envío siguen intactos — el toggle solo controla si se *ofrece* la opción. `PATCH /admin/settings/cod`
(`AdminSettingsController`, `@Roles('ADMIN')`) escribe el setting; `CodToggle.tsx` es el switch en la UI.

### 9.2 Peso y dimensiones reales de envío

`Product` tiene 4 campos opcionales — `weightKg`, `heightCm`, `widthCm`, `lengthCm` (nullable,
cargados por el admin en `/admin/productos/[id]`, sección "Envío"). `VendeloService.createOrder()`
y `.quoteOrder()` los usan como override del default genérico configurado por env var
(`VENDELO_DEFAULT_WEIGHT_KG=1`, `VENDELO_DEFAULT_HEIGHT_CM=25`, `VENDELO_DEFAULT_WIDTH_CM=25`,
`VENDELO_DEFAULT_LENGTH_CM=10`):

```ts
weight: productSnapshot.weightKg ?? defaultWeightKg
```

**Por qué existe esto:** antes, *todos* los productos usaban el mismo peso/dimensiones fijos sin
importar qué se estuviera enviando. Coordinadora recalcula el flete real con el peso pesado en
bodega al despachar — cualquier producto más pesado/grande que el default genérico generaba un
flete real mayor al cotizado en el checkout, cobrando de más al negocio sobre lo ya cobrado al
cliente. El default (1kg, 25x25x10cm) se eligió deliberadamente sobredimensionado — mientras el
admin no cargue el dato real, es preferible sobreestimar el flete (margen a favor del negocio)
que subestimarlo (pérdida).
Mientras un producto no tenga estos campos cargados, sigue usando el default (comportamiento legacy,
sin romper nada) — pero la cotización para ese producto seguirá siendo aproximada.

`QuoteShipping` (cotización en carrito/checkout) resuelve estos campos desde la BD junto con el
precio, así que el estimado que ve el cliente ya refleja el peso real si está cargado.

### 9.3 Flete cobrado en línea junto con el producto

En vez de que el negocio absorba el costo del flete (comportamiento legado, siempre así antes de
esta función), el cliente puede pagar **producto + envío en un solo cargo** de Wompi/Mercado Pago.
El negocio le sigue pagando a Vendelo el flete desde su billetera al despachar (sin cambios ahí) —
ahora recupera ese costo del cliente en vez de asumirlo en silencio.

Reemplaza el intento anterior de que Vendelo recaudara *solo el flete* en efectivo al entregar
(`Order.shippingCod`, ver historial abajo) — Vendelo rechazó las dos formas probadas de lograrlo, así
que se abandonó esa vía y en su lugar se suma el flete al cobro que ya funciona de forma confiable.

**Política global, no elección del cliente** — controlada por el admin desde `/admin/configuracion`
con el toggle **"Flete pagado en línea"** (setting `SHIPPING_ONLINE_ENABLED`, **default
desactivado** — deliberado, para no empezar a cobrar flete extra sin opt-in explícito). El checkout
no tiene checkbox: `orders.controller.ts` lee el setting y decide para todo pedido `WOMPI`/`MERCADO_PAGO`.

```
SHIPPING_ONLINE_ENABLED=false (default) → comportamiento legado: shippingTotal=0, el negocio
                                           absorbe el flete desde su billetera Vendelo
SHIPPING_ONLINE_ENABLED=true            → CreateOrder cotiza el flete (delegando en QuoteShipping,
                                           misma lógica de peso real + umbral de envío gratis) y lo
                                           suma al total: total = productSubtotal + shippingTotal
```

`Order.total` pasa a significar el **total cobrado** (producto + flete cuando se cobra en línea) —
así `WompiService`/`MercadoPagoService`/`ConfirmPayment`, que ya leen `order.total` directamente,
funcionan sin ningún cambio de código. `Order.shippingTotal` (nuevo campo, default `0`) guarda el
componente de flete por separado, para desglosarlo en el comprobante y el panel admin.

**Falla segura — nunca bloquea el checkout:** si falta `cityCode`/`subdivisionCode` en la dirección,
si la cotización a Vendelo falla, o si el flete cotizado supera `MAX_SHIPPING_CHARGE_CENTS`
(tope defensivo, $50.000 COP por defecto), `CreateOrder.execute()` degrada a `shippingTotal: 0` — el
pedido se crea igual y el negocio absorbe el flete como en el caso legado. `CreateOrderOutput.shippingQuoteFallback`
señala cuándo pasó esto para que `orders.controller.ts` lo loggee como warning.

`CreateOrder` compone el use case `QuoteShipping` ya existente (constructor 4º parámetro
**opcional**, para no romper instanciaciones de 3 argumentos que no cobran flete en línea) — no
duplica la lógica de cotización, peso real por producto, ni el umbral de envío gratis.

El comprobante de venta y el modal de detalle en `/admin/pedidos` desglosan Subtotal / Envío / Total
cuando `shippingTotal > 0`, para que los números siempre cuadren.

**Rollout:** al desplegar esta función se borró cualquier fila `SHIPPING_ONLINE_ENABLED` existente
en `Settings` (el toggle traía un significado distinto de un intento anterior) — todo ambiente
arranca en el default seguro (desactivado) hasta que el admin lo active manualmente.

---

## 10. Servicios de background (colas y reconciliación)

NestJS levanta tres servicios de fondo al iniciar (`OnModuleInit`). Todos usan
**PostgreSQL como broker** (sin Redis ni BullMQ) y se limpian correctamente en `OnModuleDestroy`.

### `EmailQueueService` — Cola de correos de confirmación

Los emails de confirmación **nunca se envían inline** en el webhook. Esto evita que un
fallo de Resend bloquee la respuesta al procesador de pagos.

```
Webhook APPROVED
    │  EmailQueueService.enqueue(email, orderId)
    ▼
EmailQueue { status: PENDING } — escrito en BD

┌─────────────────────────────────────────┐
│  setInterval cada 2 min                 │
│                                         │
│  findMany { status: PENDING,            │
│             nextRetry <= now }          │
│  → ResendEmailService.send(...)         │
│                                         │
│  Éxito → status = DONE                  │
│  Error → attempts++                     │
│          nextRetry = +5s / +30s / +120s │
│  3 fallos → status = FAILED             │
└─────────────────────────────────────────┘
```

### `VendeloOrderQueueService` — Cola de despacho

Idéntico patrón al `EmailQueueService` pero encola pedidos para despacho en Vendelo.
Reintentos: 3 intentos con backoff 5 s → 30 s → 120 s.

**Protección contra duplicados (defense in depth, evita el bug histórico de
órdenes triplicadas en Vendelo):**

1. **Guard de idempotencia** — si `order.vendeloOrderId` ya existe, se marca `SENT` sin volver a llamar a Vendelo.
2. **Claim atómico de fila** — `updateMany({ where: { id, status: 'PENDING' } })` antes de procesar. Si `count === 0`, otra instancia de Cloud Run (o otro tick) ya la reclamó. La fila pasa a `PROCESSING` con `processingStartedAt`.
3. **Sweeper de huérfanas** — al inicio de cada ciclo, libera (`PROCESSING → PENDING`) filas atascadas por más de 5 min, cubriendo el caso de un contenedor que crashea a mitad de proceso.
4. **Commit idempotente** — el `update` final de `Order.vendeloOrderId` usa `updateMany({ where: { vendeloOrderId: null } })` en vez de `update` simple.
5. **`VendeloHttpClient.post()` no reintenta en `5xx`** para `/v1/admin/orders` (parámetro `retryOn5xx: false`) — Vendelo no trata `external_order_id` como key única, así que un retry sobre un 5xx puede crear una orden duplicada si la primera request sí fue procesada. Sigue reintentando en `429` y errores de red.

También carga `product: { select: { sku, name } }` al construir el `domainOrder`, para que `VendeloService` envíe el SKU y nombre comerciales reales en `line_items` (antes enviaba el cuid interno de Prisma).

### `WompiReconciliationService` — Reconciliación de pagos

Cubre el escenario donde Wompi procesó el pago pero su webhook **nunca llegó** al servidor
(falla de red, reinicio, misconfiguration temporal).

```
┌──────────────────────────────────────────────────────────┐
│  setInterval cada 15 min                                 │
│                                                          │
│  Busca: status=PENDING + provider=WOMPI                  │
│         + createdAt < (now - 15 min)                     │
│         + payment.externalId IS NOT NULL                 │
│                                                          │
│  Por cada pedido:                                        │
│    WompiService.getTransactionStatus(externalId)         │
│    → Si APPROVED → ConfirmPayment use case               │
│    → Si DECLINED → Order.status = CANCELLED             │
│    → Si PENDING  → ignorar (aún procesando)              │
└──────────────────────────────────────────────────────────┘
```

> El batch size máximo por ciclo es 20 pedidos para evitar sobrecarga en el primer
> arranque tras un período de inactividad del servidor.

---

## 11. API NestJS — Referencia completa

Base URL: `http://localhost:3001` (dev) · Documentación interactiva: `http://localhost:3001/api/docs`

### Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/auth/register` | Público | Registro con email + contraseña |
| `POST` | `/auth/login` | Público | Login → devuelve JWT NestJS |
| `POST` | `/auth/session-token` | Internal secret | Emite JWT para usuarios Google OAuth |

**POST `/auth/login`**

```json
// Request
{ "email": "motekdev@gmail.com", "password": "Admin123!" }

// 200 — OK
{
  "accessToken": "eyJhbGci...",
  "role": "ADMIN",
  "userId": "cuid_xxx",
  "name": "Admin Motek",
  "email": "motekdev@gmail.com"
}

// 401 — Credenciales inválidas
{ "message": "Credenciales inválidas", "statusCode": 401 }
```

### Productos (público)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/products` | Público | Lista productos con filtros opcionales |

```
GET /products?category=sistema-electrico&inStock=true&page=1&limit=12
GET /products?search=yamaha&minPrice=5000000&maxPrice=20000000
```

### Pedidos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/orders` | JWT | Crea pedido y prepara transacción de pago |
| `PATCH` | `/orders/:id/status` | JWT + ADMIN | Actualiza estado manualmente |
| `PATCH` | `/orders/:id/sync-shipment` | JWT + ADMIN | Sincroniza estado de envío con Vendelo |

### Pagos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/payments/wompi/integrity` | Público | Genera firma SHA256 para el widget |
| `POST` | `/payments/wompi/webhook` | Firma Wompi | Webhook IPN de Wompi |
| `POST` | `/payments/mercadopago/create-preference` | JWT | Crea preferencia MP |
| `POST` | `/payments/mercadopago/webhook` | Firma MP | Webhook IPN de Mercado Pago |

### Contacto

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/contact` | Público (throttle 3/min) | Envía un mensaje de PQR por correo a `motekdev@gmail.com` |

### Health check

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health` | Público | Estado del servidor (`{ status: 'ok', uptime }`) |

### Admin (requieren JWT + rol ADMIN)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/dashboard` | Métricas: revenue, pendientes, stock bajo |
| `POST` | `/admin/products` | Crear producto |
| `PUT` | `/admin/products/:id` | Editar producto |
| `DELETE` | `/admin/products/:id` | Eliminar producto |
| `PATCH` | `/admin/products/:id/stock` | Actualizar stock individual |
| `POST` | `/admin/products/upload-image` | Subir imagen a Cloudinary |
| `PATCH` | `/admin/stock/bulk` | Actualizar stock masivo por SKU |
| `PATCH` | `/admin/settings/mercadopago` | Activar/desactivar Mercado Pago |

### Seguridad global (NestJS)

- **ThrottlerGuard**: 100 req/min global. Login → 10/min. Registro → 5/min.
- **JwtAuthGuard**: todas las rutas requieren JWT salvo las marcadas `@Public()`.
- **RolesGuard**: rutas admin verifican `role === 'ADMIN'`.
- **Helmet** + compresión en todos los responses.
- **CORS**: en producción solo acepta `FRONTEND_URL`. En desarrollo acepta localhost y dominios ngrok configurados.

---

## 12. Variables de entorno

### `apps/api/.env`

```bash
# ── Base de datos ──────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=verify-full"

# ── JWT ────────────────────────────────────────────────────────────────────────
# Generar con: node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
JWT_SECRET=
JWT_EXPIRES_IN=7d

# ── Google OAuth ───────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── Wompi ──────────────────────────────────────────────────────────────────────
WOMPI_PUBLIC_KEY=pub_test_xxxx
WOMPI_PRIVATE_KEY=prv_test_xxxx
WOMPI_INTEGRITY_SECRET=test_integrity_xxxx
WOMPI_EVENTS_SECRET=test_events_xxxx
WOMPI_ENV=sandbox                          # sandbox | production

# ── Mercado Pago ───────────────────────────────────────────────────────────────
MP_ACCESS_TOKEN=TEST-xxx
MP_PUBLIC_KEY=TEST-xxx
MP_WEBHOOK_SECRET=

# ── Vendelo (logística) ────────────────────────────────────────────────────────
VENDELO_API_URL=https://api.vendelo.co
VENDELO_API_KEY=
VENDELO_PICKUP_CITY_CODE=                  # Código de ciudad de despacho (ej. BOG)
VENDELO_PICKUP_ADDRESS=                    # Dirección del punto de recogida
VENDELO_PICKUP_CONTACT_NAME=
VENDELO_PICKUP_CONTACT_PHONE=

# ── Email (Resend) ─────────────────────────────────────────────────────────────
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=motekdev@gmail.com

# ── Imágenes (Cloudinary) ──────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ── App ────────────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# ── Seguridad interna (NextAuth ↔ NestJS) ──────────────────────────────────────
# Debe coincidir exactamente con apps/web/.env.local
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
INTERNAL_API_SECRET=
```

### `apps/web/.env.local`

```bash
# ── Base de datos (Server Components acceden directo a Prisma) ─────────────────
DATABASE_URL="postgresql://..."

# ── NestJS API ─────────────────────────────────────────────────────────────────
API_URL=http://localhost:3001              # server-side (NextAuth, Server Actions)
NEXT_PUBLIC_API_URL=http://localhost:3001  # client-side (componentes React)

# ── NextAuth ───────────────────────────────────────────────────────────────────
# Generar con: openssl rand -base64 32
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# ── Seguridad interna ──────────────────────────────────────────────────────────
# Debe coincidir exactamente con apps/api/.env
INTERNAL_API_SECRET=

# ── Google OAuth ───────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── Wompi (key pública para el cliente) ───────────────────────────────────────
WOMPI_PUBLIC_KEY=pub_test_xxxx

# ── Cloudinary ─────────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ── WhatsApp ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_WHATSAPP_NUMBER=573XXXXXXXXX  # Sin espacios ni guiones
```

### `packages/database/.env`

```bash
# Necesario para pnpm db:seed y pnpm db:studio
DATABASE_URL="postgresql://..."
```

> **Nota de seguridad:** `INTERNAL_API_SECRET` debe tener al menos 32 caracteres.
> `WOMPI_EVENTS_SECRET` y `WOMPI_INTEGRITY_SECRET` son obligatorios; el servidor no
> arranca si están vacíos (validación en `main.ts`).

---

## 13. Instalación y ejecución local

### Requisitos previos

- **Node.js 20+**
- **pnpm 9+** — `npm install -g pnpm`
- Una base de datos PostgreSQL accesible (se recomienda [Neon](https://neon.tech) en desarrollo)

### Pasos

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd motek-store

# 2. Instalar dependencias de todo el monorepo
pnpm install

# 3. Crear los archivos de entorno a partir de los ejemplos
cp apps/api/.env.example         apps/api/.env
cp apps/web/.env.local.example   apps/web/.env.local
cp packages/database/.env.example packages/database/.env
# Luego completar los valores reales en cada archivo

# 4. Generar el cliente Prisma
pnpm --filter @motek/database generate

# 5. Aplicar migraciones
pnpm --filter @motek/database exec prisma migrate deploy

# 6. Poblar la base de datos con datos de prueba
pnpm run db:seed

# 7. Levantar el backend — NestJS en :3001
pnpm --filter @motek/api dev

# 8. Levantar el frontend — Next.js en :3000 (otra terminal)
pnpm --filter @motek/web dev
```

### Comandos de referencia

```bash
# ── Monorepo ───────────────────────────────────────────────────────────────────
pnpm dev                                        # Levanta web + api en paralelo
pnpm build                                      # Build completo con Turborepo
pnpm lint                                       # ESLint en todo el monorepo
pnpm type-check                                 # tsc --noEmit en todos los paquetes

# ── Base de datos ──────────────────────────────────────────────────────────────
pnpm run db:seed                                # Re-ejecutar seed
pnpm run db:studio                             # Prisma Studio en :5555
pnpm --filter @motek/database exec prisma migrate dev --name <nombre>
pnpm --filter @motek/database generate           # Regenerar cliente Prisma

# ── Tests ──────────────────────────────────────────────────────────────────────
pnpm --filter @motek/domain test                 # Tests unitarios del dominio
pnpm --filter @motek/api test                    # Tests unitarios del API
pnpm --filter @motek/domain exec vitest run --coverage  # Cobertura (umbral: 80%)

# ── Build individual ───────────────────────────────────────────────────────────
pnpm --filter @motek/api build                   # Build NestJS → dist/main.js
pnpm --filter @motek/web build                   # Build Next.js

# ── Swagger ────────────────────────────────────────────────────────────────────
# http://localhost:3001/api/docs  (solo disponible con NODE_ENV=development)
```

---

## 14. Despliegue en producción

### API → Railway

```bash
# Build command
pnpm install --frozen-lockfile && \
  pnpm --filter @motek/database generate && \
  pnpm --filter @motek/api build

# Start command
node apps/api/dist/main.js
```

Variables de entorno requeridas en Railway: todas las de `apps/api/.env` con valores
de producción. Cambiar `WOMPI_ENV=production`, `NODE_ENV=production` y `FRONTEND_URL`
al dominio real de Vercel.

### Web → Vercel

```bash
# Build command
pnpm install --frozen-lockfile && \
  pnpm --filter @motek/database generate && \
  pnpm --filter @motek/web build
```

Configurar en el panel de Vercel: Framework `Next.js`. Variables de entorno de
`apps/web/.env.local` con valores de producción.

### Webhooks en producción

Configurar en el panel de Wompi (sandbox/producción):

```
Webhook URL: https://tu-api.railway.app/payments/wompi/webhook
```

Para desarrollo local con webhooks reales:

```bash
ngrok http 3001
# Usar la URL pública generada en el panel de Wompi sandbox
# Ejemplo: https://abc123.ngrok.io/payments/wompi/webhook
```

---

## 15. Credenciales de prueba

Después de ejecutar `pnpm run db:seed`:

### Administrador del sistema

| Campo | Valor |
|---|---|
| Email | `motekdev@gmail.com` |
| Contraseña | `Admin123!` |
| Panel | `http://localhost:3000/admin` |

### Cliente de prueba

| Campo | Valor |
|---|---|
| Email | `cliente@ejemplo.co` |
| Contraseña | `Cliente123!` |

### Tarjeta de prueba Wompi (sandbox)

| Campo | Valor |
|---|---|
| Número | `4242 4242 4242 4242` |
| Vencimiento | Cualquier fecha futura |
| CVV | `123` |
| Nombre | Cualquier nombre |

---

## 16. Panel de administración

Acceso exclusivo para usuarios con rol `ADMIN`. URL: `http://localhost:3000/admin`

| Ruta | Funcionalidad |
|---|---|
| `/admin` | Dashboard: ingresos del día, pedidos pendientes, stock bajo |
| `/admin/productos` | Lista de productos — crear, editar, mover a papelera |
| `/admin/productos/papelera` | Productos eliminados — restaurar desde la papelera |
| `/admin/productos/[id]` | Formulario de edición con upload a Cloudinary |
| `/admin/pedidos` | Todos los pedidos filtrados por estado |
| `/admin/stock` | Productos con stock ≤ 5, actualización individual de stock |
| `/admin/sync` | Sincroniza stock y precio con el export `.xlsx` de Optimun (local físico) |
| `/admin/configuracion` | Toggle para activar/desactivar Mercado Pago |

### Ayuda contextual (botón ⓘ)

Las secciones del panel admin con flujos no obvios (`/admin/sync`, `/admin/pedidos`,
`/admin/stock`, `/admin/productos/[id]`, `/admin/productos/nuevo`, `/admin/categorias`) tienen un botón ⓘ en la
esquina superior derecha que abre un modal explicando qué hace la sección y los pasos para
usarla — pensado para casos donde la UI por sí sola no transmite el contexto necesario (ej.
sincronización con un sistema externo, reglas de negocio silenciosas, límites no aplicados
realmente).

Patrón reusable en `apps/web/src/components/admin/`:

- `AdminHelpButton.tsx` — componente genérico (botón + modal accesible: cierre con Esc, click
  fuera, o botón ✕). No requiere cambios para agregarlo a una nueva sección.
- `help-content/<seccion>.ts` — un archivo por sección con `{ title, summary, steps[] }`. Para
  páginas con más de un modo (ej. producto nuevo vs. editar) se exportan varias variantes desde
  el mismo archivo y la página elige cuál pasar al componente.

**Nota:** la importación masiva de stock por CSV (`CsvStockImport`) se eliminó — quedó cubierta
por `/admin/sync`, que sincroniza todo el inventario desde el export de Optimun en vez de un
archivo CSV manual.

Para agregar ayuda a una nueva sección: crear `help-content/<seccion>.ts` y renderizar
`<AdminHelpButton content={miSeccionHelpContent} />` junto al `<h1>` de la página.

---

## 17. Roles de usuario

```
CUSTOMER (por defecto)            ADMIN
──────────────────────            ──────────────────────
✓ Ver catálogo                    ✓ Todo lo de CUSTOMER
✓ Ver detalle de producto         ✓ Panel /admin
✓ Agregar al carrito              ✓ CRUD de productos
✓ Hacer checkout                  ✓ Gestionar pedidos
✓ Ver confirmación de pedido      ✓ Actualizar stock
                                  ✓ Importar CSV
                                  ✓ Toggle Mercado Pago
```

### Asignar rol ADMIN

```bash
# Opción 1: Prisma Studio (recomendado)
pnpm run db:studio
# Tabla User → campo role → cambiar a "ADMIN"

# Opción 2: SQL directo
psql $DATABASE_URL -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'nuevo@admin.co';"
```

### Triple capa de protección admin

```
1. proxy.ts          ← nivel de ruta (antes de renderizar la página)
2. admin/layout.tsx  ← nivel de servidor (al renderizar el layout)
3. NestJS @Roles()   ← nivel de API (antes de cualquier operación en BD)
```

---

## 18. Manejo de precios (centavos COP)

Todos los precios se almacenan en **centavos enteros** para evitar errores de punto flotante.

```
Precio visible:   $85.000 COP  →  BD: 8.500.000
Precio visible: $1.580.000 COP  →  BD: 158.000.000
```

```typescript
// Mostrar al usuario
new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0
}).format(cents / 100)   // 8500000 → "$85.000"

// Guardar desde formulario admin
Math.round(parseFloat(inputValue) * 100)   // "85000" → 8500000
```

> Los procesadores de pago (Wompi, Mercado Pago) también usan la unidad mínima de la
> moneda en sus APIs (`amount_in_cents`), lo que hace que esta convención sea natural.

---

## 19. Detalles técnicos: Wompi

### Firma de integridad

```
SHA256( reference + amountInCents + "COP" + WOMPI_INTEGRITY_SECRET )
```

La firma la calcula el servidor (NestJS) y **nunca expone el secret al cliente**.
Sin esta firma, un usuario podría manipular el monto en la URL de pago.

### Validación de webhook

```
SHA256( properties_joined + timestamp + WOMPI_EVENTS_SECRET )
```

Si la firma del header no coincide → `401 Unauthorized`. Previene que terceros
falsifiquen eventos de pago hacia el servidor.

### Idempotencia

```typescript
if (order.status !== 'PENDING') return ok(undefined)  // ya procesado
```

Wompi puede reenviar el mismo webhook múltiples veces. El use case `ConfirmPayment`
es completamente idempotente. Adicionalmente, `PrismaOrderRepository.transitionFromPending()`
usa una transacción atómica con `updateMany({ where: { id, status: 'PENDING' } })` —
si `count === 0` indica que otro proceso ya lo procesó.

### Reconciliación activa

Si el webhook nunca llega, `WompiReconciliationService` consulta activamente el estado
de la transacción cada 15 minutos. Ver [sección 10](#10-servicios-de-background-colas-y-reconciliación).

---

## 20. Detalles técnicos: Mercado Pago

| Aspecto | Wompi | Mercado Pago |
|---|---|---|
| Experiencia | URL directa (mismo efecto que widget) | Redirect completo a MP |
| Validación webhook | SHA256 events secret | HMAC-SHA256 (header `x-signature`) |
| Estado en webhook | Incluido en el evento | Requiere consultar la API de MP |
| Activación | Siempre disponible | Toggle en admin → Configuración |
| Habilitación | `WOMPI_ENV=sandbox/production` | `Settings.MERCADOPAGO_ENABLED=true` |

### Mapeo de estados MP → dominio

| Mercado Pago | Estado en dominio |
|---|---|
| `approved` / `authorized` | `APPROVED` |
| `pending` / `in_process` / `in_mediation` | `PENDING` |
| `rejected` | `DECLINED` |
| `cancelled` / `refunded` / `charged_back` | `VOIDED` |
| cualquier otro | `ERROR` |

---

## 21. Preguntas frecuentes

**¿Por qué hay dos apps separadas (Next.js + NestJS)?**
> Clean Architecture con separación real de capas. Next.js maneja SSR y la sesión del
> browser. NestJS maneja la lógica de negocio, autenticación JWT y webhooks. Ambas
> comparten el dominio y la base de datos sin duplicar código.

**¿Por qué los Server Components acceden directo a Prisma en lugar de llamar al API?**
> En un monorepo donde ambas apps comparten la misma BD, el SSR puede ir directo a Prisma
> sin overhead HTTP. Las operaciones que necesitan lógica de negocio (checkout, pagos,
> admin) sí pasan por NestJS.

**¿Por qué `proxy.ts` en vez de `middleware.ts`?**
> En Next.js 16 el archivo fue renombrado. Corre en Node.js runtime (no Edge), lo que
> permite usar NextAuth con sesiones JWT sin restricciones del Edge Runtime.

**¿Por qué los precios en centavos si en Colombia no hay centavos?**
> Evita errores de punto flotante en JavaScript. Los procesadores de pago (Wompi, Stripe,
> Mercado Pago) también usan la unidad mínima de la moneda.

**¿Por qué JWT en vez de database sessions con NextAuth?**
> El proveedor `credentials` de NextAuth requiere JWT cuando se combina con PrismaAdapter.
> Con database sessions, NextAuth falla al insertar en la tabla `Session` al hacer
> `signIn('credentials', ...)`.

**¿Cómo probar webhooks localmente?**

```bash
ngrok http 3001
# URL generada → panel Wompi sandbox → Webhook URL:
# https://abc123.ngrok.io/payments/wompi/webhook
```

**¿Cómo activar Mercado Pago?**
> Panel `/admin/configuracion` → activar el toggle. Esto guarda `MERCADOPAGO_ENABLED=true`
> en la tabla `Settings`. Para desactivarlo, apagar el toggle o ejecutar:
>
> ```bash
> psql $DATABASE_URL -c "UPDATE \"Settings\" SET value = 'false' WHERE key = 'MERCADOPAGO_ENABLED';"
> ```

**¿Qué pasa si el despacho a Vendelo falla?**
> El pedido queda en la tabla `VendeloOrderQueue` con `status=PENDING` y se reintenta
> automáticamente hasta 3 veces con backoff exponencial. Si los 3 intentos fallan,
> el registro queda en `status=FAILED` para revisión manual en Prisma Studio.

**¿Cómo forzar la reconciliación de un pago Wompi pendiente?**
> La reconciliación automática corre cada 15 minutos. Para forzarla manualmente:
>
> ```bash
> # Llamar al endpoint interno (requiere JWT admin)
> curl -X POST http://localhost:3001/admin/payments/reconcile \
>   -H "Authorization: Bearer <token>"
> ```
