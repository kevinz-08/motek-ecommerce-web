# PRD — Product Requirement Document
## Plataforma E-commerce de Repuestos para Motocicletas

| Campo | Valor |
|---|---|
| Documento | PRD v1.0 |
| Producto de referencia | Motek Store (motek-store) |
| Mercado | Colombia (COP, ES-CO) |
| Autor | Arquitectura de Producto |
| Estado | Base para nueva implementación |

---

## 1. Visión general del producto

Plataforma de comercio electrónico vertical especializada en **repuestos y accesorios para motocicletas**, orientada al mercado colombiano. El producto resuelve tres problemas simultáneos:

1. **Para el comprador:** encontrar el repuesto correcto para su moto específica sin conocimiento técnico profundo, pagando con los métodos locales que realmente usa (Nequi, PSE, Bancolombia, tarjeta, contra entrega).
2. **Para el comerciante:** vender fuera del mostrador físico sin montar una operación logística propia, delegando despacho y guías a un operador integrado.
3. **Para la operación:** mantener un único inventario sincronizado entre la tienda física (archivo/ERP) y el catálogo en línea.

**Propuesta de valor diferencial:** catálogo con compatibilidad por marca/modelo/año, checkout con métodos de pago locales colombianos, y logística de última milla automatizada (cotización de flete en tiempo real, creación de guía y seguimiento) sin intervención manual del comerciante.

### 1.1 Principios de producto

| Principio | Implicación de diseño |
|---|---|
| **El dinero nunca se aproxima** | Todos los montos son enteros en centavos COP. Cero aritmética flotante. |
| **El stock es sagrado** | El inventario solo se descuenta cuando hay dinero confirmado, nunca antes. |
| **Ningún efecto secundario bloquea al usuario** | Emails, guías de envío y notificaciones se encolan; el checkout nunca espera a un tercero. |
| **Todo tercero falla** | Cada integración externa (pagos, logística, email) tiene reintentos, idempotencia y estado persistido. |
| **Cumplimiento legal por diseño** | Evidencia de aceptación de términos, consentimiento de marketing separado, y datos de facturación capturados en checkout (Ley 1581/2012, SIC). |

---

## 2. Objetivos

### 2.1 Objetivos de negocio

| # | Objetivo | Métrica de éxito (KPI) |
|---|---|---|
| OB-1 | Habilitar el canal de venta en línea | ≥ 30 % de los pedidos totales del negocio provienen del canal digital a los 6 meses |
| OB-2 | Reducir la fricción de pago | Tasa de conversión checkout → pago aprobado ≥ 65 % |
| OB-3 | Automatizar la logística | ≥ 95 % de los pedidos pagados generan guía sin intervención manual |
| OB-4 | Consistencia de inventario | < 1 % de pedidos cancelados por stock inexistente |
| OB-5 | Autonomía operativa del comerciante | 100 % de la gestión de catálogo, precios, stock, cupones y banners desde el panel, sin desarrollador |

### 2.2 Objetivos de experiencia

- Tiempo hasta primer producto visible (LCP en home) < 2.5 s en 4G.
- Un comprador recurrente completa una recompra en ≤ 5 pantallas.
- Cero ambigüedad sobre el costo final: el flete se muestra antes de pedir datos de pago.

### 2.3 No-objetivos (fuera de alcance del MVP)

- Marketplace multivendedor.
- Cotización de servicios de taller / agendamiento de mantenimiento.
- App móvil nativa (la web es responsive-first).
- Facturación electrónica DIAN (se capturan los datos, la emisión es externa).
- Suscripciones o pagos recurrentes.
- Internacionalización fuera de Colombia.

---

## 3. Público objetivo

### 3.1 Personas

**P1 — Motociclista urbano ("Andrés", 24-40 años)**
Usa la moto como transporte diario o herramienta de trabajo (domicilios, mensajería). Compra por necesidad y urgencia: se le dañó algo. Sabe la marca y modelo de su moto pero no necesariamente la referencia del repuesto.
- *Necesita:* filtrar por su moto, ver si hay stock, saber cuándo llega, pagar con Nequi.
- *Fricción histórica:* llegar al almacén y que no haya la pieza.

