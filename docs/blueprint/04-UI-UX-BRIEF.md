# UI/UX Design Brief
## Sistema de diseño para E-commerce de Repuestos de Motocicletas

| Campo | Valor |
|---|---|
| Documento | UI/UX Brief v1.0 |
| Complementa | `01-PRD.md`, `03-FLUJO-APP.md` |
| Implementación objetivo | Tailwind CSS 4 + tokens CSS nativos |

---

## 1. Posicionamiento y personalidad visual

### 1.1 Atributos de marca

| Atributo | Traducción visual | Anti-patrón a evitar |
|---|---|---|
| **Técnico** | Datos precisos, tipografía legible, jerarquía clara | Decoración que compite con la información |
| **Confiable** | Espaciado generoso, contraste alto, sin trucos de urgencia falsa | Contadores regresivos artificiales, "solo quedan 2" inventados |
| **Ágil** | Respuesta inmediata a cada interacción, transiciones cortas | Animaciones largas que retrasan la tarea |
| **Accesible** | Precios grandes, botones amplios, español claro | Jerga técnica sin explicación |
| **Enérgico** | Un acento cromático puntual y bien colocado | Saturación cromática generalizada |

### 1.2 Referencia de tono

El producto debe sentirse como **un mostrador de repuestos bien organizado**, no como una tienda de moda. La información técnica es el héroe: SKU, compatibilidad, stock y precio deben ser lo primero que se lee. La estética existe para hacer esa información más rápida de consumir, no para reemplazarla.

---

## 2. Principios de diseño

### P1 — La información primero
Cada pantalla responde a la pregunta del usuario en el primer viewport. En una ficha de producto: qué es, cuánto cuesta, si hay, y si sirve para su moto. Todo lo demás va debajo.

### P2 — El precio nunca miente
El costo total se revela lo antes posible. El flete se muestra antes de pedir el método de pago. Nada aparece en el último paso.

### P3 — Feedback inmediato, siempre
Toda acción produce una respuesta visible en menos de 100 ms: cambio de estado del botón, actualización del contador, notificación efímera. Nunca un clic al vacío.

### P4 — Estados completos, no solo el feliz
Cada componente que carga datos define cuatro estados: cargando (esqueleto con la forma real del contenido), con datos, vacío (con acción de salida) y error (con reintento).

### P5 — Móvil primero, de verdad
El diseño se construye a 360 px y crece. Las áreas táctiles no bajan de 44×44 px. Las acciones primarias caen dentro del alcance del pulgar.

### P6 — Consistencia sobre novedad
Un botón primario se ve igual en toda la aplicación. Un precio se formatea igual en todas partes. Las variaciones deben justificarse.

### P7 — Accesibilidad como requisito, no como extra
Contraste mínimo AA (4.5:1 texto normal, 3:1 texto grande). Navegación completa por teclado. Foco visible. Estructura semántica correcta.

---

## 3. Sistema de color

### 3.1 Arquitectura de tokens

El color se define en **dos niveles**: primitivas (valores crudos, ver §3.2) y tokens semánticos (intención de uso). Los componentes consumen **exclusivamente** tokens semánticos. Esto permite cambiar el tema sin tocar un solo componente. La paleta se inspira en la identidad nocturna del logo de MOTEK: negro profundo como base, rojo fuego como único acento.

