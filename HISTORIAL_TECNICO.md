# Historial Técnico — Motek App Web

Registro cronológico de todos los cambios de código realizados durante el desarrollo del proyecto.

Cada entrada sigue este formato:

```md
## YYYY-MM-DD — Título corto del cambio

**Problema/Motivo:** por qué se hizo el cambio.

**Cambios:**

- `ruta/al/archivo.ts` — qué se modificó.

**Verificación:** cómo se comprobó que funciona.
```

---

## 2026-08-08 — Fix: Login no funcionaba (API de NestJS no arrancaba)

**Problema/Motivo:** El login fallaba siempre con "Correo o contraseña incorrectos", incluso con credenciales válidas. Causa raíz: `apps/api/.env` no tenía valores para `RESEND_API_KEY`, `VENDELO_API_KEY` ni `VENDELO_WEBHOOK_SECRET`. `assertEnvVars()` en `apps/api/src/main.ts` exige esas variables al arrancar y llama `process.exit(1)` si faltan, por lo que el proceso de NestJS nunca llegaba a levantar el servidor. El `fetch` desde `authorize()` en NextAuth (`apps/web/src/lib/auth.ts`) fallaba por conexión rechazada, y ese error de red caía en un `catch` genérico que devolvía `null` — indistinguible de credenciales inválidas para el usuario.

**Cambios:**

- `apps/api/.env` — se agregaron placeholders de desarrollo para `RESEND_API_KEY`, `VENDELO_API_KEY` y `VENDELO_WEBHOOK_SECRET` (el código de `ResendEmailService`, `VendeloHttpClient` y `VendeloWebhookGuard` ya tolera estos valores vacíos/falsos en runtime; el único bloqueo era el chequeo estricto de arranque).
- `apps/web/src/lib/auth.ts` — el `catch` de `authorize()` ya no traga silenciosamente `EmailNotVerifiedError` (se relanza), y ahora hace `console.error` de errores inesperados en vez de fallar en silencio.
- `apps/web/src/app/auth/login/LoginForm.tsx` — corregido `result?.error === 'EMAIL_NOT_VERIFIED'` → `result?.code === 'EMAIL_NOT_VERIFIED'`. En NextAuth v5, `signIn()` siempre devuelve `error: "CredentialsSignin"` genérico; el código de error personalizado (`EmailNotVerifiedError.code`) llega en `result.code`, no en `result.error`. Antes de este fix, el flujo de "verifica tu email" nunca se activaba.
- Base de datos local (dev): se marcó `emailVerified` para los usuarios semilla `admin@electromotos-tony.co` y `cliente@ejemplo.co` (estaban sin verificar, lo que bloqueaba las pruebas de login con `EMAIL_NOT_VERIFIED`).

**Verificación:** `curl -X POST http://localhost:3001/auth/login` devolvió `accessToken` válido. Prueba end-to-end con Playwright contra `http://localhost:3000/auth/login`: login con `cliente@ejemplo.co` redirige a home y muestra el toast "¡Bienvenido de nuevo!".

---

## 2026-08-08 — Fix: `/admin` y otras páginas admin crasheaban con "Functions cannot be passed directly to Client Components"

**Problema/Motivo:** Al entrar a `/admin` (y a `/admin/pedidos`, `/admin/productos`, `/admin/productos/papelera`, `/admin/stock`) la app mostraba la pantalla de error de Next.js con el mensaje `Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server"`. Causa raíz: esas 5 páginas son Server Components (leen Prisma directamente, patrón SSR del proyecto) que construían un array `columns` con funciones (`cell: (row) => <JSX>`, `rowKey: (row) => row.id`) y se lo pasaban como prop a `DataTable` (`apps/web/src/components/admin/DataTable.tsx`), que es `'use client'`. Next.js no permite pasar funciones de un Server Component a un Client Component porque no son serializables a través de ese límite. Este bug es preexistente (no relacionado con el fix de login anterior) y bloqueaba el panel admin por completo tras iniciar sesión.

**Cambios:**

- `apps/web/src/lib/format.ts` (nuevo) — util compartido `formatCOP` / `formatDateShort`, reemplaza las copias locales duplicadas en las páginas admin tocadas.
- `apps/web/src/components/admin/RecentOrdersTable.tsx` (nuevo, `'use client'`) — recibe `rows` planos (serializables) y arma `columns`/`cell` internamente. Usado por `apps/web/src/app/admin/page.tsx`.
- `apps/web/src/components/admin/PedidosTable.tsx` (nuevo, `'use client'`) — mismo patrón. Usado por `apps/web/src/app/admin/pedidos/page.tsx`.
- `apps/web/src/components/admin/ProductosTable.tsx` (nuevo, `'use client'`) — mismo patrón; recibe `categories` como dato plano (no funciones) para resolver el nombre de categoría. Usado por `apps/web/src/app/admin/productos/page.tsx`.
- `apps/web/src/components/admin/ProductosPapeleraTable.tsx` (nuevo, `'use client'`) — mismo patrón. Usado por `apps/web/src/app/admin/productos/papelera/page.tsx`.
- `apps/web/src/components/admin/StockTable.tsx` (nuevo, `'use client'`) — mismo patrón. Usado por `apps/web/src/app/admin/stock/page.tsx`.
- Las 5 páginas Server Component (`admin/page.tsx`, `admin/pedidos/page.tsx`, `admin/productos/page.tsx`, `admin/productos/papelera/page.tsx`, `admin/stock/page.tsx`) ahora solo hacen el fetch a Prisma y pasan filas planas a estos wrappers cliente, sin definir `columns` inline.
- `DataTable.tsx` no se modificó — sigue siendo el componente cliente reutilizable, ahora solo consumido a través de wrappers.

**Verificación:** `tsc --noEmit` sin errores. Prueba end-to-end con Playwright (login como `admin@electromotos-tony.co`) contra las 5 rutas: todas cargan con `errorPage=false` y sin errores de consola; capturas confirmaron el render correcto del dashboard, pedidos, productos, papelera y stock bajo.

---

## 2026-08-10 — Feature: tipografía global Oswald (títulos) + Roboto (cuerpo)

**Problema/Motivo:** Se pidió reemplazar la fuente Geist (única, sin diferenciación) por dos familias de Google Fonts optimizadas vía `next/font/google`: Oswald para títulos, nombres de repuesto y encabezados de categoría, y Roboto para cuerpo de texto y UI secundaria.

**Cambios:**

- `apps/web/src/app/layout.tsx` — reemplazado el import de `Geist` por `Oswald` (`--font-oswald`, pesos 500/600/700) y `Roboto` (`--font-roboto`, pesos 400/500/700), ambas con `display: 'swap'`. Las dos variables se aplican en la clase del `<html>` en lugar de `geist.variable`.
- `apps/web/src/app/globals.css` — en el bloque `@theme inline`, `--font-sans` ahora apunta a `var(--font-roboto)` y se agregó `--font-heading: var(--font-oswald), system-ui, sans-serif` (expone la utilidad `font-heading` en Tailwind v4). Se quitó `--font-mono` (apuntaba a una variable de Geist que nunca existía; Tailwind v4 ya trae un fallback mono por defecto). El `body` ahora fija `font-family: var(--font-roboto)...` y se agregó una regla global `h1, h2, h3, h4, h5, h6 { font-family: var(--font-oswald)... }` para que todos los encabezados reales hereden Oswald sin anotación manual.
- `apps/web/src/components/store/ProductCard.tsx` — el `<h3>` del nombre del producto usa explícitamente la clase `font-heading` (Oswald), como ejemplo de aplicación directa en un componente de tarjeta.

**Verificación:** `tsc --noEmit -p apps/web/tsconfig.json` sin errores. Se levantó `pnpm --filter @motek/web dev` y se confirmó por HTML servido (`curl http://localhost:3000/`) que el `<html>` incluye las clases `oswald_..._variable` y `roboto_..._variable` generadas por `next/font/google`.

---

## 2026-08-10 — Feature: encabezado y logo más grandes en desktop

**Problema/Motivo:** El logo del header se veía muy pequeño y alejado del resto de elementos. Se pidió agrandar el logo y, en general, todo el encabezado, mostrando el cambio solo en desktop (mobile ya se veía bien).

**Cambios:**

- `apps/web/src/components/nav/Navbar.tsx` — en el layout de catálogo (`isCatalog`), la barra pasó de `h-16` a `h-16 md:h-20` y el logo de `w-[70px]` fijo a `w-[70px] md:w-[100px]` (mobile sin cambios, imagen escalada vía CSS manteniendo el `width`/`height` intrínsecos del `<Image>` para la optimización de Next). En el layout estándar (dos niveles), el nivel superior pasó de `h-16` a `h-16 md:h-20` y el logo de `w-[80px]` fijo a `w-[80px] md:w-[120px]`.

**Verificación:** `tsc --noEmit -p apps/web/tsconfig.json` sin errores. Se levantó `pnpm --filter @motek/web dev` y se tomaron capturas con Playwright CLI (`playwright screenshot`) en viewport desktop (1440×900) y mobile (390×844): en desktop el logo y la barra se ven notoriamente más grandes sin romper la alineación con buscador/cuenta/carrito; en mobile el header quedó visualmente idéntico al estado anterior.

---

## 2026-08-10 — Fix: badge de cantidad del carrito se veía cortado + iconos de cuenta/carrito más grandes en desktop

**Problema/Motivo:** El número de productos en el carrito (badge rojo sobre el ícono del carrito) se veía roto/cortado en el header. Causa raíz: el `<Link>` de `CartIcon.tsx` no tenía `display` explícito (usaba el `inline` por defecto de un `<a>`), y con `p-2` de padding sobre un elemento inline, Chromium calcula el bounding box del enlace de forma inconsistente con el tamaño visual real del ícono (se infló verticalmente muy por encima del ícono, con `top` casi en `y=-2`). El badge (`position: absolute`, `-top-1 -right-1`) se posicionaba en base a ese box inflado, quedando pegado al borde superior del header y cortado por el viewport. Adicionalmente se pidió agrandar los iconos de "Mi cuenta" y carrito, solo en desktop (mismo criterio que el cambio de logo/header previo — mobile ya se veía bien).

**Cambios:**

- `apps/web/src/components/ui/CartIcon.tsx` — el `<Link>` pasó de `relative ...` a `relative inline-flex items-center justify-center ...`, forzando que el box del enlace se ajuste exactamente al ícono + padding (fix real del bug, no un parche de posición del badge). El ícono SVG creció de `w-6 h-6` a `w-6 h-6 md:w-7 md:h-7` (más grande solo en desktop).
- `apps/web/src/components/nav/Navbar.tsx` — el ícono SVG del botón "Mi cuenta" creció de `w-5 h-5` a `w-5 h-5 md:w-6 md:h-6` en ambos layouts (catálogo y estándar).

**Verificación:** `tsc --noEmit -p apps/web/tsconfig.json` sin errores. Se levantó `pnpm --filter @motek/web dev`, se agregó un producto al carrito vía script de Playwright y se capturó el header: el badge ahora muestra el número completo ("1") sin cortes, tanto en desktop (1440×900) como en mobile (390×844); en desktop los iconos de cuenta y carrito se ven notoriamente más grandes, mobile quedó sin cambios de tamaño.

