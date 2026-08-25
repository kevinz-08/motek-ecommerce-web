# Sistema de diseño — Motek Store

Contrato formal entre el Agente 4 (Arquitectura UI/UX) y los Agentes 1 (Core
Público), 2 (E-commerce) y 3 (Backend/Admin). Ningún componente de dominio
debe introducir un valor de color, tipografía, espaciado, radio o sombra que
no esté definido aquí. Fuente ampliada de la especificación de producto:
[`docs/blueprint/04-UI-UX-BRIEF.md`](./blueprint/04-UI-UX-BRIEF.md).

Fuente única de verdad en código: `apps/web/src/app/globals.css`.

---

## 1. Tokens

Todos los tokens son variables CSS nativas (`--c-*`, `--radius-*`,
`--shadow-*`, `--dur-*`) definidas en `:root` de `globals.css` y mapeadas a
utilidades de Tailwind v4 vía el bloque `@theme inline`. Los componentes
consumen **solo** tokens semánticos — nunca un valor hexadecimal ni un
`px` suelto.

### 1.1 Color

**Storefront público — paleta estricta de 4 tonos.** Las secciones del
home (`(store)/home.tsx`) y toda composición nueva del storefront público
usan **exclusivamente** estos 6 tokens — ningún quinto color, gradiente o
tinte:

| Token | Valor | Uso | Regla |
|---|---|---|---|
| `--c-bg` | `#ffffff` | Fondo de página, fondo de toda sección | Único fondo permitido |
| `--c-surface` | `#ffffff` | Tarjetas, paneles, inputs | Mismo blanco — no hay superficie "elevada" con otro tono |
| `--c-text` | `#000000` | Títulos y subtítulos (h1–h4) | Solo jerarquía de encabezados |
| `--c-text-2` | `#4b4b4b` | Párrafos, descripciones, texto de cuerpo | Gris — nunca negro puro en párrafos |
| `--c-text-3` | `#6b6b6b` | Metadatos, labels, texto secundario | Gris más claro, misma familia |
| `--c-border` / `--c-divider` | `#e5e5e5` | Bordes y separadores | Gris neutro, no decorativo |
| `--c-accent` / `--c-accent-hover` | `#e60000` / `#c40000` | CTA de conversión, precio destacado, badge de carrito | **Uso escaso**, ver §1.4 |

**Resto de tokens (vigentes, fuera del alcance de los 4 tonos).** Siguen
definidos en `globals.css` y en uso real por `/admin` y por componentes de
dominio existentes (`Badge`, `ProductCard`, `OrderStatusBadge`, toggles de
admin, etc.) — **no** se retiran del código, pero ninguna sección nueva del
storefront público debe introducirlos:

| Token | Valor (claro) | Uso |
|---|---|---|
| `--c-surface-2` / `--c-surface-hover` | `#f5f5f5` / `#eeeeee` | Superficie secundaria/hover (admin, paneles) |
| `--c-brand` | `#1a1a1a` | Reservado — hoy sin consumidores activos en componentes |
| `--c-text-4` | `#9e9e9e` | Texto deshabilitado |
| `--c-active-bg` / `--c-active-text` | `#fdeaea` / `#e60000` | Elemento seleccionado (tab, categoría, paso) |
| `--c-success` / `-bg` | `#2e7d32` / `#eaf3ea` | Disponible, pagado, entregado |
| `--c-warning` / `-bg` | `#ff9800` / `#fff4e5` | Stock bajo, pendiente |
| `--c-danger` / `-bg` | `#c62828` / `#fbe9e9` | Agotado, cancelado, rechazado |
| `--c-info` / `-bg` | `#0284c7` / `#f0f9ff` | Informativo, en preparación |

**Modo oscuro: eliminado del storefront público.** `globals.css` ya no
define `@media (prefers-color-scheme: dark)` — el sitio público opera
siempre en modo claro, sin importar la preferencia del sistema operativo
del visitante. El único tema oscuro que queda en el código es
`:root[data-theme="dark"]`, aplicado a propósito y de forma fija por
`apps/web/src/app/admin/layout.tsx` para el panel `/admin` (decisión de
diseño intencional del admin, no un "modo oscuro" conmutable — está fuera
del alcance de este documento, que cubre el storefront público).

**`.catalog-light`** es un alias legacy en `globals.css` con valores muy
cercanos a la paleta de 4 tonos (no idénticos: `--c-text: #0a0a0a`,
`--c-text-2: #374151`). Se reconcilia con los tokens raíz en la fase de
catálogo — no duplicar una tercera paleta mientras tanto.

**Excepción deliberada: botón flotante de WhatsApp.** `WhatsAppButton.tsx`
(visible en todas las páginas del storefront público) usa el verde de marca
de WhatsApp (`#25D366`), no el acento rojo. Es la única excepción a la
paleta de 4 tonos, decidida a propósito: es un botón de acción hacia una
app externa y el verde es lo que lo hace reconocible al instante — patrón
común en e-commerce. El resto de referencias a WhatsApp en el sitio (badge
del Trustbar, CTA del Footer, ícono social) sí usan el acento rojo — la
excepción es únicamente ese botón flotante.

