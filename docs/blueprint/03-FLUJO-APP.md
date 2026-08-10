# Flujo de la Aplicación
## User Journey, mapa de navegación y diagramas lógicos

| Campo | Valor |
|---|---|
| Documento | Flujo de App v1.0 |
| Complementa | `01-PRD.md`, `02-TRD.md` |
| Notación | Mermaid + ASCII |

---

## 1. Mapa de navegación

```
/                                   Home (hero, categorías, destacados)
├── /catalogo                       Catálogo con filtros (query params)
│   └── ?categoria= &sub= &min= &max= &orden= &q= &pagina=
├── /producto/[slug]                Ficha de producto
├── /carrito                        Carrito
├── /checkout                       Checkout            🔒 CUSTOMER
│   └── /checkout/confirmacion      Confirmación de pedido 🔒 CUSTOMER
├── /pedidos                        Historial de pedidos 🔒 CUSTOMER
├── /contacto                       Quiénes somos + PQR
├── /legal
│   ├── /terminos-y-condiciones
│   ├── /politica-de-privacidad
│   ├── /politica-de-envios
│   └── /politica-de-cambios
│
├── /auth
│   ├── /login
│   ├── /register
│   ├── /verify-email               Ingreso de código OTP
│   ├── /forgot-password
│   ├── /reset-password/[token]
│   └── /error
│
└── /admin                          🔒 ADMIN
    ├── /                           Dashboard
    ├── /productos                  Listado
    │   ├── /productos/[id]         Edición
    │   └── /productos/papelera     Soft-deleted
    ├── /categorias
    ├── /pedidos
    ├── /stock                      Ajuste puntual
    ├── /sync                       Carga masiva XLSX
    ├── /cupones
    ├── /banners
    └── /configuracion              Interruptores operativos
```

**Leyenda:** 🔒 = ruta protegida por el proxy de rutas + verificación en el servidor.

### 1.1 Estructura persistente

| Zona | Elemento | Presente en |
|---|---|---|
| Header | Logo, buscador, navegación de categorías, contador de carrito, menú de cuenta | Todas las rutas públicas y de cliente |
| Footer | Enlaces legales, contacto, redes | Todas las rutas públicas y de cliente |
| Sidebar admin | Navegación del panel | Todas las rutas `/admin` |

---

## 2. User Journey principal — de visitante a comprador

```mermaid
journey
    title Journey del comprador
    section Descubrimiento
      Llega a la home: 4: Visitante
      Explora categorías: 4: Visitante
      Filtra el catálogo: 3: Visitante
      Abre una ficha de producto: 5: Visitante
    section Consideración
      Revisa fotos y compatibilidad: 5: Visitante
      Agrega al carrito: 5: Visitante
      Ajusta cantidades: 4: Visitante
    section Conversión
      Va al checkout: 3: Visitante
      Se registra o inicia sesión: 2: Visitante
      Verifica su email con OTP: 2: Cliente
      Ingresa datos y dirección: 3: Cliente
      Ve el costo del flete: 4: Cliente
      Aplica un cupón: 5: Cliente
      Acepta políticas y paga: 4: Cliente
    section Postventa
      Ve la confirmación: 5: Cliente
      Recibe el email: 5: Cliente
      Sigue su envío: 4: Cliente
      Recibe el pedido: 5: Cliente
```

**Momentos de fricción identificados y su mitigación:**

| Fricción | Mitigación de diseño |
|---|---|
| Registro obligatorio antes de pagar | El carrito se preserva; tras autenticarse el usuario vuelve exactamente al checkout |
| Verificación por OTP | Código de 6 dígitos, reenviable, con contador visible; no se pide contraseña otra vez |
| Costo de envío sorpresa | El flete se calcula y se muestra **antes** de pedir el método de pago |
| Dudas sobre entrega | Opción de recogida en tienda con flete cero, visible desde el primer paso del checkout |

---

## 3. Flujos detallados

### 3.1 Descubrimiento y catálogo