**P2 — Motociclista entusiasta ("Camilo", 20-35 años)**
Personaliza su moto. Compra accesorios y piezas de alto flujo por gusto, no por urgencia. Investiga, compara, es sensible a la marca del repuesto.
- *Necesita:* fotos de calidad, descripción técnica estructurada, beneficios, compatibilidad explícita.

**P3 — Mecánico / taller pequeño ("Don Jorge", 35-60 años)**
Compra recurrente y por volumen bajo. Requiere factura con NIT.
- *Necesita:* recompra rápida, datos fiscales guardados, recogida en tienda para evitar flete.

**P4 — Administrador del negocio ("Tony", dueño/operador)**
No es técnico. Gestiona precios, sube productos, revisa pedidos, imprime guías.
- *Necesita:* panel simple, carga masiva de stock desde su archivo de Excel, dashboard de ingresos del día.

### 3.2 Segmentación por rol de sistema

| Rol | Acceso |
|---|---|
| `GUEST` | Catálogo, ficha de producto, carrito, contenido legal, formulario de contacto |
| `CUSTOMER` | Todo lo anterior + checkout, historial de pedidos, seguimiento de envío |
| `ADMIN` | Todo lo anterior + panel completo de gestión |

---

## 4. Casos de uso principales

### CU-01 — Descubrir y encontrar un repuesto
**Actor:** Guest / Customer
**Flujo:** Home → categorías o buscador → catálogo filtrado (categoría, subcategoría, rango de precio, disponibilidad, orden) → ficha de producto.
**Reglas:**
- Solo se listan productos `isActive = true` y no eliminados (`deletedAt = null`).
- Los productos sin stock se muestran marcados como agotados pero no son comprables.
- El catálogo se sirve desde caché con revalidación por etiquetas; una edición en el panel refleja el cambio en segundos, no minutos.

### CU-02 — Evaluar un producto
**Actor:** Guest / Customer
**Flujo:** Ficha de producto → galería de imágenes → descripción estructurada (descripción general + lista de beneficios + lista de compatibilidad con motos) → agregar al carrito.
**Reglas:** la compatibilidad se presenta como texto legible por el comprador ("Honda CB160F 2020-2023"), no como códigos.

### CU-03 — Gestionar el carrito
**Actor:** Guest / Customer
**Flujo:** Agregar / modificar cantidad / eliminar → ver subtotal.
**Reglas:**
- El carrito persiste en el navegador y está **particionado por usuario** (`cart:{userId}`), de modo que dos sesiones en el mismo dispositivo no se contaminan.
- La cantidad nunca puede exceder el stock disponible.

### CU-04 — Autenticarse
**Actor:** Guest
**Flujos soportados:**
- Registro con email + contraseña → verificación por **código OTP de 6 dígitos** enviado por email (expira 10 min, máx. 5 intentos).
- Inicio de sesión con Google (OAuth).
- Recuperación de contraseña por token de un solo uso enviado por email.
**Reglas:** la contraseña se almacena con bcrypt (cost 12). El OTP y el token de reseteo se almacenan hasheados (SHA-256), nunca en claro.

### CU-05 — Completar una compra (checkout)
**Actor:** Customer (autenticación obligatoria)
**Flujo:**
1. Datos del comprador: tipo y número de documento (CC/CE/NIT/Pasaporte), razón social si es NIT.
2. Método de entrega: **envío a domicilio** o **recogida en tienda**.
3. Si es domicilio: dirección + ciudad (catálogo oficial de ciudades) → cotización de flete en tiempo real.
4. Aplicación opcional de cupón de descuento.
5. Aceptación explícita de términos y políticas (se registra timestamp).
6. Selección de método de pago → redirección a la pasarela o confirmación de contra entrega.