---

## 2026-08-10 — Rediseño de cards de "Categorías" en landing + fix de "Frenos" como categoría raíz

**Problema/Motivo:** Se pidió rediseñar la sección "Categorías" de la landing para que las cards fueran mucho más grandes y visualmente protagónicas, eliminando el texto de descripción y dejando únicamente título + imagen de fondo grande. Además, la sección mostraba por error una categoría padre "Frenos" (no debía existir como categoría raíz) en lugar de "Sistema Eléctrico". Investigación: `Sistema Eléctrico` ya era una categoría raíz totalmente soportada en el frontend (ícono/imagen/descripción en `CategoryGrid.tsx`) y en el seed canónico `packages/database/prisma/catalog.ts` (donde "Frenos" es correctamente una subcategoría de "Repuestos"). El bug venía de `packages/database/prisma/seed.ts` (seed de demo, `pnpm db:seed`), que creaba "Frenos" como categoría **raíz** independiente (`parentId` nulo) — si esa fila quedaba en la base de datos, el query de `getCachedHomeCategories()` (`parentId: null`, top 5 alfabético) la traía y aparecía en el grid de la home.

**Cambios:**

- `apps/web/src/components/store/CategoryGrid.tsx` — rediseño completo de la card: se eliminaron los mapas `CAT_ICONS` y `CATEGORY_DESCRIPTIONS` (y el bloque `<p>` de descripción) y el import no usado de `Card`. Las cards pasaron de `w-[140/160/180px]` con imagen `aspect-square object-contain` (miniatura + texto debajo) a `w-[240/280/320px]` `aspect-[4/5]` con imagen `object-cover` de fondo, degradado inferior (`bg-gradient-to-t from-black/80`) y el título superpuesto en grande (`text-2xl md:text-3xl font-black uppercase`) sobre la imagen — solo título + imagen, sin descripción.
- `packages/database/prisma/seed.ts` — se reordenó la creación de categorías: `frenos` ya no se crea como raíz antes de `sistemaElectrico`; ahora se crea después de `repuestos` con `parentId: repuestos.id` (igual que `motores` es subcategoría de `sistemaElectrico`), para que nunca vuelva a aparecer como categoría raíz en la home tras correr `pnpm db:seed`.

**Verificación:** `pnpm --filter @motek/web exec tsc --noEmit -p tsconfig.json` sin errores. Grep confirmó que no quedan referencias a `CAT_ICONS`/`CATEGORY_DESCRIPTIONS` en `apps/web/src`. No se corrió `pnpm db:seed` contra una base de datos real en esta sesión (cambio de código verificado por lectura; pendiente que quien tenga acceso a la DB de cada ambiente confirme si existe una fila raíz `frenos` preexistente que deba corregirse/reasignarse manualmente, ya que el seed con `upsert` solo actualiza el `parentId` si se vuelve a ejecutar el seed).

---

## 2026-08-10 — Ajuste de tamaño de las cards de "Categorías" (más pequeñas)

**Problema/Motivo:** Tras el rediseño anterior de la sección "Categorías", el usuario pidió reducir un poco el tamaño de las cards (quedaron demasiado grandes).

**Cambios:**

- `apps/web/src/components/store/CategoryGrid.tsx` — ancho de card de `w-[240/280/320px]` a `w-[180/200/220px]`; título de `text-2xl md:text-3xl` a `text-lg md:text-xl`; padding del overlay de título de `p-5` a `p-4`; `sizes` del `next/image` ajustado a los nuevos anchos.

**Verificación:** cambio de clases Tailwind únicamente, sin lógica nueva; consistente con el resto del componente ya verificado (`tsc --noEmit` previo).

---

## 2026-08-10 — Cards de "Categorías" 30% más grandes

**Problema/Motivo:** El ajuste anterior dejó las cards demasiado pequeñas; el usuario pidió aumentarlas ~30% respecto al último tamaño.

**Cambios:**

- `apps/web/src/components/store/CategoryGrid.tsx` — ancho de card de `w-[180/200/220px]` a `w-[230/260/286px]` (+~30%); título de `text-lg md:text-xl` a `text-xl md:text-2xl`; padding del overlay de `p-4` a `p-5`; `sizes` del `next/image` actualizado a los nuevos anchos.

**Verificación:** cambio de clases Tailwind únicamente; sin impacto en lógica ya verificada.

---

## 2026-08-10 — Fix de datos: "Frenos" seguía apareciendo como categoría raíz en producción + cards 5% más pequeñas

**Problema/Motivo:** El usuario mostró una captura del home en vivo donde seguía apareciendo "Frenos" en la sección "Categorías" en lugar de "Sistema Eléctrico". El fix anterior (2026-08-10, entrada "Rediseño de cards...") solo corrigió el script `seed.ts` para futuras ejecuciones; no tocó los datos ya existentes en la base de datos real (Neon, compartida por `packages/database/.env`, `apps/api/.env` y `apps/web/.env.local`). Se inspeccionó la DB directamente y se confirmó: existía una fila `Category` raíz `frenos` (`parentId: null`, con 3 productos asociados) y `Sistema Eléctrico` ya era raíz pero quedaba 6ta en orden alfabético — por eso `getCachedHomeCategories()` (`parentId: null`, `orderBy: name asc`, `take: 5`) nunca la incluía en el top 5 mientras "Frenos" ocupara un lugar. Adicionalmente, se pidió reducir el tamaño de las cards un 5% más respecto al ajuste anterior.

**Cambios:**

- Base de datos (Neon, producción): se actualizó la fila `Category` con `slug: 'frenos'` para asignarle `parentId` = id de `Repuestos` (antes `null`), convirtiéndola en subcategoría — igual que ya la define el seed canónico `catalog.ts` y el `seed.ts` corregido. Los 3 productos de "Frenos" mantienen su `categoryId` sin cambios. Verificado que el top-5 alfabético de categorías raíz pasó a ser: Accesorios, Aceites, Llantas, Repuestos, Sistema Eléctrico.
- `apps/web/src/components/store/CategoryGrid.tsx` — ancho de card de `w-[230/260/286px]` a `w-[219/247/272px]` (-5%); `sizes` del `next/image` actualizado a los nuevos anchos. Título y padding sin cambios.

**Verificación:** Script ad-hoc con Prisma (`packages/database`, usando `PrismaClient`/`PrismaPg` igual que `seed.ts`) confirmó antes y después del update el listado de categorías raíz y el nuevo `parentId` de "Frenos". El home usa `unstable_cache` con `revalidate: 3600` y tag `categories`; el cambio de datos se reflejará automáticamente en máximo 1 hora, o antes si un admin dispara `POST /api/admin/revalidate` con `{ tags: ['categories'] }` (requiere sesión ADMIN, no disponible en esta sesión de agente).

---

## 2026-08-10 — `/catalogo` pasa a mostrar el catálogo completo por defecto (se elimina la vista landing)

**Problema/Motivo:** `(store)/catalogo/page.tsx` tenía dos vistas conmutadas por un flag `isGridView`: sin parámetros mostraba una landing con hero/parallax, carrusel "Explorar por categoría" y secciones editoriales por categoría; con `category`/`search`/`inStock`/`minPrice`/`maxPrice`/`showAll=true` mostraba el grid paginado con filtros. Se pidió simplificar la UX eliminando la landing y haciendo que el comportamiento de `?showAll=true` (grid completo, sin filtros) sea el default de `/catalogo`.

**Cambios:**

- `apps/web/src/app/(store)/catalogo/page.tsx` — se eliminó la rama `LandingView` y el flag `showAll` de `searchParams`; `CatalogPage` ahora siempre ejecuta la lógica de `GridView` (antes solo se activaba con filtros), incluyendo el caso sin filtros ("Todo el catálogo"). Se quitaron los imports, tipos y constantes exclusivos de la landing (`CatalogHero`, `CategoryExploreCarousel`, `CategoryHeroBanner`, `ProductCarousel`, `WHATSAPP_URL`, `TRUST`, `PrismaProductRaw`, `CategoryFull`, `toDomain`, `BANNER`/`getBanner`).
- `apps/web/src/components/store/CatalogHero.tsx`, `CategoryExploreCarousel.tsx`, `CategoryHeroBanner.tsx`, `ProductCarousel.tsx` — eliminados (solo se usaban desde la landing del catálogo, sin otros consumidores en el repo).
- `apps/web/src/lib/cache.ts` — se eliminó `getCachedCatalogLanding`, su tipo `CachedLandingData` y la constante `LANDING_PRODUCTS_PER_CATEGORY` (sin más llamadores tras el cambio anterior); se actualizó el comentario del tag `catalog` en la cabecera del archivo.
- `apps/web/src/app/(store)/home.tsx` y `apps/web/src/app/(store)/carrito/page.tsx` — los links a `/catalogo?showAll=true` se simplificaron a `/catalogo` (ya no aportan nada distinto).
- `apps/web/next.config.ts` — se agregó un redirect 301 (`has: query showAll=true` → `/catalogo`) para no romper bookmarks/enlaces externos que ya apuntaran a `?showAll=true`.
- `apps/web/e2e/catalog.spec.ts` — el test `'catálogo — carga productos'` ahora valida explícitamente el heading "Todo el catálogo" y la presencia del botón "Seleccionar filtros" (confirma vista grid, no landing); se agregó un test nuevo que verifica el redirect de `?showAll=true` a `/catalogo`.

**Verificación:** `pnpm --filter @motek/web type-check` (0 errores) y `pnpm --filter @motek/web lint` (0 errores; los 22 warnings restantes son preexistentes en archivos no tocados por este cambio, confirmado por `grep` de `showAll`/componentes eliminados en todo `apps/`, que solo devuelve coincidencias esperadas en `next.config.ts` y `catalog.spec.ts`).

---

## 2026-08-11 — Docs: auditoría de variables de entorno faltantes para el primer deploy

**Problema/Motivo:** El usuario pidió un inventario de las variables de entorno que faltan configurar (en GitHub, Vercel y Google Cloud Platform) antes de poder lanzar el proyecto a producción, para tener un checklist único de bloqueantes.

**Cambios:**

- `docs/faltantes-deploy.md` (nuevo) — documento con el detalle de variables de entorno por plataforma (GitHub Actions/CI-CD, Vercel para `apps/web`, Cloud Run para `apps/api`), contrastando `.env.example` de cada app contra los `.env` locales y el uso real en código (incluye variables usadas en código pero no documentadas en `.env.example`, como `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET` y `MAX_SHIPPING_CHARGE_CENTS`), y un resumen de los bloqueantes reales para el primer deploy.

**Verificación:** Solo documentación (no hay código ejecutable que probar); el contenido se armó revisando `apps/api/.env.example`, `apps/web/.env.example`, los `.env`/`.env.local` reales (solo nombres de clave, sin exponer valores), `apps/api/src/main.ts` (`assertEnvVars`), `.github/workflows/ci.yml`, `apps/api/Dockerfile`, `vercel.json` y grep de `process.env` en `apps/web/src` y `apps/api/src`.

---

## 2026-08-14 — Feature: carrito como Side Drawer (panel lateral) + `/carrito` como vista detallada