```
┌──────────┐
│   Home   │
└────┬─────┘
     │
     ├── clic en banner ──────────► destino de la CTA
     ├── clic en categoría ───────► /catalogo?categoria=<slug>
     ├── clic en destacado ───────► /producto/<slug>
     └── búsqueda ────────────────► /catalogo?q=<término>
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │      /catalogo        │
                              │  ┌─────────────────┐  │
                              │  │ Panel de filtros│  │
                              │  │ · Categoría     │  │
                              │  │ · Subcategoría  │  │
                              │  │ · Rango precio  │  │
                              │  │ · Solo con stock│  │
                              │  │ · Orden         │  │
                              │  └────────┬────────┘  │
                              │           │ actualiza │
                              │           │ la URL    │
                              │  ┌────────▼────────┐  │
                              │  │  Grilla + paginación│
                              │  └────────┬────────┘  │
                              └───────────┼───────────┘
                                          ▼
                              ┌───────────────────────┐
                              │  /producto/[slug]     │
                              │  · Galería            │
                              │  · Precio y stock     │
                              │  · Descripción general│
                              │  · Beneficios         │
                              │  · Compatibilidad     │
                              │  · Selector cantidad  │
                              │  · [Agregar al carrito]│
                              │  · Relacionados       │
                              └───────────────────────┘
```

**Reglas de estado del filtro:** el estado de los filtros vive en la URL, no en memoria del cliente. Consecuencias: la vista filtrada es compartible, el botón "atrás" del navegador funciona, y el servidor puede renderizar el resultado directamente.

**Estados de la grilla:**

| Estado | Presentación |
|---|---|
| Cargando | Esqueletos con la forma exacta de la tarjeta |
| Con resultados | Grilla responsive + total de resultados |
| Vacío por filtros | Mensaje + acción "Limpiar filtros" |
| Vacío por búsqueda | Mensaje + sugerencias de categorías |
| Error | Mensaje + acción "Reintentar" |

### 3.2 Autenticación

```mermaid
flowchart TD
    A[Usuario en /auth/register] --> B[Formulario: nombre, email, contraseña, aceptar T&C]
    B --> C{¿Email ya registrado?}
    C -->|Sí| D[Error: cuenta existente + enlace a login]
    C -->|No| E[Crear usuario, hash bcrypt cost 12]
    E --> F[Generar OTP 6 dígitos]
    F --> G[Guardar SHA-256 del OTP, expira 10 min]
    G --> H[Enviar email con el código]
    H --> I[Redirigir a /auth/verify-email]
    I --> J[Usuario ingresa el código]
    J --> K{¿Válido y vigente?}
    K -->|No, intentos < 5| L[Error, incrementar contador] --> J
    K -->|No, intentos = 5| M[Invalidar OTP, ofrecer reenvío] --> N[Reenviar OTP] --> J
    K -->|Expirado| N
    K -->|Sí| O[Marcar emailVerified, registrar acceptedTermsAt]
    O --> P[Iniciar sesión automáticamente]
    P --> Q[Redirigir al destino previo o a la home]
```

**Flujo de credenciales (login):**

```
Navegador                Frontend                    API
   │                        │                          │
   │─ email + contraseña ──►│                          │
   │                        │─ POST /auth/login ──────►│
   │                        │                          │─ buscar usuario
   │                        │                          │─ bcrypt.compare
   │                        │                          │─ ¿emailVerified?
   │                        │◄── { user, accessToken }─│
   │                        │                          │
   │                        │─ crear sesión JWT        │
   │                        │  { id, role, accessToken}│
   │◄─ cookie de sesión ────│                          │
```

**Flujo OAuth:**

```
Navegador ─► Proveedor OAuth ─► callback del frontend
                                      │
                                      ▼
                        adaptador crea/actualiza el usuario
                                      │
                                      ▼
                     POST /auth/session-token  (header: secreto interno)
                                      │
                                      ▼
                        API devuelve su propio JWT
                                      │
                                      ▼
                     sesión = { id, role, accessToken }
```

**Recuperación de contraseña:**

```
/auth/forgot-password ──► POST /auth/forgot-password
                              │
                              ├─ genera token aleatorio
                              ├─ guarda SHA-256 + expiración
                              ├─ envía email con el token crudo
                              └─ responde SIEMPRE 200  ← no revela si el email existe
                                       │
                              /auth/reset-password/[token]
                                       │
                              POST /auth/reset-password
                                       ├─ hashea el token recibido y lo busca
                                       ├─ verifica vigencia y que no esté usado
                                       ├─ actualiza contraseña
                                       └─ marca el token como usado
```

### 3.3 Carrito

```mermaid
stateDiagram-v2
    [*] --> Vacio
    Vacio --> ConItems: agregar producto
    ConItems --> ConItems: cambiar cantidad
    ConItems --> ConItems: agregar otro producto
    ConItems --> Vacio: eliminar último ítem
    ConItems --> Vacio: vaciar carrito
    ConItems --> Checkout: ir a pagar
    Checkout --> ConItems: volver
    Checkout --> Vacio: pedido creado y pagado
```