**Reglas críticas:**
- Recogida en tienda ⇒ flete = 0 y el pedido no entra a la cola logística.
- Si la cotización de flete falla, el pedido **no se bloquea**: el negocio absorbe el flete (flete = 0) y el pedido continúa.
- El stock **no** se descuenta al crear el pedido.

### CU-06 — Pagar
**Actor:** Customer
**Proveedores:** pasarela principal (tarjetas, Nequi, PSE, Bancolombia), pasarela de respaldo, y contra entrega (COD).
**Flujo:** creación del pedido en estado `PENDING` → redirección a la pasarela → el usuario paga → la pasarela notifica por webhook → el pedido pasa a `PAID`.
**Reglas:**
- El webhook es la **única** fuente de verdad del pago. El retorno del usuario a la página de confirmación es informativo.
- Los webhooks son **idempotentes**: verifican el estado actual del pedido antes de actuar.
- La firma del webhook se valida criptográficamente antes de procesar nada.

### CU-07 — Recibir confirmación
**Actor:** Customer
**Flujo:** pago aprobado → el sistema encola un email de confirmación → un worker lo envía → el cliente recibe el detalle del pedido.
**Reglas:** máximo 3 intentos con backoff (5 s → 30 s → 120 s). Los fallos quedan visibles en el panel admin.

### CU-08 — Recibir el pedido / seguimiento
**Actor:** Customer
**Flujo:** pago aprobado → el pedido se encola para creación de guía en el operador logístico → se genera número de guía → el estado del envío se actualiza vía webhooks del operador → el cliente lo consulta en "Mis pedidos".
**Estados de envío:** `PENDING → READY → PREPARING → SHIPPED → DELIVERED`, con ramas `INCIDENT`, `RETURNED`, `CANCELLED`.

### CU-09 — Administrar el catálogo
**Actor:** Admin
**Capacidades:** CRUD de productos (con subida de imágenes a CDN), CRUD de categorías con jerarquía padre/hijo, edición de descripción estructurada, **soft delete** con papelera y restauración, ajuste puntual de stock.

### CU-10 — Sincronizar stock masivamente
**Actor:** Admin
**Flujo:** cargar archivo de inventario (XLSX) → **vista previa** de los cambios detectados (altas, cambios de precio, cambios de stock) → confirmar → aplicar.
**Regla:** la sincronización nunca se aplica a ciegas; siempre hay un paso de previsualización.

### CU-11 — Administrar pedidos y logística
**Actor:** Admin
**Capacidades:** listar/filtrar pedidos, cambiar estado, generar guías, descargar etiquetas, solicitar recogida al transportador, y resolver **excepciones de envío** (direcciones rechazadas, destinatarios no confiables).

### CU-12 — Promociones
**Actor:** Admin
**Capacidades:** crear cupones de **porcentaje** o **monto fijo**, con alcance por **categoría** (incluye subcategorías) o **producto específico**, con restricciones: sin restricción, una vez por cliente, o solo primera compra. Vigencia con fecha de expiración.

### CU-13 — Contenido de la home
**Actor:** Admin
**Capacidades:** CRUD y reordenamiento de banners del carrusel principal, con imagen en CDN, título, descripción y llamada a la acción.

### CU-14 — Medir el negocio
**Actor:** Admin
**Capacidades:** dashboard con ingresos del día, ingresos del mes, serie temporal de ingresos, pedidos recientes y productos con stock bajo.

### CU-15 — Atención al cliente
**Actor:** Guest
**Flujo:** formulario de PQR (peticiones, quejas, reclamos) → email al negocio.

---

## 5. Funcionalidades clave

### 5.1 Matriz de funcionalidades