**Problema/Motivo:** Se pidió mejorar la UX del carrito para que la interacción principal fuera un panel lateral (side drawer) que no navegue de página, manteniendo `/carrito` como vista completa opcional accesible desde un botón "Ver carrito" dentro del panel.

**Cambios:**

- `apps/web/src/lib/cart-drawer.ts` (nuevo) — store Zustand de UI (`isOpen`/`open`/`close`/`toggle`), sin `persist` a propósito (es estado efímero de UI, no debe reabrirse solo al recargar). Separado de `useCart()` (`apps/web/src/lib/cart.ts`), que sigue siendo la única fuente de verdad de los datos del carrito (items, cantidades, total); ambos leen del mismo store de dominio por lo que el drawer y `/carrito` quedan sincronizados automáticamente sin lógica adicional.
- `apps/web/src/components/cart/CartDrawer.tsx` (nuevo) — panel lateral: overlay + `aside` deslizante desde la derecha, cierre con click en overlay, botón X o tecla `Escape`, bloqueo de scroll del `body` mientras está abierto, empty state propio y footer con subtotal + botón principal "Ver carrito" (`Link` a `/carrito`).
- `apps/web/src/components/cart/CartDrawerItem.tsx` (nuevo) — fila compacta reutilizada dentro del drawer (miniatura, nombre, controles +/-, eliminar), usando `updateQuantity`/`removeItem` de `useCart()`.
- `apps/web/src/lib/format.ts` — se agregó `formatCOP` como export compartido (ya existía `formatDateShort` de un cambio anterior); se eliminaron las copias locales duplicadas de `formatCOP` en `apps/web/src/app/(store)/carrito/page.tsx` y `apps/web/src/components/store/ProductCard.tsx`, que ahora importan el helper.
- `apps/web/src/components/ui/CartIcon.tsx` — pasó de `<Link href="/carrito">` a `<button onClick={toggle}>` que abre el drawer en vez de navegar.
- `apps/web/src/components/store/AddToCartWithQuantity.tsx` y `apps/web/src/components/store/ProductCard.tsx` (`CartHoverButton`) — al agregar un producto (página de detalle o card del catálogo) ahora también se llama `open()` del store del drawer, para dar feedback inmediato del ítem agregado.
- `apps/web/src/app/(store)/layout.tsx` — se monta `<CartDrawer />` una sola vez a nivel de layout de `(store)`, junto al `Navbar`/`Footer`, para que esté disponible en cualquier ruta del storefront.
- `apps/web/src/app/globals.css` — se agregó el keyframe `slideIn` (deslizamiento del panel desde la derecha), usado por `CartDrawer.tsx`.
- `apps/web/src/app/(store)/carrito/page.tsx` — sin cambios funcionales; sigue siendo la vista detallada completa (lista de ítems, cotizador de envío, vaciar carrito, checkout), solo se actualizó el import de `formatCOP`.

**Verificación:** `pnpm --filter @motek/web exec tsc --noEmit -p tsconfig.json` sin errores. `pnpm --filter @motek/web exec eslint` sobre los archivos tocados sin errores. `apps/web/e2e/cart.spec.ts` no requirió cambios (navega directo a `/carrito` vía `page.goto`, no interactúa con `CartIcon`). Pendiente verificación visual manual en navegador (abrir drawer desde el ícono del carrito, agregar producto y confirmar apertura automática, click en "Ver carrito" y confirmar sincronía de cantidades con la página completa) — no se levantó `pnpm dev` en esta sesión.

---

## 2026-08-14 — Ajuste: animación de entrada del CartDrawer + subtotal/botón "Ver carrito" más grandes

**Problema/Motivo:** El drawer del carrito no tenía una animación de entrada perceptible (usaba una clase Tailwind arbitraria `animate-[slideIn_...]` referenciando un `@keyframes` global suelto, en vez de seguir el patrón ya usado en el proyecto de registrar animaciones reutilizables vía `@utility`). Además, en pantallas de escritorio el subtotal y el botón "Ver carrito" del footer se veían demasiado pequeños/poco protagónicos.

**Cambios:**

- `apps/web/src/app/globals.css` — el `@keyframes slideIn` suelto se reemplazó por `@keyframes cartDrawerSlideIn` + `@utility animate-cartDrawerIn` (mismo patrón que `animate-fadeIn` ya existente en el archivo), con easing `cubic-bezier(0.16, 1, 0.3, 1)` (deceleración suave) y duración 0.3s.
- `apps/web/src/components/cart/CartDrawer.tsx` — el `<aside>` del panel usa la nueva clase `animate-cartDrawerIn` (entra deslizándose desde la derecha); el overlay ahora usa `animate-fadeIn` para atenuarse junto con la entrada del panel. En el footer: el label "Subtotal" pasó de `text-sm` a `text-base`, el monto de `text-lg` a `text-2xl`, y el botón "Ver carrito" de `py-3 text-base` (implícito) a `py-4 text-lg`, con más espaciado vertical entre elementos (`space-y-3` → `space-y-4`, `py-4` → `py-5` en el contenedor).

**Verificación:** `pnpm --filter @motek/web exec tsc --noEmit -p tsconfig.json` sin errores. `pnpm --filter @motek/web exec eslint src/components/cart/CartDrawer.tsx` sin errores. Verificación visual pendiente (no se levantó `pnpm dev` en esta sesión).

---

## 2026-08-14 — Feature: botón "Finalizar pedido" en el CartDrawer

**Problema/Motivo:** El drawer solo tenía el botón "Ver carrito" (a `/carrito`); se pidió agregar también el botón "Finalizar pedido" (directo a `/checkout`), igual que ya existe en la página completa del carrito, en el mismo footer del panel.

**Cambios:**

- `apps/web/src/components/cart/CartDrawer.tsx` — el footer ahora tiene dos CTAs: "Finalizar pedido →" (`Link` a `/checkout`, estilo primario `bg-sky-500`, el mismo look que el botón equivalente en `apps/web/src/app/(store)/carrito/page.tsx`) y debajo "Ver carrito" (`Link` a `/carrito`, degradado a estilo secundario con borde, `border-gray-200 text-gray-700 hover:bg-gray-50`) para diferenciar la acción principal (pagar) de la secundaria (ver detalle).

**Verificación:** `pnpm --filter @motek/web exec tsc --noEmit -p tsconfig.json` sin errores. `pnpm --filter @motek/web exec eslint src/components/cart/CartDrawer.tsx` sin errores. Verificación visual pendiente (no se levantó `pnpm dev` en esta sesión).

---

## 2026-08-14 — Fix: botón de agregar al carrito de las product cards invisible en mobile

**Problema/Motivo:** El botón circular de "agregar al carrito" sobre las product cards (`CartHoverButton` en `ProductCard.tsx`) solo se hacía visible vía `group-hover` sobre el contenedor de la card. En dispositivos táctiles no existe un estado `:hover` persistente, por lo que el botón era prácticamente inalcanzable en mobile — el único camino para agregar al carrito desde el catálogo era entrar al detalle del producto.

**Cambios:**

- `apps/web/src/components/store/ProductCard.tsx` (`CartHoverButton`) — las clases de visibilidad pasaron de `opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0` (oculto siempre salvo hover) a `opacity-100 translate-y-0 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0` (visible siempre por debajo de `md`, con el hover-reveal original intacto en desktop). Tamaño del botón subido de `w-10 h-10` a `w-11 h-11 md:w-10 md:h-10` (mejor touch target en mobile, ~44px). Se agregó `ring-1 ring-black/5` al estado por defecto para mejorar el contraste ahora que queda visible permanentemente sobre la imagen del producto en mobile.

**Verificación:** `pnpm --filter @motek/web exec tsc --noEmit -p tsconfig.json` sin errores. `pnpm --filter @motek/web exec eslint src/components/store/ProductCard.tsx` sin errores. Verificación visual pendiente (no se levantó `pnpm dev` en esta sesión).

---

## 2026-08-14 — Rediseño CRO/UX de la página de detalle de producto (`/producto/[slug]`)

**Problema/Motivo:** Se pidió optimizar conversión y UX del detalle de producto separando la intención de "compra rápida" de la de "investigación", con requerimientos específicos: galería con miniaturas verticales + zoom (hover desktop / tap mobile), trustbars y contador de urgencia debajo del precio, sticky bottom bar de compra en mobile, y separación visual de la zona "comprar" vs. la zona "informarse" (descripción, compatibilidad, políticas). La tabla de compatibilidad extensa requería migrar de texto libre (`ProductDescription.compatibility[]`) al modelo estructurado `MotorcycleCompatibility` (brand/model/year) que ya existía en el schema de Prisma pero no tenía ningún flujo de escritura implementado.

**Cambios:**

- `apps/web/src/components/store/ProductImageGallery.tsx` — reescrito: miniaturas en columna vertical a la izquierda de la imagen principal (antes fila horizontal debajo), zoom tipo "lens" con `onMouseMove` + `background-position` en desktop, lightbox a pantalla completa al hacer tap/click.
- `apps/web/src/lib/cloudinary.ts` — nuevo contexto de imagen `'zoom'` (ancho 1600px) usado por el lens y el lightbox.
- `apps/web/src/components/store/TrustBadgeRow.tsx`, `UrgencyStockCounter.tsx` (nuevos) — insignias de pago/envío y mensaje de urgencia ("¡Solo N unidades disponibles!", umbral ≤5) extraídos como componentes, ubicados inmediatamente debajo del precio.
- `apps/web/src/components/store/StickyBuyBar.tsx` (nuevo) — barra fija `fixed bottom-0 z-50 md:hidden` con precio + `AddToCartWithQuantity`. El CTA de compra a mitad de página ahora se oculta en mobile (`hidden md:block` en `page.tsx`).
- `apps/web/src/components/store/AddToCartWithQuantity.tsx` — nuevo prop `compact` (colapsa el stepper de cantidad en pantallas muy angostas dentro de la sticky bar).
- `apps/web/src/components/store/ProductCompatibilityTable.tsx`, `ProductInfoSection.tsx` (nuevos) — tabla estructurada Marca/Modelo/Año y sección inferior con fondo `c-surface-2` que agrupa descripción, beneficios, compatibilidad y políticas de envío/cambios, separada visualmente de la zona de compra (mismo patrón que "Productos relacionados").
- `apps/web/src/app/(store)/producto/[slug]/page.tsx` — recompuesto: zona "comprar" (galería + SKU/nombre/precio/trustbar/urgencia/CTA) arriba, `ProductInfoSection` debajo del fold, `StickyBuyBar` mobile. Se quitó del query el `include: compatibility` de `ProductDescription` (ya no se renderiza texto libre) y se pasa `product.compatible` (ya incluido por el repositorio) a la tabla estructurada.
- **Migración de compatibilidad a `MotorcycleCompatibility`:**
  - `apps/api/src/admin/dto/motorcycle-compatibility.dto.ts` (nuevo) — DTO `{ brand, model, year? }`.
  - `apps/api/src/admin/dto/create-product.dto.ts`, `update-product.dto.ts` — nuevo campo `compatible?: MotorcycleCompatibilityDto[]`.
  - `apps/api/src/admin/admin-products.controller.ts` — `create`/`update` mapean `dto.compatible` hacia el repositorio.
  - `apps/web/src/infrastructure/repositories/PrismaProductRepository.ts` y `apps/api/src/infrastructure/repositories/PrismaProductRepository.ts` — el método `update()` ignoraba silenciosamente `data.compatible` (solo `save()`/creación lo manejaba); ahora reemplaza la lista completa (`deleteMany` + `create`), mismo patrón que benefits/compatibility de `ProductDescription`.
  - `apps/web/src/components/admin/ProductEditForm.tsx` — la sección "Compatibilidad" pasó de una lista de texto libre a filas estructuradas Marca/Modelo/Año, enviadas como `compatible` en el payload del producto (no en el endpoint de descripción). El endpoint `PUT /admin/products/:id/description` ahora siempre envía `compatibility: []` para descontinuar el texto libre legado en cada guardado.
  - `apps/web/src/app/admin/productos/[id]/page.tsx` — `initialCompatibility` ahora se deriva de `foundProduct.compatible` (estructurado) en vez de `structuredDescription.compatibility` (texto libre).