### 1.4 Regla del acento

`--c-accent` (rojo) está restringido a: botón de conversión primario
(Agregar al carrito, Comprar, Ver más), precio destacado en tarjeta de
producto, ícono/badge de carrito con contador, enlace de acción principal
("Ver todo el catálogo"). **Prohibido**: fondos de sección completos en
rojo, texto de párrafo en rojo, más de un botón de acento visible
simultáneamente en el mismo bloque, rojo en navegación pasiva (link de
menú en reposo).

### 1.2 Tipografía

Familia: Geist (`--font-geist-sans`, ya cargada en `layout.tsx`). Escala vía
utilidades Tailwind `text-{token}` (mapeadas en `@theme inline`):

| Utilidad | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|
| `text-display` | 40/44px | 700 | Titular de hero |
| `text-h1` | 32/38px | 700 | Título de página |
| `text-h2` | 24/30px | 600 | Título de sección |
| `text-h3` | 20/26px | 600 | Nombre de producto, título de card |
| `text-body-lg` | 18/28px | 400 | Descripción de producto |
| `text-body` | 16/24px | 400 | Texto por defecto |
| `text-body-sm` | 14/20px | 400 | Metadatos, ayuda de formulario |
| `text-caption` | 12/16px | 500 | Etiquetas, badges |
| `text-price-lg` | 28/32px | 700 | Precio en ficha de producto |
| `text-price` | 18/24px | 700 | Precio en tarjeta de catálogo |

Uso en componentes de dominio: `className="text-[length:var(--text-h3)]"` o
directamente `text-h3` si Tailwind resuelve el token (ambas formas conviven
porque los nombres colisionan con la escala numérica nativa de Tailwind en
algunos casos — preferir la forma `text-[length:var(--text-*)]` si hay duda).
El body nunca baja de 16px en móvil (evita zoom automático en iOS). Los
precios usan `font-variant-numeric: tabular-nums` (aplicado globalmente en
`body`).

### 1.3 Espaciado, radio, sombra, contenedores

- **Espaciado:** escala base 4px de Tailwind (`p-4`=16px, `p-6`=24px,
  `p-8`=32px, `p-12`=48px, `p-16`=64px, `p-24`=96px). No se introducen
  valores fuera de esta escala continua de 0.25rem.
- **Radio:** `--radius-sm` (6px, badges/inputs pequeños), `--radius-md`
  (8px, botones/inputs/cards), `--radius-lg` (12px, modales), `--radius-full`
  (avatares, contador de carrito).
- **Sombra:** `--shadow-sm` (tarjeta en reposo), `--shadow-md` (hover/dropdown),
  `--shadow-lg` (modal/hoja inferior). La jerarquía se comunica primero con
  borde y superficie; la sombra es el último recurso.
- **Contenedores:** utilidades `container-app` (1280px) y `container-narrow`
  (768px, checkout/formularios/legal), con padding lateral responsive
  (16px móvil → 24px tablet → 32px escritorio).

### 1.5 Movimiento

Variables `--dur-hover` (150ms), `--dur-fade` (250ms), `--dur-panel` (300ms,
`--ease-panel` cubic-bezier(0.32,0.72,0,1)), `--dur-accordion` (350ms),
`--dur-cart-confirm` (400ms). `prefers-reduced-motion: reduce` está
respetado globalmente en `globals.css` (reduce toda animación/transición a
~0ms) — los componentes no necesitan manejarlo individualmente.

---

## 2. Componentes base (`apps/web/src/components/ui/`)

Todos son **puramente presentacionales**: sin `fetch`, sin lógica de
dominio, sin import de `@motek/database`. Reciben datos y callbacks vía
props tipadas.

| Componente | Archivo | Variantes / props clave |
|---|---|---|
| `Button` | `Button.tsx` | `variant`: primary·secondary·ghost·danger · `size`: sm(36px)·md(44px)·lg(52px) · `loading` (conserva ancho, nunca cambia tamaño) |
| `Card` + `CardHeader/Title/Body/Footer` | `Card.tsx` | `padding`: none·sm·md · `hover` (sombra solo en hover) |
| `Badge` | `Badge.tsx` | `variant`: success·warning·danger·info·neutral |
| `Input` / `Textarea` | `Input.tsx` | `label`, `error`, `hint`, `leftAddon`/`rightAddon`. Error vinculado por `aria-describedby` |
| `Modal` | `Modal.tsx` | `variant`: centered·sheet. Atrapa foco, cierra con `Escape`, restituye foco al disparador, bloquea scroll del body |
| `Spinner` | `Spinner.tsx` | `size`: sm·md. Hereda `currentColor` |
| `SkeletonBlock` / `SkeletonLine` (+ variantes `Dark`) | `Skeleton.tsx` | Ya existían — mantenidos tal cual |
| `EmptyState` | `EmptyState.tsx` | Ya existía — mantenido tal cual |