```css
:root {
  /* ── Tokens semánticos · superficie ─────────────────── */
  --c-bg:            #f5f5f5;   /* fondo general de la interfaz */
  --c-surface:       #ffffff;   /* tarjetas, paneles */
  --c-surface-2:     #f5f5f5;   /* superficie elevada / secundaria */
  --c-surface-hover: #eeeeee;   /* estado hover sobre superficie */
  --c-brand:         #1a1a1a;   /* barra superior, navegación, títulos principales */

  /* ── Tokens semánticos · texto ──────────────────────── */
  --c-text:          #1a1a1a;   /* títulos, precios */
  --c-text-2:        #424242;   /* cuerpo */
  --c-text-3:        #757575;   /* descripciones, precios anteriores, metadatos */
  --c-text-4:        #9e9e9e;   /* placeholder, deshabilitado */

  /* ── Tokens semánticos · borde ──────────────────────── */
  --c-border:        #e0e0e0;
  --c-border-hover:  #e60000;
  --c-divider:       #e0e0e0;

  /* ── Acento ─────────────────────────────────────────── */
  --c-accent:        #e60000;   /* acción primaria — rojo fuego */
  --c-accent-hover:  #c40000;
  --c-active-bg:     #fdeaea;   /* fondo de elemento seleccionado */
  --c-active-text:   #e60000;

  /* ── Estados semánticos ─────────────────────────────── */
  --c-success:       #2e7d32;   --c-success-bg: #eaf3ea;
  --c-warning:       #ff9800;   --c-warning-bg: #fff4e5;
  --c-danger:        #c62828;   --c-danger-bg:  #fbe9e9;
  --c-info:          #0284c7;   --c-info-bg:    #f0f9ff;
}
```

### 3.2 Códigos exactos de la paleta

| Categoría | Nombre | HEX | RGB | HSL | Rol en UI |
|---|---|---|---|---|---|
| Primario | Negro Profundo | `#1A1A1A` | (26, 26, 26) | (0°, 0%, 10%) | Barra superior, navegación, títulos principales |
| Acento | Rojo Fuego | `#E60000` | (230, 0, 0) | (0°, 100%, 45%) | Botones "Comprar ahora", CTA críticos, insignias |
| Neutro claro | Gris Fondo | `#F5F5F5` | (245, 245, 245) | (0°, 0%, 96%) | Fondo general de la interfaz y contenedores |
| Neutro medio | Gris Texto Secundario | `#757575` | (117, 117, 117) | (0°, 0%, 46%) | Descripciones, precios anteriores, metadatos |
| Estado (éxito) | Verde Esmeralda | `#2E7D32` | (46, 125, 50) | (120°, 46%, 34%) | En stock, confirmaciones de pago exitoso |
| Estado (advertencia) | Ámbar | `#FF9800` | (255, 152, 0) | (36°, 100%, 50%) | Stock bajo, alertas en formularios |
| Estado (error) | Rojo Intenso Alerta | `#C62828` | (198, 40, 40) | (0°, 67%, 47%) | Tarjetas rechazadas, errores críticos |

### 3.3 Aplicación del acento

El rojo fuego es **escaso por diseño**. Su uso está restringido a:

| Uso permitido | Ejemplo |
|---|---|
| Botón de conversión | "Añadir al carrito", "Pagar ahora" |
| Elemento interactivo activo | Categoría seleccionada, paso actual del checkout, pestaña seleccionada |
| Foco de teclado | Anillo de foco |
| Enlace principal de acción | Enlaces contextuales de acción |

**Prohibido:** fondos de sección completos en rojo, texto de párrafo en rojo, más de un botón de acento visible simultáneamente en el mismo bloque.

### 3.4 Semántica de estados en el dominio

| Concepto | Color | Uso |
|---|---|---|
| Disponible / Pagado / Entregado | `success` (`#2E7D32`) | Insignia de stock, estado de pedido |
| Stock bajo / Pendiente / En tránsito | `warning` (`#FF9800`) | Alerta de inventario, pedido sin confirmar |
| Agotado / Cancelado / Rechazado | `danger` (`#C62828`) | Producto no comprable, pago fallido |
| Informativo / En preparación | `info` | Notas del checkout, estado logístico intermedio |

**Regla de accesibilidad:** el color nunca es el único portador de significado. Toda insignia de estado combina color + texto + (opcionalmente) icono.

### 3.5 Modo oscuro