**Reglas:**
- El carrito se persiste en almacenamiento local bajo una clave **particionada por usuario**. Al iniciar sesión se carga el carrito de esa identidad; al cerrar sesión no se filtra al siguiente usuario del dispositivo.
- La cantidad de cada línea está acotada por el stock disponible del producto.
- El carrito guarda una copia del precio y el nombre para renderizar sin consultar, pero el **precio autoritativo se recalcula en el servidor** al crear el pedido.
- Retroalimentación inmediata al agregar: animación de confirmación + actualización del contador del header + notificación efímera.

### 3.4 Checkout — el flujo crítico

```mermaid
flowchart TD
    START([Usuario pulsa Ir a pagar]) --> AUTH{¿Sesión activa?}
    AUTH -->|No| LOGIN[Redirigir a /auth/login con destino de retorno]
    LOGIN --> AUTH
    AUTH -->|Sí| S1

    subgraph S1[Paso 1 · Datos del comprador]
        A1[Tipo de documento: CC / CE / NIT / Pasaporte]
        A2[Número de documento]
        A3{¿Es NIT?}
        A3 -->|Sí| A4[Razón social obligatoria]
        A1 --> A2 --> A3
    end

    S1 --> S2

    subgraph S2[Paso 2 · Entrega]
        B1{Método de entrega}
        B1 -->|Recogida en tienda| B2[flete = 0 · sin dirección · sin guía]
        B1 -->|Envío a domicilio| B3[Dirección + ciudad del catálogo oficial]
        B3 --> B4[POST /shipping/quote]
        B4 --> B5{¿Cotización exitosa?}
        B5 -->|Sí| B6[Mostrar valor del flete]
        B5 -->|No| B7[flete = 0 · el negocio lo absorbe · continuar]
    end

    S2 --> S3

    subgraph S3[Paso 3 · Resumen y descuentos]
        C1[Subtotal de productos]
        C2[¿Cupón? POST /coupons/validate]
        C2 --> C3{¿Válido?}
        C3 -->|No| C4[Mensaje explícito · total sin cambios]
        C3 -->|Sí| C5[Aplicar descuento · mostrar ahorro]
        C6[Total = subtotal − descuento + flete]
    end

    S3 --> S4

    subgraph S4[Paso 4 · Políticas y pago]
        D1[Checkbox de aceptación de políticas]
        D2{¿Aceptado?}
        D2 -->|No| D3[Botón de pago deshabilitado]
        D2 -->|Sí| D4[Seleccionar método de pago]
    end

    S4 --> ORDER[POST /orders]
    ORDER --> VAL{Validación en servidor:<br/>stock · precios · cupón}
    VAL -->|Falla| ERR[Mostrar error específico · no se crea pedido]
    VAL -->|OK| CREATE[Crear pedido PENDING<br/>policiesAcceptedAt = ahora<br/>STOCK SIN TOCAR]
    CREATE --> PAY{Método de pago}
    PAY -->|Pasarela principal| P1[Redirigir con firma de integridad]
    PAY -->|Pasarela de respaldo| P2[Crear preferencia y redirigir]
    PAY -->|Contra entrega| P3[Confirmar sin redirección]
    P1 --> CONF
    P2 --> CONF
    P3 --> CONF[/checkout/confirmacion/]
```

**Punto de diseño clave:** la creación del pedido y el cobro son pasos separados. Un pedido `PENDING` sin pago no consume inventario ni genera obligaciones logísticas; simplemente expira en la práctica.

### 3.5 Confirmación de pago (asíncrona)

```
   Usuario                Pasarela                 API                    Base de datos
      │                      │                      │                          │
      │─ paga en la pasarela►│                      │                          │
      │                      │                      │                          │
      │◄─ redirige a         │                      │                          │
      │   /checkout/confirmacion                    │                          │
      │                      │                      │                          │
      │  «Estamos           │─ POST /payments/*/webhook ──►                     │
      │   confirmando        │                      │                          │
      │   tu pago…»          │                      │─ verificar firma         │
      │                      │                      │  (rechaza si inválida)   │
      │                      │                      │                          │
      │                      │                      │─ leer pedido ───────────►│
      │                      │                      │◄─ status actual ─────────│
      │                      │                      │                          │
      │                      │                      │  ¿ya está PAID?          │
      │                      │                      │  ─► sí: responder 200    │
      │                      │                      │      sin efectos         │
      │                      │                      │                          │
      │                      │                      │─ [TRANSACCIÓN] ─────────►│
      │                      │                      │   order.status = PAID    │
      │                      │                      │   payment.status=APPROVED│
      │                      │                      │   decrementStock atómico │
      │                      │                      │   emailQueue.insert      │
      │                      │                      │   shippingQueue.insert   │
      │                      │                      │◄─────────────────────────│
      │                      │◄─ 200 OK ────────────│                          │
      │                      │                      │                          │
      │─ la página consulta el estado ─────────────►│                          │
      │◄─ pedido confirmado ────────────────────────│                          │
```