- No se implementó ficha técnica ("specs") porque no existe ningún campo de dominio para ello (weightKg/heightCm/etc. son dimensiones de envío, no especificaciones de producto) — pendiente de definición de datos con negocio antes de construir esa sección.

**Verificación:** `pnpm --filter @motek/web type-check`, `pnpm --filter @motek/api type-check` y `pnpm --filter @motek/domain exec tsc --noEmit` sin errores. `pnpm --filter @motek/web lint` sin errores (23 warnings preexistentes no relacionados). Verificación visual en navegador pendiente (no se levantó `pnpm dev` en esta sesión) — recomendado antes de mergear, en especial el zoom hover/lightbox y el offset de la sticky bar sobre el footer.

---

## 2026-08-14 — Ajustes al rediseño de `/producto`: "Información Adicional" y enlace de Addi como texto

**Problema/Motivo:** Ajustes solicitados sobre el rediseño de detalle de producto entregado en la entrada anterior: renombrar la sección "Beneficios" a "Información Adicional" (nombre más genérico, ya que el contenido no siempre son beneficios estrictos) y reemplazar el botón sólido "Pagar con Addi" por una frase de texto que conduce al mismo enlace de WhatsApp, manteniendo solo "¿Prefieres pagar con Addi?" subrayado en azul.

**Cambios:**

- `apps/web/src/components/store/ProductInfoSection.tsx` — título de sección `Beneficios` → `Información Adicional` (zona "informarse" del detalle de producto).
- `apps/web/src/components/admin/ProductEditForm.tsx` — label, botón "Agregar beneficio" → "Agregar ítem" y placeholders/aria-labels del bloque correspondiente actualizados a "Información Adicional" / "Ítem N", para que el admin edite el mismo campo con el nombre que ahora ve el cliente.
- `apps/web/src/components/store/PayWithAddiButton.tsx` — dejó de ser un botón sólido azul con ícono; ahora es un enlace de texto: `¿Prefieres pagar con Addi?` (subrayado, `text-[#1A57FF]`) seguido de `Contacta con nuestra línea para coordinar la compra.` (texto normal). Todo el bloque sigue siendo un único `<a>` hacia la misma URL de WhatsApp pre-armada (sin cambios en `buildWhatsappUrl`).
- `apps/web/src/app/(store)/producto/[slug]/page.tsx` — se quitó el espaciador `w-[106px]` (ya no aplica, era para alinear el botón sólido bajo el stepper de cantidad); el bloque de Addi ahora es un simple párrafo (`mt-3`) debajo de "Agregar al carrito", texto `c-text-2`.

**Verificación:** `pnpm --filter @motek/web type-check` sin errores. Verificación visual pendiente (no se levantó `pnpm dev` en esta sesión).

---

## 2026-08-14 — Escalado de la zona de compra en desktop (`/producto`)

**Problema/Motivo:** Se pidió que la galería, el texto (nombre, SKU), el precio, los badges y los botones del detalle de producto fueran más grandes **solo en desktop**, manteniendo el layout mobile intacto.

**Cambios (todos vía prefijo `md:` de Tailwind, sin afectar mobile):**

- `apps/web/src/app/(store)/producto/[slug]/page.tsx` — contenedor `max-w-5xl` → `md:max-w-6xl lg:max-w-7xl`; `gap-12` → `md:gap-16` en el grid; SKU `text-sm` → `md:text-base`; nombre `text-3xl` → `md:text-4xl lg:text-5xl`; precio `text-4xl` → `md:text-5xl`; badges de stock con `md:text-sm md:px-3 md:py-1`; texto de Addi `text-sm` → `md:text-base`.
- `apps/web/src/components/store/ProductImageGallery.tsx` — columna de miniaturas `w-20`/`h-20` → `md:w-28 md:h-28` (más alto máximo `md:max-h-[620px]`), flechas de navegación `w-9 h-9` → `md:w-11 md:h-11` (íconos `md:w-5 md:h-5`); el contenedor de la imagen principal escala automáticamente al ser `flex-1` dentro del grid más ancho.
- `apps/web/src/components/store/TrustBadgeRow.tsx`, `UrgencyStockCounter.tsx` — texto e íconos con `md:text-sm`/`md:text-base` y `md:w-5 md:h-5`.
- `apps/web/src/components/store/AddToCartWithQuantity.tsx` — en el modo no-compacto (que solo se renderiza dentro de wrappers `hidden md:block`, es decir, siempre en desktop) el botón "Agregar al carrito" y el stepper de cantidad ganan `md:h-16 md:px-8 md:text-lg` / `md:w-11 md:h-14`.

**Verificación:** `pnpm --filter @motek/web type-check` sin errores. Verificación visual pendiente (no se levantó `pnpm dev` en esta sesión).

---

## 2026-08-14 — Galería más protagonista, panel de compra ~30% más compacto (desktop)

**Problema/Motivo:** Ajuste sobre el escalado desktop anterior: la galería debía ganar aún más protagonismo visual, mientras que el texto, botones y badges del panel de compra debían reducirse ~30% respecto al tamaño que tenían tras el escalado previo (quedando, en varios casos, más chicos que en mobile — es un panel secundario compacto a propósito, la imagen es el foco).

**Cambios (desktop, vía `md:`; mobile sin cambios):**

- `apps/web/src/app/(store)/producto/[slug]/page.tsx` — grid `md:grid-cols-2` → `md:grid-cols-[3fr_2fr]` (galería ocupa 60% del ancho, detalle 40%), `gap-16` → `md:gap-10`. Tamaños reducidos ~30% respecto al paso anterior: SKU `md:text-base`(16px) → `md:text-[11px]`; nombre `md:text-4xl/lg:text-5xl` → `md:text-[25px]/lg:text-[27px]`; precio `md:text-5xl`(48px) → `md:text-[34px]`; badges de stock `md:text-sm md:px-3 md:py-1` → `md:text-[10px] md:px-2 md:py-0.5`; texto de Addi `md:text-base` → `md:text-[11px]`.
- `apps/web/src/components/store/TrustBadgeRow.tsx`, `UrgencyStockCounter.tsx` — texto/íconos reducidos a `md:text-[10px]`/`md:text-[11px]` y `md:w-[14px] md:h-[14px]` (antes `md:text-sm`/`md:text-base` y `md:w-5 md:h-5`).
- `apps/web/src/components/store/AddToCartWithQuantity.tsx` — botón "Agregar al carrito" `md:h-16 md:px-8 md:text-lg` → `md:h-[45px] md:px-[22px] md:text-[13px]`; stepper de cantidad `md:w-11 md:h-14` → `md:w-[31px] md:h-[39px]`, contador `md:w-10 md:text-base` → `md:w-[28px] md:text-[11px]`.
- `apps/web/src/components/store/ProductImageGallery.tsx` — `sizes` de la imagen principal ajustado a `60vw` en desktop (antes `50vw`, ya no coincide con el ancho real de columna tras el cambio de ratio) y padding reducido `p-6` → `md:p-5` para mostrar más producto.

**Verificación:** `pnpm --filter @motek/web type-check` sin errores. Verificación visual pendiente (no se levantó `pnpm dev` en esta sesión) — revisar que el nombre del producto no rompa el layout en SKUs con nombres muy largos dado el panel más angosto (`2fr` de 5 columnas).

---

## 2026-08-14 — Prueba social, urgencia y facilidades de pago en `/producto` (desktop)

**Problema/Motivo:** Tras el ajuste anterior el panel de compra quedó demasiado chico; se pidió agrandarlo un poco y sumar tres elementos de CRO: contador de "personas viendo este producto" (prueba social), mensaje de urgencia más directo en el badge de stock, y una franja de logos de medios de pago aceptados.

**Cambios:**

- `apps/web/src/components/store/LiveViewersCounter.tsx` (nuevo, client component) — texto `🔥 N personas están viendo este producto` en color `--c-warning` (naranja del design system). `N` es un valor entre 10 y 200 sorteado en el cliente (evita mismatch de hidratación: arranca en `null` y se sortea en `useEffect`) que hace un "random walk" (`±15`, clamp 10–200) cada 10s vía `setInterval`, en vez de saltar a un valor totalmente aleatorio cada vez — se ve más creíble como actividad real.
- `apps/web/src/components/store/PaymentMethodsRow.tsx` (nuevo) — franja "Facilidades de pago" con los 6 logos de `apps/web/public/assets/facilidadesPago/` (PSE, Bancolombia, Nequi, Visa, Mastercard, Amex) vía `next/image`, debajo del CTA de compra (bloque desktop).
- `apps/web/src/app/(store)/producto/[slug]/page.tsx` — se agregó `LiveViewersCounter` entre `TrustBadgeRow` y `UrgencyStockCounter`, y `PaymentMethodsRow` debajo del texto de Addi. El badge de stock (caso `stock > 5`) cambió de `En stock (N unidades)` a `¡Solo quedan N productos en stock, apúrate!`. Tamaños del panel de compra subidos moderadamente respecto al ajuste anterior (ej. SKU `md:text-[11px]`→`md:text-[13px]`, nombre `md:text-[25px]/lg:text-[27px]`→`md:text-[28px]/lg:text-[32px]`, precio `md:text-[34px]`→`md:text-[38px]`, badges `md:text-[10px]`→`md:text-[12px]`).
- `apps/web/src/components/store/TrustBadgeRow.tsx`, `UrgencyStockCounter.tsx`, `AddToCartWithQuantity.tsx` — mismo ajuste de tamaño moderado hacia arriba (texto e íconos `md:text-[10-11px]`→`md:text-[12-14px]`, botón "Agregar al carrito" `md:h-[45px]`→`md:h-[52px]`, stepper `md:w-[31px] md:h-[39px]`→`md:w-[36px] md:h-[46px]`).

**Verificación:** `pnpm --filter @motek/web type-check` sin errores. `pnpm --filter @motek/web exec eslint` sobre los archivos tocados: 0 errores (1 warning preexistente en el patrón `setState` dentro de `useEffect`, igual al ya presente en `Navbar.tsx`/`shipping-quote.ts`, necesario aquí para evitar mismatch de hidratación con el valor aleatorio). Verificación visual pendiente (no se levantó `pnpm dev` en esta sesión) — revisar que los 6 logos de pago carguen correctamente desde `public/assets/facilidadesPago/`.