El sistema de tokens permite modo oscuro manteniendo la identidad nocturna inspirada en el logo de MOTEK. Se implementa redefiniendo los tokens bajo `prefers-color-scheme: dark` y bajo un atributo explícito en la raíz (`[data-theme="dark"]`) para que la preferencia manual del usuario tenga prioridad. Ningún componente se modifica.

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --c-bg: #121212;  --c-surface: #1A1A1A;  --c-surface-2: #242424;
    --c-text: #FFFFFF; --c-text-2: #E0E0E0;  --c-text-3: #9E9E9E;
    --c-border: #333333;
  }
}
:root[data-theme="dark"] { /* mismos valores */ }
```

---

## 4. Tipografía

### 4.1 Familias

| Rol | Familia | Justificación |
|---|---|---|
| Interfaz y contenido | Sans geométrica-neutra de sistema (Geist, Inter o equivalente) | Legibilidad en tamaños pequeños; buen soporte de números tabulares |
| Datos técnicos | Mono | SKU, número de guía, número de pedido — evita confundir 0/O y 1/l |

### 4.2 Escala tipográfica

| Token | Tamaño / Interlineado | Peso | Uso |
|---|---|---|---|
| `display` | 40 / 44 px | 700 | Titular del hero |
| `h1` | 32 / 38 px | 700 | Título de página |
| `h2` | 24 / 30 px | 600 | Título de sección |
| `h3` | 20 / 26 px | 600 | Nombre de producto en ficha |
| `body-lg` | 18 / 28 px | 400 | Descripción de producto |
| `body` | 16 / 24 px | 400 | Texto por defecto |
| `body-sm` | 14 / 20 px | 400 | Metadatos, ayuda de formulario |
| `caption` | 12 / 16 px | 500 | Etiquetas, insignias |
| `price-lg` | 28 / 32 px | 700 | Precio en ficha de producto |
| `price` | 18 / 24 px | 700 | Precio en tarjeta de catálogo |
| `mono` | 14 / 20 px | 500 | SKU, guía, número de pedido |

**Reglas:**
- El tamaño base de la interfaz nunca baja de 16 px en móvil (evita el zoom automático en campos de formulario de iOS).
- Los títulos móviles reducen un escalón: `display` → 32 px, `h1` → 26 px.
- Todo bloque de texto continuo se limita a 65–75 caracteres de ancho.
- Los precios y las cantidades usan **números tabulares** para que las columnas alineen.

### 4.3 Formato de precio (obligatorio y único)

```ts
// El valor almacenado es un entero en centavos COP.
function formatPrice(centavos: number): string {
  return (centavos / 100).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })
}
// 4550000 → "$ 45.550"
```

Este formateo vive en un único módulo compartido. Ningún componente formatea dinero por su cuenta.

---

## 5. Espaciado, retícula y elevación

### 5.1 Escala de espaciado

Base de 4 px: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`. No se usan valores fuera de la escala.

| Contexto | Espaciado |
|---|---|
| Interior de tarjeta | 16 px (móvil) / 24 px (escritorio) |
| Entre tarjetas en grilla | 16 px (móvil) / 24 px (escritorio) |
| Entre secciones de página | 48 px (móvil) / 64–96 px (escritorio) |
| Entre campos de formulario | 20 px |
| Entre etiqueta y campo | 8 px |

### 5.2 Contenedores

| Token | Ancho máximo | Uso |
|---|---|---|
| `container` | 1280 px | Contenedor general |
| `container-narrow` | 768 px | Checkout, formularios, contenido legal |
| `container-prose` | 65ch | Texto continuo |

Padding lateral: 16 px móvil, 24 px tableta, 32 px escritorio.

### 5.3 Radio y sombra

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | 6 px | Insignias, campos pequeños |
| `radius` | 8 px | Botones, campos, tarjetas |
| `radius-lg` | 12 px | Modales, paneles destacados |
| `radius-full` | 9999 px | Avatar, contador del carrito |
| `shadow-sm` | Sutil | Tarjeta en reposo |
| `shadow` | Media | Tarjeta en hover, dropdown |
| `shadow-lg` | Pronunciada | Modal, hoja inferior |

**Principio de elevación:** la jerarquía se comunica primero con **borde y superficie**, y solo después con sombra. Las sombras se reservan para elementos que flotan sobre el contenido.