**La página de confirmación no decide nada.** Consulta el estado del pedido y muestra:
- `PENDING` → "Estamos confirmando tu pago" con reintento automático.
- `PAID` → confirmación completa con número de pedido y detalle.
- Pago rechazado → mensaje y opción de reintentar con otro método.

### 3.6 Procesamiento asíncrono (workers)

```mermaid
flowchart LR
    subgraph Worker de emails
        E1[Cada 2 min] --> E2[SELECT status=PENDING AND nextRetry<=now]
        E2 --> E3[Enviar vía proveedor]
        E3 --> E4{¿Éxito?}
        E4 -->|Sí| E5[status=SENT]
        E4 -->|No| E6[attempts++ · backoff 5s/30s/120s]
        E6 --> E7{attempts >= 3?}
        E7 -->|Sí| E8[status=FAILED · visible en el panel]
        E7 -->|No| E9[reprogramar nextRetry]
    end

    subgraph Worker de logística
        L1[Cada 2 min] --> L2[Reclamar fila: status=PROCESSING + processingStartedAt]
        L2 --> L3[Crear pedido en el operador]
        L3 --> L4{¿Éxito?}
        L4 -->|Sí| L5[Guardar id externo · status=SENT]
        L4 -->|No| L6[attempts++ · backoff]
        L6 --> L7{attempts >= 3?}
        L7 -->|Sí| L8[status=FAILED]
        L7 -->|No| L9[volver a PENDING]
    end

    subgraph Sweeper
        S1[Cada 5 min] --> S2[Filas en PROCESSING con más de 5 min]
        S2 --> S3[Devolver a PENDING]
    end
```

**Por qué el sweeper existe:** en una plataforma de contenedores efímeros, una instancia puede morir después de marcar la fila como `PROCESSING` y antes de completar el trabajo. Sin el sweeper, ese pedido nunca se despacharía y nadie se enteraría.

### 3.7 Seguimiento del envío

```
Operador logístico ──► POST /vendelo/webhook  (firma verificada)
                              │
                              ▼
                    mapear evento → estado de envío
                              │
              PENDING → READY → PREPARING → SHIPPED → DELIVERED
                    │                          │
                    └──► CANCELLED             └──► INCIDENT ──► RETURNED
                              │
                              ▼
                  upsert del Shipment del pedido
                  (número de guía, transportador, URL de etiqueta)
                              │
                              ▼
                 visible en /pedidos para el cliente
```

**Excepciones de envío:** cuando el operador rechaza una dirección o marca un destinatario como no confiable, se registra una excepción. El administrador la resuelve desde el panel (corrigiendo datos o autorizando el envío) y el pedido se reencola.

### 3.8 Historial de pedidos (cliente)

```
/pedidos
   │
   ├─ lista de pedidos del usuario autenticado (solo los suyos)
   │     · número, fecha, total, estado del pedido, estado del envío
   │
   └─ detalle de un pedido
         · ítems con precio congelado al momento de la compra
         · dirección o punto de recogida
         · desglose: subtotal · descuento · flete · total
         · número de guía y seguimiento (si aplica)
         · descarga del comprobante en PDF
```

---

## 4. Flujos administrativos

### 4.1 Acceso al panel — triple verificación

```mermaid
flowchart TD
    A[Petición a /admin/*] --> B[Capa 1 · Proxy de rutas]
    B --> C{¿Sesión con rol ADMIN?}
    C -->|No| D[Redirigir a login o a la home]
    C -->|Sí| E[Capa 2 · Layout del panel en servidor]
    E --> F{¿Sesión válida y rol ADMIN?}
    F -->|No| G[Renderizar 403]
    F -->|Sí| H[Renderizar el panel]
    H --> I[Petición a la API con Bearer]
    I --> J[Capa 3 · Guard de rol en la API]
    J --> K{¿El JWT declara ADMIN?}
    K -->|No| L[403 desde la API]
    K -->|Sí| M[Ejecutar la operación]
```