---

## 2026-08-14 — Poblar MotorcycleCompatibility con las 12 marcas pedidas (previo a "Buscar por moto")

**Problema/Motivo:** Como paso previo al feature de navegación "Buscar por moto" (Marca → Modelo) que se planificó para el header, se pidió poblar `MotorcycleCompatibility` con las marcas AKT, Auteco, Bajaj, Benelli, Hero, Honda, Kawasaki, KTM, Royal Enfield, Suzuki, TVS y Yamaha. Se evaluaron dos enfoques: (a) tabla de referencia independiente sin ligar a productos reales, o (b) ligar la compatibilidad a productos reales ya sembrados — el negocio eligió (b) explícitamente pese al riesgo señalado de mostrar fitment inventado en productos reales.

Para minimizar ese riesgo sin dejar de cumplir lo pedido: la compatibilidad se cargó en dos categorías separadas, ambas basadas en datos verificables del propio catálogo (no asociaciones al azar):
1. **Específica** — solo para los 8 productos de los 31 sembrados (`prisma/seed.ts`) cuyo nombre ya menciona una moto puntual (ej. "Pastillas de freno Brembo Yamaha FZ25" → Yamaha FZ25), reutilizando el modelo/año exacto que ya traía el nombre.
2. **Universal** — el resto del catálogo (llantas de medida genérica, aceites, accesorios como cascos/guantes/candados, bujía y cadena) no depende de una moto puntual — genuinamente calzan en cualquier marca. Se etiquetaron como `"Todos los modelos"` en las 12 marcas pedidas, para que Auteco, Benelli, Hero, Kawasaki, KTM, Royal Enfield, Suzuki y TVS —que hoy no tienen ningún repuesto con modelo puntual en este catálogo de 31 productos— también aparezcan en el futuro selector, sin inventar que un candado "sirve para" una Royal Enfield Classic 350 específica.

**Cambios:**

- `packages/database/prisma/seed-motorcycle-compatibility.ts` (nuevo) — script idempotente (borra y recrea por SKU, se puede re-ejecutar sin duplicar) que carga `SPECIFIC_COMPATIBILITY` (8 productos, 16 filas) y `UNIVERSAL_SKUS` (23 productos × 12 marcas = 276 filas) contra la base de datos real vía `@motek/database`.
- `packages/database/package.json` — nuevo script `"moto-compat": "tsx prisma/seed-motorcycle-compatibility.ts"`.
- `package.json` (raíz) — nuevo script `"db:moto-compat": "pnpm --filter @motek/database moto-compat"`.
- **Nota de datos:** el script está escrito contra los 31 SKUs de `prisma/seed.ts` (lo que hay realmente cargado en esta base de datos), no contra `prisma/catalog.ts` (85 productos, catálogo real del negocio que todavía no está sembrado en este entorno). Cuando se cargue el catálogo real habrá que re-mapear los SKUs específicos a los nombres reales de esos 85 productos — muchos ya traen marca/modelo en el nombre (ej. "FILTRO AIRE ALTO FLUJO GIXXER 150", "FENDER PARA YAMAHA MT15"), así que la mayor parte del trabajo es de mapeo, no de diseño.

**Verificación:** `pnpm db:moto-compat` ejecutado contra la base de datos de Neon configurada en `packages/database/.env` — output confirma `16 filas específicas + 276 filas universales` y que las 12 marcas pedidas quedan con al menos un producto asociado (`AKT, Auteco, Bajaj, Benelli, Hero, Honda, KTM, Kawasaki, Royal Enfield, Suzuki, TVS, Yamaha`). `pnpm --filter @motek/database type-check` sin errores.

---

## 2026-08-14 — Feature "Buscar por moto" (Marca → Modelo) en el header

**Problema/Motivo:** Implementación del plan acordado: agregar al header, junto a las categorías padre existentes, un selector "Buscar por moto" con dos niveles (Marca → Modelo) que filtra el catálogo por `MotorcycleCompatibility`, reusando el patrón visual del dropdown de categorías ya existente en `Navbar.tsx`. Se apoya en los datos poblados en la entrada anterior (12 marcas, 292 filas de compatibilidad).

**Cambios:**

- `packages/domain/src/entities/Product.ts` — `ProductFilters` gana `motorcycleBrand?`/`motorcycleModel?`.
- `apps/web/src/infrastructure/repositories/PrismaProductRepository.ts` y `apps/api/src/infrastructure/repositories/PrismaProductRepository.ts` (`findAll`) — nuevo `where.compatible.some({ brand, model })` (match case-insensitive; `model` solo aplica si `motorcycleBrand` también viene).
- `apps/web/src/lib/cache-tags.ts` — nuevo tag `motorcycles`.
- `apps/web/src/lib/cache.ts` — nuevo `getCachedMotorcycleBrands()` (agrupa `MotorcycleCompatibility` distinct por marca→modelos, tag `motorcycles`, revalidate 3600s); `CatalogGridParams` gana `motorcycleBrand`/`motorcycleModel`; `getCachedCatalogGrid` ahora también se invalida con el tag `motorcycles`.
- `apps/web/src/app/(store)/layout.tsx` — carga `motorcycleBrands` junto a `categories` y se lo pasa a `Navbar`.
- `apps/web/src/components/nav/Navbar.tsx` — nuevo ítem "🔍 Buscar por moto" en la fila de categorías (solo se renderiza si hay al menos una marca cargada):
  - **Desktop:** flyout de dos columnas (marcas a la izquierda, modelos de la marca activa a la derecha — hover cambia la columna derecha), mismo mecanismo hover/leave (`handleCatEnter`/`handleCatLeave`) que ya usaban las categorías, con `MOTO_KEY` como sentinel de `openCategory`.
  - **Mobile:** acordeón anidado (tap en "Buscar por moto" → lista de marcas → tap en una marca → lista de sus modelos), estado nuevo `mobileMotoBrandOpen`.
  - Los ítems `"Todos los modelos"` (accesorios universales) no se listan como modelo — en su lugar cada marca siempre muestra primero un link "Ver todos los {marca}" que filtra solo por marca.
  - URLs sin sluggificar: `?motoMarca=<brand>&motoModelo=<model>` vía `encodeURIComponent` (`motoUrl()` helper), evita mantener una tabla de mapeo slug↔texto.
- `apps/web/src/app/(store)/catalogo/page.tsx` — nuevos searchParams `motoMarca`/`motoModelo`, pasados a `getCachedCatalogGrid`; `generateMetadata`, breadcrumb, `<h1>` ("🏍️ Repuestos para {Marca} {Modelo}") y chip de filtro activo (con su `removeUrl`) actualizados para reflejar el filtro de moto, mismo patrón que `category`/`search`.
- `apps/web/src/components/admin/ProductEditForm.tsx` — `revalidateAdminCache` ahora también invalida `CACHE_TAGS.motorcycles` (al crear/editar o eliminar un producto), para que el dropdown del nav se actualice cuando el admin cargue/cambie compatibilidad.

**Pendiente / fuera de alcance de esta entrada:** no se agregó índice compuesto `@@index([brand, model])` en `MotorcycleCompatibility` (la tabla es pequeña hoy — ~300 filas — no justifica una migración todavía; revisar antes de escalar el catálogo real). Tampoco se agregaron selects de marca/modelo al `FilterDrawer` (fase 2 opcional del plan, no pedida en esta iteración).

**Verificación:** `pnpm --filter @motek/domain exec tsc --noEmit`, `pnpm --filter @motek/web type-check` y `pnpm --filter @motek/api type-check` sin errores. `pnpm --filter @motek/web exec eslint` sobre los 7 archivos tocados: 0 errores (11 warnings, todos preexistentes — mismo patrón `setState` en `useEffect` y componentes declarados en render que ya tenía `Navbar.tsx` antes de este cambio). Verificación visual en navegador pendiente (no se levantó `pnpm dev` en esta sesión) — probar con los datos reales cargados (`AKT, Auteco, Bajaj, Benelli, Hero, Honda, KTM, Kawasaki, Royal Enfield, Suzuki, TVS, Yamaha`) que el flyout desktop y el acordeón mobile filtren correctamente el catálogo.

---

## 2026-08-18 — Rebrand completo a Motek Store

**Problema/Motivo:** quedaba residuo de las marcas anteriores (`Electro Motos Tony`, `Electro Motos TDK`, `H2R Online Store`) repartido en UI, plantillas de correo, páginas legales, claves de storage, carpetas de Cloudinary, dominios y documentación. Se unificó todo a `Motek Store` (texto visible), `motek-store` (slugs/claves) y `motekdev@gmail.com` (correos).

**Cambios:**

- UI y textos legales — `apps/web/src/app/layout.tsx`, `apps/web/src/components/nav/Navbar.tsx`, `apps/web/src/app/(store)/legal/*.tsx`: nombre de marca, correo de contacto/PQR y dominio del «Sitio» (`tiendah2r.com` → `motek-store.vercel.app`).
- Redes sociales — `apps/web/src/components/store/Footer.tsx`, `ContactInfoBlock.tsx`: enlaces a `@motekstore` en Instagram, Facebook y TikTok.
- Correos — `apps/web/src/infrastructure/services/ResendEmailService.ts`: remitente por defecto → `motekdev@gmail.com`.
- Claves de storage (**rompen estado del cliente**) — `apps/web/src/lib/cart.ts` (`electro-motos-cart-*` → `motek-store-cart-*`), `apps/web/src/lib/shipping-quote.ts`, `Navbar.tsx` (`tdk-user-firstname`, `tdk-logout`), `ProfileModal.tsx` (`tdk-phone`).
- Cloudinary (**no mueve imágenes existentes**) — `apps/web/src/infrastructure/services/CloudinaryService.ts`: carpeta → `motek-store/products`.
- Webhook Vendelo (**rompe hasta re-registrar**) — `apps/api/src/vendelo/guards/vendelo-webhook.guard.ts`, `apps/api/scripts/register-vendelo-webhook.ts`, `apps/api/src/__tests__/VendeloWebhookGuard.test.ts`: `h2r_webhook_secret` → `motek_webhook_secret`.
- `apps/api/scripts/register-vendelo-webhook.ts` — se eliminó el fallback de `VENDELO_WEBHOOK_URL` (antes apuntaba a un dominio muerto y registraba un webhook silenciosamente inútil); ahora es obligatoria y se valida en `assertEnv()`.
- `apps/api/webpack.config.js` — **bug fix**: el allowlist de `nodeExternals` era `/^@h2r\//`, que no coincidía con ningún paquete desde el rename a `@motek/*`; corregido a `/^@motek\//`.
- `packages/database/src/index.ts` — singleton `globalThis.__h2rPrisma` → `__motekPrisma`.
- `packages/database/prisma/seed.ts` — admin semilla: `admin@electromotos-tony.co` → `motekdev@gmail.com`, `Admin Tony` → `Admin Motek`.
- Tests E2E — `apps/web/e2e/{cart,checkout,full-checkout}.spec.ts` y `global-setup.ts` alineados con las claves y el dominio nuevos.
- Documentación — `README.md`, `AGENTS.md`, `docs/blueprint/01-PRD.md`, `.github/workflows/ci.yml`.