---

## 6. Estructura de componentes

### 6.1 Inventario de componentes

#### Primitivos
| Componente | Variantes | Estados |
|---|---|---|
| `Button` | primary · secondary · ghost · danger; sm/md/lg | default · hover · active · focus · disabled · loading |
| `Input` / `Textarea` | con prefijo/sufijo | default · focus · error · disabled · readonly |
| `Select` | nativo estilizado | + open |
| `Checkbox` / `Radio` | — | + indeterminate |
| `Badge` | success · warning · danger · info · neutral | — |
| `Skeleton` | text · box · card | animación de pulso |
| `Spinner` | sm · md | — |
| `Toast` | success · error · info | entrada/salida |
| `Modal` / `Sheet` | centrado (escritorio) · inferior (móvil) | — |
| `Tabs` · `Accordion` · `Pagination` · `Breadcrumb` | — | — |

#### De dominio
| Componente | Responsabilidad |
|---|---|
| `ProductCard` | Imagen, nombre, precio, insignia de stock, acción rápida de agregar |
| `ProductGallery` | Imagen principal + miniaturas, con transición suave y zoom |
| `PriceDisplay` | Precio actual, precio tachado y ahorro cuando aplica |
| `StockBadge` | Disponible / Últimas unidades / Agotado |
| `CategoryNav` | Navegación jerárquica padre → subcategorías |
| `FilterPanel` | Filtros del catálogo; sincroniza con la URL. Lateral en escritorio, hoja inferior en móvil |
| `CartDrawer` | Panel lateral con ítems, subtotal y acceso al checkout |
| `CartLineItem` | Miniatura, nombre, control de cantidad, subtotal, eliminar |
| `QuantityStepper` | −/+ con tope en el stock disponible |
| `CheckoutStepper` | Indicador de progreso del checkout |
| `AddressForm` | Dirección + selector de ciudad del catálogo oficial |
| `ShippingQuote` | Valor del flete, tiempo estimado, estado de carga y de fallo |
| `CouponField` | Entrada, validación, ahorro aplicado, remoción |
| `PaymentMethodSelector` | Tarjetas de método, con los deshabilitados explicados |
| `OrderSummary` | Subtotal · descuento · flete · total |
| `OrderStatusTimeline` | Línea de tiempo del pedido y del envío |
| `EmptyState` | Ilustración, mensaje y acción de salida |
| `DataTable` (admin) | Ordenamiento, filtros, paginación, acciones por fila |
| `StatCard` (admin) | Métrica con valor, etiqueta y variación |
| `ImageUploader` (admin) | Arrastrar y soltar, previsualización, reordenamiento, eliminación |

### 6.2 Especificación de componentes críticos

#### `Button`

| Variante | Fondo | Texto | Borde |
|---|---|---|---|
| primary | `--c-accent` | blanco | ninguno |
| secondary | `--c-surface` | `--c-text` | `--c-border` |
| ghost | transparente | `--c-text-2` | ninguno |
| danger | `--c-danger` | blanco | ninguno |

Alturas: sm 36 px · md 44 px · lg 52 px. **La altura mínima táctil es 44 px**; el tamaño `sm` solo se usa en escritorio o en zonas densas del panel administrativo.

Estado `loading`: se conserva el ancho del botón, se reemplaza el contenido por un spinner y se deshabilita la interacción. Nunca cambia el tamaño (evita saltos de layout).

#### `ProductCard`

```
┌─────────────────────────────┐
│                             │
│      Imagen 1:1             │  ← relación fija, sin CLS
│      (lazy salvo LCP)       │  ← insignia de stock arriba a la derecha
│                             │
├─────────────────────────────┤
│ CATEGORÍA          caption  │  ← --c-text-3
│ Nombre del producto     h3  │  ← máximo 2 líneas, con elipsis
│ SKU-12345              mono │  ← --c-text-3
│                             │
│ $ 45.550             price  │  ← --c-text, peso 700
│                             │
│ [   Agregar al carrito   ]  │  ← primary, ancho completo
└─────────────────────────────┘
```