Cada capa asume que las anteriores pudieron ser evadidas. Un atacante que llame directamente a la API con un token de cliente choca contra la capa 3.

### 4.2 Gestión de productos

```
/admin/productos
   ├─ listado con búsqueda, filtro por categoría y estado
   ├─ [Nuevo producto] ──► formulario
   │     · datos básicos: nombre, slug, SKU, precio, stock
   │     · categoría
   │     · imágenes → subida al CDN → se guardan las URLs
   │     · dimensiones y peso (necesarios para cotizar flete)
   │     · descripción estructurada: general + beneficios + compatibilidad
   │     └─► POST /admin/products ──► revalidar etiquetas de caché
   │
   ├─ [Editar] ──► PUT /admin/products/:id ──► revalidar
   ├─ [Eliminar] ──► DELETE /admin/products/:id  (soft delete)
   │                  ──► desaparece del catálogo · va a la papelera
   └─ /papelera
         └─ [Restaurar] ──► PATCH /admin/products/:id/restore ──► revalidar
```

### 4.3 Sincronización masiva de stock

```mermaid
flowchart TD
    A[Admin en /admin/sync] --> B[Selecciona archivo XLSX]
    B --> C[POST /admin/sync/stock/preview]
    C --> D[Parsear · normalizar SKU · comparar con la base]
    D --> E[Devolver diff clasificado]
    E --> F[Mostrar tabla:<br/>nuevos · cambio de precio · cambio de stock<br/>· sin cambios · errores de formato]
    F --> G{¿Admin confirma?}
    G -->|No| H[Descartar · nada cambió]
    G -->|Sí| I[POST /admin/sync/stock/apply]
    I --> J[Aplicar cambios en transacción]
    J --> K[Revalidar etiquetas de caché]
    K --> L[Informe: N actualizados, M creados, X errores]
```

**Principio:** ninguna operación destructiva o masiva se ejecuta sin una previsualización explícita del efecto.

### 4.4 Gestión de pedidos

```
/admin/pedidos
   ├─ filtros: estado, rango de fechas, búsqueda por cliente o número
   ├─ tabla: número · cliente · fecha · total · estado · envío
   └─ detalle
        ├─ [Cambiar estado] ──► PATCH /orders/:id/status
        ├─ [Generar guía]   ──► POST /admin/vendelo/create-shipments
        ├─ [Descargar etiqueta] ──► POST /admin/vendelo/generate-labels
        ├─ [Solicitar recogida] ──► POST /admin/vendelo/request-pickup
        └─ [Resolver excepción] ──► POST /admin/vendelo/exceptions/:id/resolve
```

### 4.5 Cupones

```
/admin/cupones
   └─ [Nuevo cupón]
        · código (único, se normaliza a mayúsculas)
        · tipo: PORCENTAJE (puntos base) o FIJO (centavos)
        · valor
        · alcance excluyente: categoría (incluye subcategorías) O producto
        · restricción: ninguna · una vez por cliente · solo primera compra
        · fecha de expiración
        └─► POST /coupons
```

**Validación en el checkout:**

```mermaid
flowchart TD
    A[Cliente ingresa código] --> B[POST /coupons/validate]
    B --> C{¿Existe y está activo?}
    C -->|No| Z[Rechazar: código inválido]
    C -->|Sí| D{¿Vigente? expiresAt > ahora}
    D -->|No| Y[Rechazar: expirado]
    D -->|Sí| E{Restricción}
    E -->|ONCE_PER_CUSTOMER| F{¿Ya lo usó este cliente?}
    F -->|Sí| X[Rechazar: ya utilizado]
    E -->|FIRST_PURCHASE| G{¿Tiene pedidos aprobados previos?}
    G -->|Sí| W[Rechazar: solo primera compra]
    E -->|NONE| H
    F -->|No| H
    G -->|No| H[Calcular base aplicable según el alcance]
    H --> I{¿Hay ítems dentro del alcance?}
    I -->|No| V[Rechazar: no aplica a este carrito]
    I -->|Sí| J[Calcular descuento sobre la base]
    J --> K[Devolver monto de descuento y total actualizado]
```

**Regla de seguridad:** este mismo cálculo se repite íntegramente al crear el pedido. El resultado enviado por el cliente jamás se acepta como autoritativo.

### 4.6 Configuración operativa

```
/admin/configuracion
   ├─ [Pasarela de respaldo]  activada / desactivada
   ├─ [Pago contra entrega]   activado / desactivado
   └─ [Cobro de flete en línea] activado / desactivado
         └─ desactivado ⇒ el negocio absorbe el flete en todos los pedidos
```