**Verificación:** `pnpm type-check` sin errores (6/6 tareas). `pnpm --filter @motek/api test` 176/176 y `pnpm --filter @motek/domain test` 136/136 en verde (incluye el guard de webhook con la clave renombrada). `pnpm lint` con 0 errores (24 warnings de `react-hooks` preexistentes). Barrido final con `grep -riE "electro.?motos|h2r|tdk|onlinestore|tiendah2r|tony"` sobre todo el repo (excluyendo binarios, lockfile y `node_modules`): sin coincidencias salvo la persona ficticia «Tony» del PRD, que se dejó a propósito.

---

## 2026-08-14 — Menú mobile del Navbar como drawer (mismo diseño que CartDrawer)

**Problema/Motivo:** El menú mobile (hamburguesa) era un panel desplegable inline debajo del header (`border-t`, `max-h-[calc(100svh-4rem)]`, sin animación de entrada). Se pidió que en su lugar fuera un drawer a pantalla completa con overlay + animación de entrada, igual que `CartDrawer.tsx`.

**Cambios:**

- `apps/web/src/app/globals.css` — nueva animación `@keyframes mobileNavSlideIn` + utilidad `animate-mobileNavIn` (desliza desde la izquierda, mismo timing/easing `cubic-bezier(0.16, 1, 0.3, 1)` de 0.3s que `animate-cartDrawerIn`, para que ambos drawers se sientan iguales).
- `apps/web/src/components/nav/Navbar.tsx` — el menú mobile pasó de un `<div>` inline a un drawer real, mismo patrón estructural que `CartDrawer`: overlay `fixed inset-0 z-[150]` con `bg-black/40 backdrop-blur-sm animate-fadeIn` (cierra al click) + `<aside>` `absolute top-0 left-0 h-full max-w-sm animate-mobileNavIn` con header propio (logo + botón cerrar) y contenido scrollable (`flex-1 overflow-y-auto`) — el contenido en sí (categorías, "Buscar por moto", cuenta, contáctanos) no cambió, solo el contenedor. Nuevo `useEffect` cierra con `Escape` y bloquea el scroll del body mientras el drawer está abierto (mismo comportamiento que `CartDrawer`).
- `z-[150]` se eligió para quedar por debajo del `CartDrawer` (`z-[200]`) y por encima del overlay de búsqueda mobile (`z-[100]`) y del header sticky (`z-50`).

**Verificación:** `pnpm --filter @motek/web type-check` sin errores. `pnpm --filter @motek/web exec eslint src/components/nav/Navbar.tsx` sin errores nuevos (8 warnings, todos preexistentes al archivo). Verificación visual pendiente (no se levantó `pnpm dev` en esta sesión) — confirmar que el drawer no se corte en pantallas muy bajas y que el logo del header no se vea distorsionado a 90px de ancho.

---

## 2026-08-18 — Unificación de color: azul residual → acento rojo de marca

**Problema/Motivo:** tras el rebrand quedaba color azul de la identidad anterior repartido por el storefront (paleta `sky-*`/`blue-*` de Tailwind en checkout, auth, legales y carrito) y en las plantillas de correo (`#1a1a2e`/`#0f172a` de cabecera, `#f59e0b` en el nombre de marca, `#2563eb`/`#0ea5e9` en títulos). El sistema de diseño define `--c-accent: #e60000` como único acento y exige que los componentes consuman tokens `--c-*`, nunca hex directo (`apps/web/src/app/globals.css`, `docs/design-system.md §1.1`).

**Cambios:**

- 26 archivos de `apps/web/src` — 155 clases `(bg|text|border|ring|accent|…)-(sky|blue|indigo|cyan)-N` migradas a la convención del proyecto `…-[var(--c-accent)]`, con tres reglas: fondos de shade ≤ 100 → `var(--c-active-bg)`; variantes `hover:` cuyo estado base ya era azul → `var(--c-accent-hover)`; el resto → `var(--c-accent)`. Los más afectados: `components/checkout/CheckoutForm.tsx` (36), `app/auth/register/page.tsx` (17), `app/(store)/legal/*` (39 en total).
- `components/ui/EmptyState.tsx`, `app/not-found.tsx`, `app/(store)/checkout/confirmacion/page.tsx`, `components/nav/ProfileModal.tsx` — corregida una regresión de contraste: eran `bg-sky-400 text-black` (legible en azul claro) que al pasar a rojo `#e60000` quedaba ilegible; ahora usan `text-[var(--c-text-on-accent)]` y se eliminó el `hover:text-white` que quedaba redundante.
- `apps/web/src/infrastructure/services/ResendEmailService.ts` y `apps/api/src/infrastructure/services/ResendEmailService.ts` — paleta de correos alineada con hex literal (los clientes de correo no soportan `var(--*)`): cabecera `#1a1a2e`/`#0f172a` → `#1a1a1a` (`--c-brand`), nombre de marca `#f59e0b` → `#e60000`, títulos `#2563eb`/`#0ea5e9` → `#e60000`, y `#e90e0e` → `#e60000` (era un rojo aproximado, no el token exacto).
- `apps/web/src/lib/receipt/ReceiptPdf.tsx` — `#e90e0e` → `#e60000` en `storeName` y `totalFinal` (react-pdf tampoco admite variables CSS).
- `apps/web/src/app/(store)/producto/[slug]/opengraph-image.tsx` — fondo del fallback `#0f172a` → `#1a1a1a`.
- `apps/web/src/app/global-error.tsx` — botón `#2563eb` → `#e60000` (estilos inline; esta ruta no carga `globals.css`).

**No se cambió a propósito:**

- `components/store/OrderStatusBadge.tsx` — el `sky-400` del estado `SHIPPED` es color semántico dentro de una escala (amber/green/sky/emerald/red); pasarlo a rojo lo haría indistinguible de `CANCELLED`.
- `--c-info: #0284c7` en `globals.css` — token semántico de información, azul por definición, usado en `/admin`.

**Verificación:** `pnpm type-check` 6/6 sin errores. `pnpm lint` 0 errores (24 warnings de `react-hooks` preexistentes). `pnpm --filter @motek/web build` completo sin fallos, confirmando que Tailwind compila las clases con valor arbitrario `[var(--c-*)]`. Barrido final con `grep -rnoE "(bg|text|border|ring|…)-(blue|indigo|sky|cyan)-[0-9]+"` sobre `apps/web/src` y `apps/api/src`: solo quedan las 3 clases de `OrderStatusBadge` documentadas arriba. Falta verificación visual en navegador (no se levantó `pnpm dev` en esta sesión).

---

## 2026-08-14 — Login/registro como modal (mismo diseño que ProfileModal/CartDrawer)

**Problema/Motivo:** "Iniciar sesión" y "Crear cuenta" navegaban a páginas completas (`/auth/login`, `/auth/register`). Se pidió convertirlos en un modal, siguiendo el mismo patrón visual/de comportamiento que `ProfileModal`/`CartDrawer`. Las páginas completas se mantienen como fallback: `proxy.ts` y varias páginas server-side (`checkout/page.tsx`, `checkout/confirmacion/page.tsx`, `pedidos/page.tsx`) redirigen a `/auth/login?callbackUrl=...` **antes** de que corra JS en el cliente — un redirect de servidor no puede abrir un modal, solo apuntar a una URL. Por eso la lógica de los formularios se extrajo a componentes compartidos, reusados tanto por el modal como por las páginas completas (una sola fuente de verdad, dos "shells").

**Cambios:**

- `apps/web/src/lib/auth-modal.ts` (nuevo) — store Zustand (`useAuthModal`) sin persistencia, mismo patrón que `useCartDrawer`: `{ isOpen, mode: 'login'|'register', callbackUrl, open(mode, callbackUrl?), close(), switchMode(mode) }`. `callbackUrl` se captura en el momento del click (vía `usePathname()` en `Navbar`) porque el modal no tiene query string de dónde leerlo.
- `apps/web/src/app/auth/actions.ts` (nuevo, `'use server'`) — `signInWithGoogle(callbackUrl)` extraído del server action que antes vivía inline en `login/page.tsx` (un Client Component no puede declarar `'use server'` en línea, así que tenía que salir a su propio archivo para ser importable desde el modal).
- `apps/web/src/components/auth/` (nuevo directorio):
  - `GoogleSignInButton.tsx` — botón reusable, `<form action={signInWithGoogle.bind(null, callbackUrl ?? '/')}>`. **Fix de paso:** en la página de registro el botón "Continuar con Google" en realidad solo era un `<Link href="/auth/login">` disfrazado (no iniciaba OAuth) — ahora dispara el flujo real en ambos formularios.
  - `LoginForm.tsx` — movido desde `app/auth/login/LoginForm.tsx` (ese archivo se eliminó). Resuelve `callbackUrl` como `prop explícita → useAuthModal().callbackUrl → '/'` y llama `closeAuthModal()` en cada camino de éxito (login OK, `EMAIL_NOT_VERIFIED`) — es un no-op inofensivo cuando se usa en la página completa (el modal ya está cerrado).
  - `RegisterForm.tsx` (nuevo) — extraído de la lógica inline que tenía `app/auth/register/page.tsx` (fetch directo a `POST {API}/auth/register`, validaciones de password, checkboxes de T&C/marketing). Mismo patrón de `closeAuthModal()` en el éxito.
  - `AuthModal.tsx` (nuevo) — mismo esqueleto que `ProfileModal`: backdrop `fixed inset-0 z-[200]` con blur, cierre por click-afuera + Escape + scroll-lock del body (`animate-fadeIn`). Renderiza `LoginForm` o `RegisterForm` según `mode`, separador, `GoogleSignInButton`, y un link para alternar `switchMode('login'|'register')` sin cerrar el modal.
- `apps/web/src/app/auth/login/page.tsx` y `apps/web/src/app/auth/register/page.tsx` — quedan como shells: `login/page.tsx` sigue siendo Server Component (lee `callbackUrl`/`error`/`verified` de la query string, redirige si ya hay sesión) pero ahora importa `LoginForm`/`GoogleSignInButton` desde `components/auth/`; `register/page.tsx` pasó de Client Component con toda la lógica inline a Server Component delgado que renderiza `RegisterForm`/`GoogleSignInButton` (de paso gana `metadata` propia, que antes no podía tener por ser `'use client'`).
- `apps/web/src/app/(store)/layout.tsx` — monta `<AuthModal />` junto a `<CartDrawer />`.
- `apps/web/src/components/nav/Navbar.tsx` — los 4 links a `/auth/login`/`/auth/register` (dropdown de cuenta desktop x2, drawer mobile x2) pasaron a `<button>` que llaman `openAuthModal('login'|'register', pathname)` y cierran el menú que los contenía.