Reglas: el nombre se trunca a 2 líneas con altura reservada, de modo que todas las tarjetas de una fila tienen la misma altura. Si el producto está agotado, el botón se sustituye por un estado deshabilitado con el texto "Agotado".

#### `FilterPanel`

- **Escritorio (≥1024 px):** columna fija a la izquierda, 280 px, con desplazamiento propio.
- **Tableta y móvil:** botón "Filtros" con contador de filtros activos que abre una hoja inferior a pantalla casi completa, con botones fijos "Limpiar" y "Ver N resultados".
- Todo cambio de filtro actualiza la URL. Los filtros activos se muestran como chips removibles sobre la grilla.

#### `CheckoutStepper`

```
Escritorio:
  ①────────②────────③────────④
  Datos   Entrega  Resumen   Pago

Móvil:
  Paso 2 de 4 · Entrega
  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░
```

El paso completado es navegable hacia atrás; los pasos futuros no.

#### `OrderSummary`

```
┌───────────────────────────────────┐
│ Resumen del pedido                │
├───────────────────────────────────┤
│ Subtotal (3 productos)   $ 136.650│
│ Descuento  BIENVENIDO10  −$ 13.665│  ← --c-success
│ Envío · Medellín           $ 12.000│
│ ─────────────────────────────────  │
│ Total                    $ 134.985 │  ← price-lg
└───────────────────────────────────┘
```

En escritorio el resumen es **pegajoso** (`sticky`) durante el desplazamiento del checkout. En móvil se colapsa a una barra inferior fija que muestra el total y se expande al tocarla.

### 6.3 Estados obligatorios por componente de datos

| Componente | Cargando | Vacío | Error |
|---|---|---|---|
| Grilla de catálogo | 12 esqueletos de tarjeta | "Sin resultados" + limpiar filtros | Mensaje + reintentar |
| Ficha de producto | Esqueleto de galería + texto | — (404) | Mensaje + volver al catálogo |
| Carrito | Esqueleto de líneas | "Tu carrito está vacío" + ir al catálogo | — |
| Cotización de flete | Spinner en línea | — | "No pudimos cotizar; el envío corre por nuestra cuenta" |
| Historial de pedidos | Esqueleto de filas | "Aún no tienes pedidos" + ir al catálogo | Mensaje + reintentar |
| Tablas del panel | Esqueleto de filas | "Sin registros" + acción de crear | Mensaje + reintentar |

---

## 7. Iconografía e imagen

### 7.1 Iconos
Librería de trazo consistente (tipo Lucide). Grosor 1.5–2 px, tamaños 16/20/24 px. Los iconos decorativos se ocultan de la capa de accesibilidad; los iconos que actúan como único contenido de un botón llevan etiqueta accesible obligatoria.

### 7.2 Fotografía de producto
- Relación **1:1**, fondo blanco o neutro uniforme.
- Mínimo 1200×1200 px de origen; el CDN entrega la variante adecuada por breakpoint.
- Formato moderno (AVIF/WebP) con degradación automática.
- Toda imagen declara dimensiones para reservar el espacio y evitar desplazamiento de layout.
- La primera imagen del hero y la imagen principal de la ficha son de carga prioritaria; el resto es diferido.
- Texto alternativo descriptivo: "Filtro de aire de alto flujo para Honda CB160F", nunca "imagen1.jpg".

### 7.3 Banners del hero
Dos recortes por banner: **16:9** para escritorio y **4:5 o 1:1** para móvil. El texto del banner es HTML sobre la imagen, **nunca** texto incrustado en el archivo (por SEO, accesibilidad y legibilidad en pantallas pequeñas).

---

## 8. Movimiento