Estos interruptores viven en la base de datos, no en variables de entorno, para permitir cambios operativos sin redeploy.

---

## 5. Máquinas de estado

### 5.1 Estado del pedido

```mermaid
stateDiagram-v2
    [*] --> PENDING: pedido creado en checkout
    PENDING --> PAID: webhook de pago aprobado
    PENDING --> CANCELLED: pago rechazado, expirado o cancelado por admin
    PAID --> SHIPPED: guía generada y despachado
    SHIPPED --> DELIVERED: confirmación de entrega
    PAID --> CANCELLED: cancelación con reversión de stock
    SHIPPED --> CANCELLED: devolución en tránsito
    DELIVERED --> [*]
    CANCELLED --> [*]
```

| Transición | Disparador | Efectos |
|---|---|---|
| → `PENDING` | Creación en checkout | Ninguno sobre inventario |
| `PENDING` → `PAID` | Webhook firmado con estado aprobado | Descuento atómico de stock, encolado de email y de guía |
| `PENDING` → `CANCELLED` | Webhook rechazado / acción de admin | Ninguno sobre inventario |
| `PAID` → `SHIPPED` | Guía generada / webhook del operador | Registro de guía y transportador |
| `SHIPPED` → `DELIVERED` | Webhook del operador | Cierre del ciclo |
| `PAID`/`SHIPPED` → `CANCELLED` | Acción de admin | Reversión de stock (operación explícita y auditada) |

### 5.2 Estado del pago

```
PENDING ──► APPROVED   (webhook: transacción aprobada)
   │
   ├──────► DECLINED   (webhook: rechazada por el emisor)
   ├──────► VOIDED     (anulada antes de la captura)
   └──────► ERROR      (fallo técnico de la pasarela)
```

### 5.3 Estado del envío

```
PENDING ──► READY ──► PREPARING ──► SHIPPED ──► DELIVERED
   │                                    │
   │                                    ├──► INCIDENT ──► RETURNED
   │                                    │
   └──► CANCELLED ◄─────────────────────┘
```

### 5.4 Estado de las colas

```
PENDING ──(worker reclama)──► PROCESSING ──(éxito)──► SENT
   ▲                              │
   │                          (fallo, attempts<3)
   │                              │
   └──────────────────────────────┘
                                  │
                          (attempts>=3)
                                  ▼
                               FAILED

PROCESSING ──(más de 5 min sin avance, sweeper)──► PENDING
```

---

## 6. Manejo de errores en la interfaz

| Escenario | Comportamiento esperado |
|---|---|
| Producto agotado al agregar al carrito | Notificación explicando el stock disponible; la cantidad se ajusta al máximo posible |
| Stock insuficiente al crear el pedido | Error identificando el producto concreto; el usuario vuelve al carrito con el ítem marcado |
| Cotización de flete falla | El checkout continúa con flete cero y una nota; no se bloquea la compra |
| Pasarela de pago no responde | Mensaje con opción de reintentar o cambiar de método; el pedido queda en `PENDING` |
| Cupón inválido | Mensaje específico según la causa (inexistente, expirado, ya usado, fuera de alcance) |
| Sesión expirada durante el checkout | Redirección a login preservando el carrito y el destino de retorno |
| Falla del CDN de imágenes | Placeholder; el resto de la ficha funciona |
| Error 500 de la API | Página de error con acción de reintento y captura en la herramienta de observabilidad |

**Principio:** ningún error técnico se muestra crudo al usuario. Cada código de error del dominio tiene un mensaje en español, orientado a la acción que el usuario puede tomar.

---

## 7. Rutas y protección — matriz consolidada

| Ruta | Público | Cliente | Admin | Protección |
|---|:---:|:---:|:---:|---|
| `/`, `/catalogo`, `/producto/[slug]` | ✅ | ✅ | ✅ | — |
| `/carrito` | ✅ | ✅ | ✅ | — |
| `/contacto`, `/legal/*` | ✅ | ✅ | ✅ | — |
| `/auth/*` | ✅ | redirige | redirige | Redirección si ya hay sesión |
| `/checkout`, `/checkout/confirmacion` | ❌ | ✅ | ✅ | Proxy + verificación en servidor |
| `/pedidos` | ❌ | ✅ | ✅ | Proxy + filtro por identidad del usuario |
| `/admin/*` | ❌ | ❌ | ✅ | Proxy + layout en servidor + guard de rol en API |