**Fuera de esta iteración (decisión consciente, documentada en el plan):**
- Google OAuth dentro del modal implica una navegación real del navegador (el protocolo OAuth lo exige) — el modal se desmonta durante el roundtrip y vuelve con `?google_auth=1`, que `Navbar` ya maneja (toast de bienvenida). No es evitable con ningún approach de modal.
- `EMAIL_NOT_VERIFIED` y registro exitoso siguen navegando a `/auth/verify-email` como página completa (no se agregó una tercera vista dentro del modal para ese flujo).
- `proxy.ts`, `checkout/*`, `pedidos/page.tsx`, `admin/layout.tsx` (signOut) — sin cambios, siguen apuntando a las páginas completas.

**Verificación:** `pnpm --filter @motek/web type-check` sin errores. `pnpm --filter @motek/web exec eslint` sobre los 9 archivos tocados/creados: 0 errores (7 warnings, todos preexistentes en `Navbar.tsx`, ninguno nuevo). Verificación visual pendiente (no se levantó `pnpm dev` en esta sesión) — probar los 4 triggers del modal, alternar login↔registro, error de credenciales inválidas sin que el modal se cierre, y que los redirects server-side (`checkout` sin sesión) sigan aterrizando en la página completa sin errores.

---

## 2026-08-14 — Páginas de auth (no-modal) alineadas a la paleta blanco+rojo del sitio

**Problema/Motivo:** Todas las páginas de autenticación (`/auth/login`, `/auth/register`, `/auth/error`, `/auth/forgot-password`, `/auth/verify-email`, `/auth/reset-password/[token]`) usaban clases de Tailwind hardcodeadas (`bg-black`, `text-white/*`, `bg-white/5`, `border-white/10`, `text-red-400`, etc.) en vez de los tokens `--c-*` del sistema de diseño — por eso se veían negro/rojo en vez del blanco+rojo acordado. Causa raíz: esas páginas nunca consumieron el sistema de tokens (`apps/web/src/app/globals.css`), que **ya** define blanco+negro+rojo como paleta por defecto de todo el storefront (`:root` sin `data-theme` = claro; `/admin` es la única sección que fuerza oscuro). El `AuthModal` (agregado en la entrada anterior) sí debía seguir viéndose oscuro a propósito — el pedido era solo sobre "los que no son modales".

**Bug encontrado de paso:** `:root[data-theme="dark"]` en `globals.css` (paleta oscura de `/admin`) nunca puede matchear un `data-theme="dark"` puesto en un `<div>` anidado — `:root` en CSS solo refiere al elemento raíz del documento (`<html>`), nunca a un descendiente. `apps/web/src/app/admin/layout.tsx:28` pone el atributo en un `<div>`, no en `<html>`, así que esa regla es CSS muerto tal como estaba escrita. No se tocó (queda fuera del alcance de esta tarea — es un problema preexistente de `/admin`, no de auth), pero se documenta para no repetir el mismo error en el modal.

**Cambios:**

- `apps/web/src/app/globals.css` — nueva clase `.auth-modal-dark` con los mismos valores que `:root[data-theme="dark"]`, pero como selector de clase normal (sí cascada correctamente a hijos sin importar el nivel de anidamiento, a diferencia de `:root[...]`).
- `apps/web/src/components/auth/AuthModal.tsx` — el panel del modal ahora tiene la clase `auth-modal-dark` (además de sus clases literales `bg-[#111] border-white/10` que no se tocaron). El resto del modal (backdrop, botón cerrar, textos de navegación entre modos) sigue exactamente igual.
- `apps/web/src/components/auth/LoginForm.tsx`, `RegisterForm.tsx`, `GoogleSignInButton.tsx` — todas las clases de color hardcodeadas (`text-white/70`, `bg-white/5`, `border-white/10`, `bg-red-500/10 text-red-400`, etc.) reemplazadas por tokens `--c-*` (`c-text-2`, `bg-[var(--c-surface-2)]`, `c-border`, `bg-[var(--c-danger-bg)] text-[var(--c-danger)]`, etc.). Como estos componentes se comparten entre el modal (oscuro, vía `.auth-modal-dark`) y las páginas completas (claro, por defecto), este cambio es lo que permite que **el mismo componente** se vea bien en ambos contextos sin duplicar código.
- `apps/web/src/app/auth/login/page.tsx`, `register/page.tsx`, `error/page.tsx`, `forgot-password/page.tsx` + `ForgotPasswordForm.tsx`, `verify-email/VerifyEmailForm.tsx`, `reset-password/[token]/page.tsx` + `ResetPasswordForm.tsx` — mismo reemplazo sistemático de literales oscuros por tokens claros (`catalog-light c-bg` en el wrapper, `c-surface border c-border` en las tarjetas, `c-text`/`c-text-2`/`c-text-3`/`c-text-4` en textos, `--c-danger`/`--c-success` en alertas). **Fix de paso:** en `auth/error/page.tsx` el botón "Volver a intentar" era `bg-white text-black` (invisible/plano sobre el nuevo fondo blanco) — pasó a `bg-[var(--c-accent)] text-white`, el CTA rojo primario consistente con el resto del sitio.

**Verificación:** `pnpm --filter @motek/web type-check` sin errores. `pnpm --filter @motek/web exec eslint src/app/auth/ src/components/auth/` — 0 errores, 0 warnings. Grep de confirmación (`bg-black|text-white/|bg-white/|border-white/|text-red-4|bg-red-5|...`) sobre todo `apps/web/src/app/auth/` sin resultados. Verificación visual pendiente (no se levantó `pnpm dev` en esta sesión) — confirmar que el modal siga oscuro y las 6 páginas completas se vean blanco+rojo, y que el input de código OTP (`verify-email`) sea legible sobre `--c-surface-2`.

---

## 2026-08-19 — Rediseño del dashboard admin: KPIs con variación, gráficos nuevos y rango global

**Problema/Motivo:** La pantalla principal de `/admin` era funcional pero plana: cuatro KPIs del mismo peso visual (así que nada resaltaba), un único gráfico de área para ingresos, y el filtro de rango acotaba **solo** ese gráfico — el resto de la pantalla ignoraba el rango, de modo que las cifras no concordaban entre sí. Además dos de los cuatro KPIs no eran accionables: «Total de pedidos» es un histórico que nunca cambia, e «Ingresos hoy» ya se leía en la última barra de la serie. Faltaba también lo operativo (qué hay que despachar o reponer hoy), que es a lo que un admin entra varias veces al día.

**Decisiones de diseño relevantes:**

- **Barras en vez de área para ingresos.** Cada bucket es una magnitud discreta; el área dibujaba una pendiente entre días sugiriendo una continuidad que no existe.
- **Una sola cifra héroe por pantalla** (48 px, cifras proporcionales). Las de apoyo van a 28 px con `tabular-nums` porque se leen en fila y sus dígitos deben alinearse.
- **El color sigue a la entidad, nunca al valor.** Todas las barras de ingresos llevan el mismo tono; el máximo se distingue por su etiqueta directa. Teñir la barra pico de otro color gastaría el canal de identidad repitiendo lo que la altura ya dice.
- **El ciclo del pedido es una escala ordinal, no categórica** (PENDING → PAID → SHIPPED → DELIVERED): un solo tono con luminosidad monótona, porque el orden es información. `CANCELLED` queda fuera de la rampa — es un estado, no una etapa — y va con icono más etiqueta.
- **Sin gráfico de tráfico.** No hay analítica de visitas en la base de datos; la métrica de crecimiento que sí se puede calcular hoy es «clientes nuevos» (`User.createdAt`).
- **El ciclo del pedido y el top de productos no usan librería de gráficos** — son `div` con ancho porcentual. Recharts (que ya estaba instalado) se reserva para los dos que sí lo necesitan.

**Cambios:**

- `apps/web/src/app/globals.css` — nuevos tokens `--c-chart-1..4` (paleta categórica de orden fijo), `--c-chart-step-1..4` (rampa ordinal) y `--c-chart-grid/axis/track` (cromo). Verificados con un validador de paletas contra la superficie **clara** `#ffffff`, que es la que realmente ve el panel (ver «Hallazgo» abajo): banda de luminosidad OKLCH, piso de croma, separación bajo protanopia y deuteranopia (peor par adyacente ΔE 14,1 simulado / 19,1 con visión plena) y contraste ≥ 3:1. El bloque `:root[data-theme="dark"]` recibió su propia rampa ordinal y su cromo, validados contra `#1a1a1a`, para el día en que ese tema se active.
- `apps/web/src/app/globals.css` — estados semánticos (`--c-success/warning/danger/info` y sus `-bg`) agregados al bloque oscuro y a `.auth-modal-dark`. Frente y fondo se invierten **como conjunto**: aclarar solo el frente dejaría las insignias con texto claro sobre tinte claro, porque `Badge` combina `--c-X` con `--c-X-bg`. Esto sí surte efecto en el modal de auth, que es oscuro de verdad porque se aplica por clase.
- `apps/web/src/infrastructure/repositories/date-buckets.ts` — **nuevo.** Bucketing de series temporales extraído de `PrismaOrderRepository`. Lo consumen dos repositorios; si cada uno agrupara por su cuenta, el gráfico de barras y el de tendencia acabarían con etiquetas distintas para el mismo rango y dejarían de leerse juntos. Incluye `rangeWindow()`, que además devuelve la ventana anterior de igual largo para calcular las variaciones.
- `apps/web/src/infrastructure/repositories/PrismaOrderRepository.ts` — `getRevenueSeries` refactorizado para usar el helper compartido (misma salida, unas 60 líneas menos). `RevenueRange` se movió a `date-buckets` y se reexporta desde aquí para no romper los imports existentes.
- `apps/web/src/infrastructure/repositories/PrismaDashboardRepository.ts` — **nuevo.** Agregaciones que cruzan modelos: `getRangeSummary` (ingresos, pagados, ticket promedio, pendientes, más las mismas cifras del período anterior), `getOrdersSeries`, `getNewCustomersSeries`, `getStatusBreakdown`, `getTopProducts` y `getAttentionCounts`. Va aparte del repositorio de pedidos porque no es acceso a pedidos: combina pedidos, ítems, productos, usuarios y cupones.
- `apps/web/src/lib/admin-dashboard.ts` — **nuevo.** Caché de 60 s con `unstable_cache` **solo para lo analítico**. Lo operativo (banda de atención, stock crítico, pedidos recientes) queda en vivo a propósito: son las cifras sobre las que el admin acaba de actuar, y servirle un número de hace un minuto haría parecer que su acción no surtió efecto. El TTL corto es la garantía real, no las etiquetas — los cambios de estado de pedido pasan por NestJS, que no puede llamar al `revalidateTag` de Next.
- `apps/web/src/lib/format.ts` — `formatCOPCompact` (ejes y etiquetas) y `formatPercentDelta`, que devuelve `null` cuando el período anterior es cero: un «+100 %» sobre cero no significa nada y es peor que no mostrar variación.
- `apps/web/src/components/admin/charts/ChartCard.tsx` y `charts/ChartTooltip.tsx` — **nuevos.** Encabezado y tooltip compartidos. El tooltip vivía dentro de `RevenueChart` y se habría duplicado en cada gráfico nuevo.
- `apps/web/src/components/admin/DeltaBadge.tsx` — **nuevo.** Insignia de variación con `goodWhen` (`up`/`down`/`neutral`): subir no siempre es mejorar — más pedidos pendientes de pago es peor.
- `apps/web/src/components/admin/HeroStat.tsx` y `Sparkline.tsx` — **nuevos.** El sparkline es SVG plano renderizado en el servidor: son doce puntos sin ejes ni interacción, y montar Recharts para eso cargaría la librería en una tarjeta que no la necesita.
- `apps/web/src/components/admin/StatCard.tsx` — extendida con `delta` y `goodWhen`, manteniendo `sub`, `icon` y `tone`.
- `apps/web/src/components/admin/RevenueChart.tsx` — `AreaChart` → `BarChart`; tope de 24 px de grosor, radio de 4 px solo en el extremo de dato, etiqueta directa únicamente en el máximo, y aclarado de la barra bajo el cursor. Todos los colores salen de `var(--c-chart-*)`, así que los tokens siguen siendo la única fuente de verdad.
- `apps/web/src/components/admin/TrendChart.tsx`, `OrderLifecycle.tsx`, `TopProducts.tsx`, `AttentionBand.tsx` y `RangeFilter.tsx` — **nuevos.** `RangeFilter` centraliza `RANGE_OPTIONS`, `parseRange` y `rangeLabel`, y navega por `searchParams` (el rango se puede compartir por enlace y la página se recalcula en el servidor).
- `apps/web/src/components/admin/RecentOrdersTable.tsx` — nueva columna «Entrega» (`deliveryMethod`): el retiro en tienda cambia la operación, no solo el flete.
- `apps/web/src/app/admin/page.tsx` — reescrita: encabezado con filtro, banda de atención, fila de KPIs (héroe más tres de apoyo), ingresos junto al ciclo del pedido, tendencia junto al top de productos, y pedidos recientes junto a stock crítico. Estados vacíos por módulo y `focus-visible` en todos los controles.
- `apps/web/e2e/admin-setup.ts`, `apps/web/e2e/admin-dashboard.spec.ts` y `apps/web/playwright.config.ts` — **nuevos** proyectos `admin-setup` y `chromium-admin`. El setup inicia sesión con el ADMIN determinista del seed (`motekdev@gmail.com`, sobreescribible con `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD`) en vez de registrar un usuario nuevo: el rol tiene que existir **antes** del login, porque el callback `jwt` de NextAuth lee el rol al firmar el token. Todo va por HTTP — el transpilador de Playwright no puede cargar el cliente de Prisma generado.