| Interacción | Duración | Curva |
|---|---|---|
| Hover / cambio de color | 150 ms | `ease-out` |
| Aparición de contenido (fade) | 250 ms | `ease-out` |
| Panel lateral / hoja inferior | 300 ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Acordeón (expansión) | 350 ms | `ease-out` |
| Confirmación de "agregado al carrito" | 400 ms | `ease-out` |
| Notificación efímera | 200 ms entrada / 150 ms salida | `ease-out` |

**Reglas:**
- El movimiento comunica causa y efecto; nunca decora por decorar.
- Se anima preferentemente `transform` y `opacity` (compuestas en GPU).
- Se respeta `prefers-reduced-motion: reduce`: las transiciones se reducen a cambios instantáneos u opacidad mínima.

---

## 9. Diseño adaptativo (responsive)

### 9.1 Puntos de quiebre

| Nombre | Ancho | Dispositivo objetivo |
|---|---|---|
| base | 360–639 px | Móvil (diseño de partida) |
| `sm` | ≥ 640 px | Móvil grande |
| `md` | ≥ 768 px | Tableta vertical |
| `lg` | ≥ 1024 px | Tableta horizontal / portátil |
| `xl` | ≥ 1280 px | Escritorio |
| `2xl` | ≥ 1536 px | Escritorio amplio |

### 9.2 Comportamiento por vista

| Vista | Móvil | Tableta | Escritorio |
|---|---|---|---|
| Header | Logo + icono de búsqueda + carrito; navegación en menú hamburguesa | Logo + búsqueda + carrito + cuenta | Barra completa con categorías visibles |
| Home · hero | Carrusel 4:5, un banner a la vez, con puntos | 16:9 | 16:9 con controles laterales |
| Home · categorías | Carrusel horizontal desplazable | Grilla 3 columnas | Grilla 4–6 columnas |
| Catálogo | 2 columnas; filtros en hoja inferior | 3 columnas; filtros en hoja | 4 columnas + panel lateral fijo |
| Ficha de producto | Una columna: galería → info → descripción | Dos columnas a partir de `md` | Galería 60 % / info 40 % pegajosa |
| Carrito | Lista apilada + barra inferior fija con total | Lista + resumen debajo | Lista 65 % / resumen pegajoso 35 % |
| Checkout | Pasos secuenciales, uno por pantalla; resumen colapsable inferior | Pasos + resumen debajo | Formulario 60 % / resumen pegajoso 40 % |
| Panel admin | Sidebar oculto en menú; tablas convertidas en tarjetas | Sidebar colapsado a iconos | Sidebar expandido + tablas completas |

### 9.3 Reglas transversales

- **Tablas en móvil:** ninguna tabla se desplaza horizontalmente para ser leída. Se transforma en una lista de tarjetas donde cada fila es una tarjeta con pares etiqueta–valor. Excepción: tablas densas del panel administrativo, que pueden desplazarse dentro de su propio contenedor con la primera columna fija.
- **Acciones primarias en móvil:** ancladas a la parte inferior de la pantalla (agregar al carrito en la ficha, continuar en el checkout), respetando el área segura del dispositivo.
- **Nada de contenido que solo exista en escritorio.** Si una información importa, existe en todos los tamaños; puede reorganizarse, no desaparecer.
- **Área táctil mínima 44×44 px** con al menos 8 px de separación entre objetivos adyacentes.

---

## 10. Accesibilidad

### 10.1 Requisitos verificables

| Requisito | Criterio |
|---|---|
| Contraste | ≥ 4.5:1 texto normal, ≥ 3:1 texto grande y elementos de interfaz |
| Teclado | Todo flujo completable sin ratón, incluido el checkout |
| Foco | Anillo visible de 2 px en color de acento, con desplazamiento de 2 px |
| Semántica | Un solo `h1` por página; jerarquía de encabezados sin saltos |
| Formularios | Toda entrada tiene etiqueta asociada; los errores se vinculan por `aria-describedby` |
| Imágenes | Alt descriptivo en producto; decorativas ocultas de la capa de accesibilidad |
| Contenido dinámico | Notificaciones y errores anunciados mediante regiones activas |
| Modales | Foco atrapado dentro, cierre con `Escape`, foco restituido al cerrar |
| Movimiento | `prefers-reduced-motion` respetado |
| Idioma | `lang="es-CO"` en la raíz del documento |