| ID | Funcionalidad | Prioridad | Épica |
|---|---|---|---|
| F-01 | Catálogo con filtros (categoría, subcategoría, precio, disponibilidad, orden) | P0 | Descubrimiento |
| F-02 | Búsqueda por texto sobre nombre/SKU/descripción | P0 | Descubrimiento |
| F-03 | Ficha de producto con galería e información estructurada | P0 | Descubrimiento |
| F-04 | Categorías jerárquicas (padre → subcategorías) | P0 | Descubrimiento |
| F-05 | Carrito persistente particionado por usuario | P0 | Compra |
| F-06 | Registro/login con email + contraseña, verificación OTP | P0 | Identidad |
| F-07 | Login social (Google) | P1 | Identidad |
| F-08 | Recuperación de contraseña | P0 | Identidad |
| F-09 | Checkout con datos fiscales (CC/CE/NIT/Pasaporte) | P0 | Compra |
| F-10 | Elección entre envío a domicilio y recogida en tienda | P0 | Compra |
| F-11 | Cotización de flete en tiempo real por ciudad y peso | P0 | Logística |
| F-12 | Pasarela de pago principal (tarjeta, Nequi, PSE, transferencia) | P0 | Pago |
| F-13 | Pasarela de pago de respaldo | P1 | Pago |
| F-14 | Pago contra entrega (COD), activable/desactivable | P1 | Pago |
| F-15 | Webhooks de pago firmados e idempotentes | P0 | Pago |
| F-16 | Descuento de stock atómico solo al confirmar pago | P0 | Inventario |
| F-17 | Cola de emails transaccionales con reintentos | P0 | Notificaciones |
| F-18 | Cola de creación de guías logísticas con reintentos y sweeper | P0 | Logística |
| F-19 | Webhooks del operador logístico → estado del envío | P1 | Logística |
| F-20 | Historial de pedidos y seguimiento para el cliente | P0 | Postventa |
| F-21 | Comprobante de venta en PDF | P1 | Postventa |
| F-22 | Panel admin: CRUD productos + imágenes en CDN | P0 | Backoffice |
| F-23 | Panel admin: soft delete y papelera de productos | P1 | Backoffice |
| F-24 | Panel admin: CRUD categorías | P0 | Backoffice |
| F-25 | Panel admin: sincronización de stock por XLSX con vista previa | P1 | Backoffice |
| F-26 | Panel admin: gestión de pedidos y cambio de estado | P0 | Backoffice |
| F-27 | Panel admin: dashboard de métricas | P1 | Backoffice |
| F-28 | Panel admin: cupones de descuento | P1 | Growth |
| F-29 | Panel admin: banners del hero | P2 | Growth |
| F-30 | Panel admin: interruptores de configuración (COD, pasarela alterna, cobro de flete) | P1 | Backoffice |
| F-31 | Panel admin: bandeja de emails fallidos | P2 | Observabilidad |
| F-32 | Panel admin: excepciones de envío y resolución | P2 | Logística |
| F-33 | Páginas legales (T&C, privacidad, envíos, cambios) | P0 | Cumplimiento |
| F-34 | Registro de evidencia de aceptación de políticas | P0 | Cumplimiento |
| F-35 | Consentimiento de marketing independiente | P1 | Cumplimiento |
| F-36 | Formulario de contacto / PQR | P1 | Soporte |
| F-37 | Sitemap dinámico y metadatos SEO por producto | P1 | Crecimiento orgánico |
| F-38 | Monitoreo de errores en producción | P1 | Observabilidad |

### 5.2 Reglas de negocio transversales (invariantes)

| ID | Regla |
|---|---|
| RN-01 | Todo monto monetario es un entero en centavos COP. Prohibido `float`. |
| RN-02 | El stock se descuenta **exclusivamente** al recibir un webhook de pago aprobado, mediante una operación atómica. |
| RN-03 | Ningún email se envía de forma síncrona dentro de un manejador de webhook. |
| RN-04 | Todo webhook entrante valida firma antes de procesar, y es idempotente. |
| RN-05 | Un producto nunca se borra físicamente; se marca como eliminado. |
| RN-06 | El precio de un ítem se congela en el pedido al momento de la compra (`priceAtPurchase`). |
| RN-07 | Un cupón se valida en el servidor en el momento de crear el pedido, nunca solo en el cliente. |
| RN-08 | El alcance de un cupón es excluyente: categoría **o** producto, jamás ambos. |
| RN-09 | Recogida en tienda ⇒ flete = 0 y sin creación de guía. |
| RN-10 | Un fallo del operador logístico nunca impide completar una compra. |
| RN-11 | La aceptación de políticas se persiste con timestamp inmutable en el pedido. |