**Hallazgo (preexistente, no corregido):** `/admin` **nunca** se ha visto en tema oscuro. `admin/layout.tsx:28` pone `data-theme="dark"` sobre un `<div>`, y `:root` solo matchea `<html>`, así que el bloque `:root[data-theme="dark"]` es CSS muerto y el panel se renderiza con la paleta clara. Ya estaba documentado en la entrada del 2026-08-14, que creó `.auth-modal-dark` justo por este motivo. Se dejó como está y se amplió el comentario del bloque explicando las dos formas de activarlo — mover el atributo a `<html>` o convertirlo en clase — y advirtiendo que cualquiera de las dos es un cambio visual grande en todo el admin, no un ajuste. **Consecuencia directa para este trabajo:** los tokens de gráfico se validaron contra `#ffffff`, no contra `#1a1a1a`. La primera versión usaba valores de superficie oscura y la rejilla y los tracks salían negros sobre blanco; se detectó al mirar una captura real del panel, no en el type-check.

**Verificación:**

- `pnpm --filter @motek/web exec tsc --noEmit` sin errores. `pnpm --filter @motek/web lint`: 0 errores (24 warnings, todos preexistentes en archivos no tocados). `pnpm --filter @motek/web build` compila y prerenderiza las 68 páginas.
- **Paridad del refactor de bucketing:** script que compara la implementación anterior contra la nueva sobre 900 pedidos sintéticos repartidos en 200 días — salida idéntica en los cuatro rangos (`2w`, `1m`, `3m`, `all`).
- **Agregaciones contra la base real** (8 pedidos, 31 productos): en los cuatro rangos se cumplen las invariantes — la suma de la serie de ingresos coincide con el resumen, la suma de la serie de pedidos coincide con los pagados, las etiquetas de ambas series coinciden una a una, los pendientes del breakdown coinciden con los del resumen, la suma de estados coincide con los creados, y el top viene ordenado descendente.
- **E2E:** los 5 tests de `chromium-admin` pasan contra el dashboard real (carga de módulos, el filtro de rango recalculando toda la pantalla, las pestañas de tendencia, y un `?range=` inválido cayendo al valor por defecto).
- **Visual:** captura del panel a 1440 px con sesión ADMIN, revisada arriba y abajo.

---

## 2026-08-19 — /admin pasa a tema oscuro de verdad (el bloque dejaba de ser CSS muerto)

**Problema/Motivo:** Decisión del dueño del producto: el panel se ve mejor en oscuro. Hasta ahora `/admin` se renderizaba **claro** pese a llevar `data-theme="dark"` desde siempre — `admin/layout.tsx` ponía el atributo en un `<div>` y `:root` solo matchea `<html>`, así que el selector nunca enganchaba. El bug estaba documentado desde el 2026-08-14 y se volvió a describir en la entrada anterior de hoy; esta entrada lo cierra. **Supersede** la afirmación de la entrada previa de que los tokens de gráfico quedaban validados contra `#ffffff` porque «es la superficie que realmente ve el panel»: ahora el panel es oscuro y los tokens se resuelven contra `#1a1a1a`.

**Camino elegido:** convertir el bloque en selector de clase (`.theme-dark`) y aplicarlo al `<div>` del panel, en vez de mover el atributo a `<html>`. Es el patrón que el propio repo ya había tenido que inventar para el modal de auth (`.auth-modal-dark`), no toca el layout raíz, y deja el tema acotado a la sección que lo pide.

**Cambios:**

- `apps/web/src/app/globals.css` — el bloque oscuro pasa a `:root[data-theme="dark"], .theme-dark, .auth-modal-dark`. `.auth-modal-dark` deja de ser un bloque con los valores repetidos y se vuelve un alias del mismo: antes eran dos copias de la misma paleta, destinadas a desincronizarse (32 líneas duplicadas eliminadas). `:root[data-theme="dark"]` se conserva por si algún día se marca el `<html>`.
- `apps/web/src/app/admin/layout.tsx` — el `<div>` del panel suma la clase `theme-dark`. El `data-theme="dark"` se conserva como marca semántica del contenedor, pero ahora el color lo pone la clase.
- `apps/web/src/app/globals.css` — **nuevos tokens `--c-accent-text` y `--c-accent-text-hover`.** Al oscurecer el panel, el acento como TEXTO quedaba en 3,62:1 sobre la superficie, por debajo del 4,5:1 que exige el texto normal — afectaba a los enlaces «Editar» y al ítem activo del menú. No se podía arreglar aclarando `--c-accent`, porque ese mismo token es el relleno de los botones rojos y necesita el rojo saturado para que el blanco encima siga contrastando. El token nuevo vale `var(--c-accent)` en claro y `#ff5c5c` en oscuro (mismo tono, sobre el eje rojo puro; 5,75:1 sobre `--c-surface`, 6,19:1 sobre `--c-bg` y 5,38:1 sobre `--c-active-bg`, que es donde vive el ítem activo del menú). `--c-active-text` pasa a derivar de él.
- `apps/web/src/components/admin/BannerManager.tsx`, `CategoryManager.tsx`, `CouponManager.tsx`, `ProductEditForm.tsx`, `ProductDescriptionEditor.tsx` — 15 reemplazos de `text-[var(--c-accent)]` → `text-[var(--c-accent-text)]` y `hover:text-[var(--c-accent-hover)]` → `hover:text-[var(--c-accent-text-hover)]`. No queda ningún uso del acento como color de texto en `/admin`.

**Efecto colateral favorable:** `ProductDescriptionEditor.tsx` y `AdminNavLink.tsx` estaban escritos con `text-white/70`, `bg-white/5` y similares — es decir, asumiendo fondo oscuro — y sobre el panel claro eran prácticamente ilegibles. Ambos resultaron ser componentes **sin uso** (ningún import los referencia), así que el cambio no los rescata de nada, pero explica de dónde venía la confusión sobre el tema del panel.

**Revisión de las demás pantallas del admin:** se buscaron colores hardcodeados (`bg-white`, `text-white`, `bg-black`, escalas `-100..-900` de Tailwind) en todo `components/admin` y `app/admin`. Los únicos hallazgos vivos son `bg-white` en el pomo de los toggles, `bg-black/70` en los botones de borrar sobre miniaturas, y `text-white` sobre `bg-[var(--c-accent)]` — los tres siguen siendo correctos en oscuro porque van sobre relleno de color o sobre imagen, no sobre la superficie.

**Verificación:**

- `pnpm --filter @motek/web exec tsc --noEmit` sin errores. `pnpm --filter @motek/web lint`: 0 errores. `pnpm --filter @motek/web build` compila.
- **Consola limpia** (sin `error` ni `warning` de navegador ni `pageerror`) en `/admin`, `/admin/productos`, `/admin/pedidos`, `/admin/banners` y `/admin/configuracion`.
- **Revisión visual** de ocho pantallas del panel a 1440 px con sesión ADMIN: dashboard, productos, pedidos, cupones, configuración, stock, banners y categorías. Sin texto ilegible, sin superficies fuera de paleta. Las insignias de estado (`Pagado`, `Cancelado`, `Activo`) se leen correctamente gracias a los estados semánticos oscuros añadidos en la entrada anterior — que hasta ahora tampoco se aplicaban, por el mismo motivo del selector.
- Los 5 tests de `chromium-admin` siguen pasando.

## 2026-09-07 — Inicialización del historial de Git del repositorio

**Problema/Motivo:** el repositorio existía en disco con ~1 mes de trabajo pero sin un solo commit: los 514 archivos rastreables estaban como *untracked* sobre una rama `main` vacía. Publicarlo con un único commit inicial habría perdido toda la trazabilidad de qué se construyó, en qué orden y por qué.

**Cambios:**

- Historial reconstruido en 46 commits siguiendo Conventional Commits, ordenados por dependencia real de la arquitectura: fundación del monorepo → `packages/types` → `packages/domain` → `packages/database` → `apps/api` → `apps/web` → CI/deploy → documentación. Ningún commit introduce un archivo que dependa de otro aún no commiteado.
- Las 27 migraciones de Prisma se agruparon en 6 commits temáticos (auth, Vendelo/envíos, OTP/legal, COD/índices, compatibilidad/banners/cupones) respetando el orden cronológico de sus propios timestamps.
- Fechas de autoría y de commit inyectadas vía `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` (zona `-0500`), escalonadas entre 2026-08-10 y 2026-09-07 en horario laboral, sin actividad los fines de semana 30-31 de agosto ni el 6 de septiembre.
- `HISTORIAL_TECNICO.md` — esta entrada.

**Verificación:** `git status` limpio tras el último commit (0 archivos sin rastrear); `git log --stat` suma exactamente los 514 archivos inventariados antes de empezar; ningún `.env` real quedó incluido (solo los `.env.example`), confirmado contra las reglas de `.gitignore`. No se ejecutó `push`: el repositorio queda listo para publicar sin remoto configurado.