### 10.2 Errores de formulario

Patrón obligatorio: **icono + color + texto**. El mensaje describe la corrección concreta, no el fallo abstracto.

```
❌  "Campo inválido"
✅  "El número de documento debe tener entre 6 y 12 dígitos"

❌  "Error"
✅  "Este cupón venció el 15 de junio de 2026"
```

---

## 11. Contenido y microcopy

### 11.1 Voz
Español de Colombia, tuteo, directo y sin tecnicismos innecesarios. Frases cortas. Se dice qué pasó y qué hacer.

### 11.2 Biblioteca de textos clave

| Situación | Texto |
|---|---|
| Botón principal de producto | "Agregar al carrito" |
| Confirmación de adición | "Agregado al carrito" |
| Carrito vacío | "Tu carrito está vacío. Explora el catálogo y encuentra el repuesto que necesitas." |
| Sin resultados de filtro | "No encontramos productos con esos filtros. Prueba ampliando la búsqueda." |
| Producto agotado | "Agotado" |
| Stock bajo | "Últimas N unidades" |
| Ir a pagar | "Continuar con el pago" |
| Requiere sesión | "Inicia sesión para completar tu compra" |
| Cotizando flete | "Calculando el costo de envío…" |
| Fallo de cotización | "No pudimos calcular el envío en este momento. El costo corre por nuestra cuenta." |
| Recogida en tienda | "Recoger en tienda — sin costo de envío" |
| Cupón aplicado | "Cupón aplicado. Ahorras $ X" |
| Cupón inválido | "Este cupón no existe o ya no está disponible" |
| Cupón fuera de alcance | "Este cupón no aplica a los productos de tu carrito" |
| Aceptación de políticas | "Acepto los Términos y Condiciones y la Política de Privacidad" |
| Pago en verificación | "Estamos confirmando tu pago. No cierres esta página." |
| Pago confirmado | "¡Listo! Tu pedido #ABC123 fue confirmado. Te enviamos el detalle a tu correo." |
| Pago rechazado | "El pago no se pudo completar. Puedes intentar con otro método." |
| Sin pedidos | "Aún no tienes pedidos. Cuando compres, aparecerán aquí." |
| Error general | "Algo salió mal. Intenta de nuevo en unos segundos." |

**Prohibido:** urgencia falsa ("¡solo por hoy!" sin que sea cierto), contadores inventados, patrones oscuros en las casillas de consentimiento (nunca preseleccionadas, nunca con doble negación).

---

## 12. Entregables de diseño

| Entregable | Contenido |
|---|---|
| Archivo de tokens | Colores, tipografía, espaciado, radios, sombras, duraciones — exportables a CSS |
| Biblioteca de componentes | Todos los componentes del §6.1 con sus variantes y estados |
| Maquetas responsive | Home, catálogo, ficha, carrito, checkout (4 pasos), confirmación, pedidos, panel — en 360 px y 1440 px |
| Especificación de estados | Cargando, vacío, error y éxito de cada vista con datos |
| Guía de accesibilidad | Orden de tabulación, etiquetas y textos alternativos por pantalla |
| Guía de fotografía | Requisitos de origen, encuadre y fondo para el catálogo |

### 12.1 Criterios de aceptación del diseño

- [ ] Ningún componente usa un valor de color, espaciado o tipografía fuera de los tokens definidos.
- [ ] Todo componente que carga datos tiene sus cuatro estados especificados.
- [ ] Todas las pantallas están maquetadas a 360 px antes que a 1440 px.
- [ ] Cada combinación de texto y fondo pasa la verificación de contraste AA.
- [ ] El flujo completo de checkout es operable únicamente con teclado.
- [ ] Ningún objetivo táctil mide menos de 44×44 px.
- [ ] Todas las imágenes tienen dimensiones declaradas (cero desplazamiento de layout).