---

## 6. Criterios de aceptación (MVP)

### 6.1 Alcance del MVP

**Incluido:** F-01 a F-06, F-08 a F-12, F-15, F-16, F-17, F-20, F-22, F-24, F-26, F-33, F-34.
**Diferido a v1.1:** F-07, F-13, F-14, F-18, F-19, F-21, F-23, F-25, F-27, F-28, F-30, F-36, F-37.
**Diferido a v1.2:** F-29, F-31, F-32, F-35, F-38.

### 6.2 Criterios de aceptación por épica

#### CA-Descubrimiento
- [ ] Dado un visitante anónimo, cuando entra a la home, ve al menos un banner, las categorías principales y una selección de productos destacados.
- [ ] Dado el catálogo, cuando aplico un filtro de categoría, la URL refleja el filtro y es compartible/marcable.
- [ ] Dado un producto sin stock, cuando lo veo en el catálogo, aparece marcado como agotado y el botón de compra está deshabilitado.
- [ ] Dado un producto eliminado o inactivo, cuando accedo a su URL directa, obtengo un 404.
- [ ] Dado un catálogo con 500 productos, la primera página carga en menos de 2.5 s (LCP) en conexión 4G.

#### CA-Identidad
- [ ] Dado un email no registrado, cuando me registro, recibo un código de 6 dígitos por correo en menos de 60 s.
- [ ] Dado un código OTP, cuando lo ingreso incorrectamente 5 veces, el código se invalida y debo solicitar uno nuevo.
- [ ] Dado un código OTP con más de 10 minutos, cuando lo ingreso, es rechazado por expirado.
- [ ] Dado un token de recuperación ya usado, cuando lo reutilizo, es rechazado.
- [ ] Dada una contraseña, nunca se almacena en texto plano ni es recuperable, solo restablecible.

#### CA-Compra
- [ ] Dado un carrito con productos, cuando intento ir a checkout sin sesión, se me redirige a login y al autenticarme regreso al checkout con el carrito intacto.
- [ ] Dado el checkout con envío a domicilio, cuando selecciono una ciudad, veo el valor del flete antes de proceder al pago.
- [ ] Dado que la cotización de flete falla, el checkout continúa con flete en cero y el pedido se crea correctamente.
- [ ] Dado el método "recogida en tienda", el flete mostrado y cobrado es cero y no se solicita dirección de entrega.
- [ ] Dado un cupón inválido, expirado o fuera de alcance, cuando lo aplico, recibo un mensaje explícito y el total no cambia.
- [ ] Dado que no acepto las políticas, el botón de pago permanece deshabilitado.
- [ ] Dado un pedido creado, su estado inicial es `PENDING` y el stock de los productos **no** ha cambiado.

#### CA-Pago
- [ ] Dado un webhook con firma inválida, la petición se rechaza sin efectos secundarios.
- [ ] Dado un webhook de pago aprobado, el pedido pasa a `PAID`, el stock se descuenta y se encola el email de confirmación.
- [ ] Dado el **mismo** webhook recibido dos veces, el stock se descuenta una sola vez.
- [ ] Dado un webhook de pago rechazado, el pedido no cambia de stock y queda registrado el intento fallido.
- [ ] Dado un pedido pagado con 3 unidades de un producto con stock 3, el stock queda en 0 y el producto pasa a agotado en el catálogo.

#### CA-Notificaciones
- [ ] Dado un pago aprobado, existe una fila en la cola de emails en estado pendiente antes de que responda el webhook.
- [ ] Dado un fallo del proveedor de email, el envío se reintenta hasta 3 veces con backoff creciente.
- [ ] Dado el tercer fallo, la entrada queda en estado fallido y es visible para el administrador.