Barrel de importación: `import { Button, Card, Badge, ... } from '@/components/ui'`.

Utilidad de composición de clases: `cn()` en `apps/web/src/lib/cn.ts`
(sin dependencias externas — el proyecto no tiene `clsx`/`tailwind-merge`
instalados; si se necesita deduplicar clases Tailwind conflictivas en el
futuro, evaluar agregar `tailwind-merge` en ese momento, no antes).

### Ejemplos de uso

```tsx
import { Button, Badge, Card, CardBody } from '@/components/ui'

<Button variant="primary" size="lg">Agregar al carrito</Button>
<Button variant="primary" loading>Procesando…</Button>

<Badge variant="danger">Agotado</Badge>

<Card hover>
  <CardBody>Contenido de la tarjeta</CardBody>
</Card>
```

```tsx
import { Input } from '@/components/ui'

<Input
  label="Email"
  type="email"
  error={errors.email && 'Este correo no es válido'}
/>
```

```tsx
import { Modal, Button } from '@/components/ui'

const [open, setOpen] = useState(false)
<Modal open={open} onClose={() => setOpen(false)} title="Confirmar">
  <Button onClick={() => setOpen(false)}>Cerrar</Button>
</Modal>
```

### Página de validación visual

`apps/web/src/app/design-system/` renderiza todos los componentes base con
sus variantes y estados. Es temporal (no enlazada desde ninguna navegación,
sin metadata SEO) — sirve como referencia visual mientras no exista
Storybook. Puede eliminarse cuando cada componente tenga cobertura visual
en las páginas reales.

---

## 3. Estructura de carpetas

```
apps/web/src/components/
├── ui/          átomos presentacionales reutilizables (este documento)
├── nav/         Navbar, ProfileModal — composición de dominio (auth, cart, categorías)
├── store/       Footer y otras secciones del storefront público
├── checkout/    componentes específicos del flujo de checkout
├── admin/       componentes específicos del panel admin
└── providers/   proveedores de contexto (SessionProvider, etc.)
```

**Regla de importación:** `ui/` nunca importa de `nav/`, `store/`,
`checkout/`, `admin/` ni de `@motek/database`. La dependencia va en un solo
sentido: los folders de dominio importan de `ui/`, nunca al revés.

`Navbar.tsx` y `Footer.tsx` (existentes en `nav/` y `store/`) **no** son
átomos de este sistema — son composiciones de dominio (auth, carrito,
categorías vía fetch/SSR) y por eso viven fuera de `ui/`, cumpliendo la
misma regla de Clean Architecture que separa `packages/domain` de
`packages/database`: los átomos presentacionales no conocen datos reales,
las composiciones sí. Los Agentes 1/2/3 deben construir nuevas
composiciones de dominio dentro de estas mismas carpetas (o carpetas
`features/*` nuevas si el dominio lo amerita), consumiendo únicamente los
átomos de `ui/` y los tokens de §1 — nunca duplicando estilos ad-hoc.

Convención de nombres: `PascalCase.tsx` por componente, un componente
público por archivo, subcomponentes relacionados co-ubicados en el mismo
archivo cuando son inseparables del padre (ej. `CardHeader` en `Card.tsx`).

---

## 4. Accesibilidad (checklist para consumidores)

- Contraste mínimo AA: 4.5:1 texto normal, 3:1 texto grande/elementos de UI.
  Verificado en la paleta de §1.1 (texto `--c-text`/`--c-text-2` sobre
  `--c-surface`/`--c-bg` cumple AA; `--c-text-3` solo para metadatos no
  críticos, verificar caso a caso si el fondo cambia).
- Foco visible: anillo de 2px en `--c-accent` con 2px de offset, aplicado
  globalmente vía `:focus-visible` en `globals.css` — ningún componente
  necesita reimplementarlo.
- Formularios: todo `Input`/`Textarea` con `label` genera `htmlFor`/`id`
  automático; los errores se vinculan con `aria-describedby` + `aria-invalid`.
- Modal: foco atrapado, cierre con `Escape`, foco restituido al cerrar,
  `role="dialog"` + `aria-modal` + `aria-labelledby`.
- Área táctil mínima 44×44px: `Button` tamaño `md` (44px) es el default;
  `sm` (36px) solo debe usarse en escritorio o paneles admin densos.
- `lang="es-CO"` aplicado en `apps/web/src/app/layout.tsx`.

---

## 5. Qué NO hacer

- No usar valores hex/px directos en componentes de dominio — siempre un
  token de este documento.
- No poner lógica de fetch, mutación o `@motek/database` dentro de `ui/`.
- No crear una segunda paleta de color local a una feature (ej. no repetir
  el patrón `.catalog-light` con valores propios — extender los tokens
  globales en su lugar).
- No usar el acento (`--c-accent`) para más de una acción primaria visible
  a la vez en el mismo bloque.