#### CA-Postventa
- [ ] Dado un cliente autenticado, ve exclusivamente sus propios pedidos.
- [ ] Dado un pedido con guía generada, el cliente ve el número de guía y el estado del envío.

#### CA-Backoffice
- [ ] Dado un usuario sin rol de administrador, cualquier intento de acceder al panel o a un endpoint administrativo es rechazado, incluso manipulando la URL o llamando directamente a la API.
- [ ] Dado un producto creado en el panel, aparece en el catálogo público sin necesidad de redeploy.
- [ ] Dado un producto eliminado, desaparece del catálogo público y aparece en la papelera, desde donde puede restaurarse.

#### CA-Cumplimiento
- [ ] Todo pedido creado tiene registrado el instante exacto de aceptación de políticas.
- [ ] Las cuatro páginas legales son accesibles desde el pie de página en cualquier ruta del sitio.
- [ ] El consentimiento de marketing es un campo independiente y opcional, jamás preseleccionado.

### 6.3 Definition of Done

Una funcionalidad se considera terminada cuando:
1. Cumple todos sus criterios de aceptación.
2. La lógica de negocio está cubierta por pruebas unitarias en la capa de dominio.
3. El flujo crítico correspondiente tiene una prueba end-to-end.
4. Es operable en móvil (360 px) y escritorio.
5. Los estados de carga, vacío y error están diseñados e implementados.
6. Los textos visibles están en español de Colombia.
7. No introduce dependencias de infraestructura en la capa de dominio.

---

## 7. Métricas y analítica

| Métrica | Definición | Objetivo |
|---|---|---|
| Conversión global | Pedidos pagados / sesiones únicas | ≥ 1.5 % |
| Conversión de checkout | Pedidos pagados / checkouts iniciados | ≥ 65 % |
| Abandono de carrito | 1 − (checkouts iniciados / carritos con ítems) | ≤ 60 % |
| Ticket promedio | Ingresos / pedidos pagados | Seguimiento |
| Tasa de fallo de guía | Guías en estado fallido / pedidos pagados con envío | ≤ 2 % |
| Tasa de fallo de email | Emails fallidos / emails encolados | ≤ 1 % |
| Precisión de inventario | Pedidos cancelados por stock / pedidos pagados | ≤ 1 % |

---

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Caída de la pasarela de pago principal | Bloqueo total de ventas | Pasarela de respaldo conmutable desde el panel + COD |
| Webhook de pago nunca llega | Pedido pagado sin confirmar | Job de reconciliación que consulta el estado en la pasarela |
| Sobreventa por concurrencia | Pedido sin stock real | Decremento atómico a nivel de base de datos, no lectura-modificación-escritura |
| Contenedor reiniciado a mitad de encolado | Pedido atascado en "procesando" | Sweeper que libera filas bloqueadas tras un umbral de tiempo |
| Operador logístico rechaza la dirección | Pedido sin despachar | Registro de excepción de envío + flujo de resolución en el panel |
| Agotamiento del pool de conexiones a BD | Errores 500 intermitentes | Cliente de base de datos singleton + caché agresiva en lecturas |
| Datos fiscales incorrectos | Imposibilidad de facturar | Validación de tipo/número de documento en el checkout |

---

## 9. Roadmap sugerido

| Fase | Duración estimada | Entregable |
|---|---|---|
| **Fase 0 — Cimientos** | 2 semanas | Monorepo, modelo de datos, capa de dominio, autenticación |
| **Fase 1 — Catálogo** | 3 semanas | Home, catálogo, ficha de producto, carrito, panel de productos y categorías |
| **Fase 2 — Transacción** | 3 semanas | Checkout, pasarela principal, webhooks, stock, emails, historial de pedidos |
| **Fase 3 — Logística** | 2 semanas | Cotización de flete, colas de guías, webhooks del operador, seguimiento |
| **Fase 4 — Operación** | 2 semanas | Dashboard, sincronización de stock, cupones, banners, configuración |
| **Fase 5 — Endurecimiento** | 2 semanas | Observabilidad, SEO, rendimiento, cobertura de pruebas, reconciliación |
