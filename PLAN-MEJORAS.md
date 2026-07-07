# Plan de Mejoras — Casa Ahorro

> **Cómo usar este documento:** Este archivo contiene el plan completo de mejoras al catálogo Casa Ahorro. Para ejecutarlo desde una sesión nueva (contexto limpio, ahorra tokens), abre Claude Code en este proyecto y di: _"Lee `PLAN-MEJORAS.md` y ejecútalo completo"_.

---

## ✅ Dominio confirmado

**El dueño ya compró el dominio: `www.casaahorro.cl`**

- Usar `https://www.casaahorro.cl` como URL base en todas las Open Graph tags y en el `og:url`.
- Usar este dominio también en `manifest.json` (`start_url`, `scope`) y en cualquier referencia absoluta.
- Recordatorio operativo: hay que **apuntar el dominio a Vercel** (agregar `casaahorro.cl` y `www.casaahorro.cl` en el panel de Vercel → Settings → Domains, y configurar los DNS del registrador). Esto es config de infraestructura, no de código, pero es necesario para que el dominio y las vistas previas funcionen en producción.

---

## Contexto

El catálogo Casa Ahorro (sitio estático + panel admin que escribe en GitHub vía `/api/admin`) necesita varios bloques de mejoras:

1. **Lenguaje**: hay voseo argentino ("necesitás", "Deslizá", "Agregá", "Intentá", "Creá", "Verificá", "Recargá") con tildes mal puestas. El dueño es chileno y quiere tuteo chileno correcto, sin tildes en letras que no corresponden.
2. **Admin desordenado**: la categoría es un campo de texto libre (propenso a errores tipográficos que crean categorías fantasma). Con ~100 productos, muchos casi idénticos, ingresar productos es lento.
3. **Promociones rígidas**: hoy una promo = un producto aparte con `categoria: "Promo Ahorro"`. El dueño quiere (a) marcar **cualquier** producto individual en oferta con precio rebajado, y (b) una **sección de Packs** aparte donde fotografía y sube packs con su info/precio, que pueda **prender/apagar** a gusto.
4. **Proyecto en general**: como el negocio vive de compartir el link por WhatsApp, hay mejoras de alto impacto (vista previa al compartir, app instalable, orden/filtros, consultar por WhatsApp).
5. **Carrito con entrega**: ahora reciben pedidos para delivery, el carrito debe capturar Delivery vs Retiro en local y avisar al dueño en el mensaje de WhatsApp.

**Objetivo:** catálogo con español chileno correcto, panel de admin rápido y organizado por secciones, sistema de promociones flexible, sitio público más profesional y usable, y carrito con opción de entrega.

**Stack / arquitectura relevante:**
- Sitio estático: `index.html` + `style.css` + `script.js` (Vanilla JS + GSAP + Tailwind CDN).
- Datos: `productos.json` (array de productos).
- Panel admin: `admin.html` (login por password, edita `productos.json` en vivo).
- Backend serverless: `api/admin.js` (Vercel Function; lee/escribe archivos en GitHub vía API; acciones: `verify-auth`, `get-file`, `save-file`, `upload-image`).
- Deploy: Vercel (auto-deploy al hacer push a `master`, ~30s).
- WhatsApp del dueño: `56983020963` (constante `WHATSAPP_NUMBER` en `script.js`).

---

## 1. Corrección de lenguaje (voseo → tuteo chileno)

Reemplazos exactos (imperativos/2ª persona a tuteo, quitando la tilde del voseo). **Nota:** los números de línea son de referencia — verificar el texto real antes de reemplazar, ya que pueden haber cambiado.

| Archivo | Actual | Nuevo |
|---|---|---|
| `index.html` (~L73) | `necesitás` | `necesitas` |
| `index.html` (~L131) | `Deslizá` | `Desliza` |
| `index.html` (~L170) | `Agregá` | `Agrega` |
| `admin.html` (~L1201) | `Intentá de nuevo` | `Intenta de nuevo` |
| `admin.html` (~L1410) | `Verificá` | `Verifica` |
| `admin.html` (~L1615) | `Creá la primera` | `Crea la primera` |
| `admin.html` (~L1862) | `Intentá` | `Intenta` |
| `admin.html` (~L1954) | `Intentá` | `Intenta` |
| `api/admin.js` (~L97) | `Recargá` | `Recarga` |

**Además:**
- Pasada de corrección ortográfica sobre **todo** texto visible nuevo que se agregue en este plan (usar tuteo chileno, evitar tildes incorrectas).
- `importar.html` ya usa imperativos correctos ("Arrastra", "Sube", "haz clic") — solo verificar, no cambiar.
- Verificación final: `grep -iE "necesitás|Deslizá|Agregá|Intentá|Creá|Verificá|Recargá|querés|podés|tenés|decís|hacés|sabés|mirá|fijate|dale\b"` sobre `*.html` y `*.js` debe dar 0 resultados de voseo.

---

## 2. Admin: agrupar por secciones + categoría como lista desplegable

En `admin.html`:

- **Categoría = `<select>`** en lugar de texto libre, tanto al crear como al editar. Se llena con las categorías existentes (derivadas de `productos`, excluyendo "Promo Ahorro") + opción **"➕ Nueva categoría…"** que revela un input de texto para crear una nueva (ej: "Baño").
  - Helper nuevo `buildCategorySelect(valorActual)` reutilizable en filas y en el alta.
  - Al elegir "➕ Nueva categoría…" se muestra un input inline; al escribir y confirmar, se asigna esa categoría al producto y se re-agrupa la tabla.
- **Tabla agrupada por sección**: `renderProductsTable()` agrupa por `categoria` y renderiza un encabezado de sección (`<tr class="section-header">` en desktop / bloque en mobile) antes de cada grupo, con contador de productos. Orden de secciones: las existentes primero, las nuevas al final.
- **Alta de producto**: el nuevo producto respeta la categoría seleccionada; si se está filtrando por una categoría, el nuevo producto nace con esa categoría preseleccionada.
- El `<select id="cat-filter">` del toolbar ya existe y se sigue alimentando con `buildCategoryFilter()`.

**Funciones clave existentes a tocar:** `renderProductsTable()`, `buildProductRow(p)`, `buildCategoryFilter()`, el handler de `btnAddProduct` (alta de producto), y el tracking de cambios (`input.addEventListener('change', ...)` dentro de `buildProductRow`).

---

## 3. Promociones — dos sistemas independientes

### 3a. Promos individuales (NUEVO)

- **Modelo de datos**: agregar a cualquier producto los campos opcionales `enPromocion: true` y `precioPromo: <number>` (precio de oferta).
- **Admin** (`admin.html`, `buildProductRow`): botón toggle 🔥 "Poner en promo" en la celda de acciones (junto a agotado/eliminar). Al activarlo se revela un input pequeño para el **precio de oferta** (`precioPromo`). Al desactivar, se limpian ambos campos (`enPromocion` y `precioPromo`). Reutiliza el patrón del botón `data-agotado` ya existente.
- **Sitio público** (`script.js` `renderProducts` + `style.css`):
  - Card y modal muestran **precio normal tachado** + **precioPromo destacado** + badge **"OFERTA"**. Reusar estilos `.promo-ahorro-price-old` / `.promo-ahorro-price-new` y crear `.oferta-badge`.
  - El carrito y el mensaje de WhatsApp usan `precioPromo` cuando el producto está en promoción. Crear helper `precioEfectivo(prod)` que retorna `prod.enPromocion && prod.precioPromo ? prod.precioPromo : prod.precio`, y usarlo en `getTotal()`, `sendWhatsApp()`, `updateCartUI()`.
  - Chip de filtro **"🔥 Ofertas"** en la barra de categorías que filtra `enPromocion === true` (integra con el punto 5 de orden/filtros).

### 3b. Sección de Packs (reforma del sistema actual, prendible/apagable)

- Los productos con `categoria: "Promo Ahorro"` se mantienen como **Packs**. La pestaña "Promociones" del admin se renombra a **"Packs"** y su tarjeta (`buildPromoCard`) permite subir foto (ya tiene botón de cámara), nombre, descripción y precio.
  - `productosIncluidos` pasa a ser **opcional** (el dueño fotografía el pack físico; ya no es obligatorio vincular productos). No romper packs existentes que ya tengan `productosIncluidos`.
- **Interruptor maestro on/off** de toda la sección de packs:
  - Nuevo archivo **`config.json`** en el repo: `{ "packsActivos": true }`.
  - `api/admin.js`: agregar `config.json` a `ALLOWED_FILES` y permitir contenido **objeto** (hoy `save-file` exige `Array.isArray`); ramificar la validación por nombre de archivo (array para `productos.json`, objeto para `config.json`).
  - Admin: switch (toggle) en la pestaña Packs que lee/escribe `config.json` vía las acciones `get-file` / `save-file`.
  - Público (`script.js` `initCarousel`): además de requerir que existan packs, respeta `packsActivos`. Hacer `fetch('config.json')` al iniciar (fallback `packsActivos: true` si no existe o falla el fetch).

---

## 4. Mejoras del panel de admin

En `admin.html`:

- **Duplicar producto**: botón "clonar" en cada fila → crea copia con id `NEWxxx` (usar el contador `newProductCounter` existente), mismo contenido, insertada tras el original en el array, marcada dirty. Ideal para detergentes que solo cambian de color/aroma.
- **Ajuste masivo de precios**: control (por categoría o global) con input de **%** y botón aplicar → multiplica `precio` (y `precioPromo` si existe) por el factor, redondea a entero, marca dirty los afectados. Confirmación previa (`confirm()`).
- **Reordenar productos**: botones ▲▼ por fila que mueven el producto dentro de su sección reordenando el array `productos` (el orden del array es el que se guarda y el que respeta el catálogo público en `renderProducts`). Persistente al guardar.
- **Estadísticas rápidas** (bonus liviano, ya casi presente en `dash-sub`): mostrar total · agotados · en oferta · packs.

---

## 5. Mejoras del sitio público

- **Vista previa al compartir (Open Graph)** — `index.html` `<head>`:
  - Meta tags: `og:title`, `og:description`, `og:image` (= `logo.png` en **URL absoluta**: `https://www.casaahorro.cl/logo.png`), `og:url` (`https://www.casaahorro.cl`), `og:type` (`website`), `og:site_name`, y equivalentes `twitter:card` (`summary_large_image`), `twitter:title`, `twitter:description`, `twitter:image`.
  - **Dominio confirmado: `https://www.casaahorro.cl`** (ya comprado por el dueño).
  - Sugerencia: para una vista previa más atractiva al compartir, considerar una imagen dedicada tipo banner (ej. `og-image.jpg` 1200×630) en vez del logo pelado. Opcional; si no, usar `logo.png`.
- **App instalable + offline (PWA)**:
  - `manifest.json` (nombre "Casa Ahorro", `short_name`, iconos desde `logo.png` — idealmente 192×192 y 512×512, `theme-color` naranja `#f97316`, `background_color`, `display: standalone`, `start_url: "/"`, `scope: "/"`).
  - `sw.js` (service worker) con caché de `index.html`, `style.css`, `script.js`, `productos.json`, `logo.png` e imágenes visitadas. Estrategia: **cache-first** para estáticos (CSS/JS/logo), **network-first** para `productos.json` y `config.json` (para que los cambios del admin se vean pronto). Versionar el caché (ej. `casa-ahorro-v1`) para poder invalidar.
  - Registro del SW + `<link rel="manifest">` + `apple-touch-icon` + `<meta name="theme-color">` en `index.html`.
- **Ordenar y filtrar** — `index.html` + `script.js`:
  - Control de orden: Precio ↑ / Precio ↓ / (por defecto: orden del catálogo, o sea el orden del array).
  - Chips de filtro: **Ofertas** (`enPromocion`) y **Disponibles** (oculta agotados). Integran con `activeCategory` / `searchQuery` en `renderProducts`.
- **Consultar producto por WhatsApp** — modal de producto en `index.html`:
  - Botón secundario "💬 Consultar" → abre `https://wa.me/56983020963?text=...` con mensaje prellenado: `Hola, quiero info de: <nombre> (<formato>)`. Reusa la constante `WHATSAPP_NUMBER`.

---

## 6. Carrito: tipo de entrega (Delivery / Retiro en local)

Como ahora reciben pedidos para delivery, el carrito debe capturar cómo quiere recibir el cliente y avisárselo claramente al dueño en el mensaje de WhatsApp.

En `index.html` (footer del carrito, tras `cart-totals` y antes del `textarea` de notas / `cartNotes`) + `style.css` + `script.js`:

- **Selector segmentado animado** con dos opciones:
  - **🛵 Delivery** (despacho a domicilio)
  - **🏪 Retiro en local**
- **Animación**: control tipo "segmented control" con un fondo deslizante (highlight naranja que se mueve entre las dos opciones con `transition: transform`), estados hover/active, y micro-animación al seleccionar. Accesible (`role="radiogroup"`, `aria-checked`).
- **Estado**: variable `entregaTipo` (`'delivery'` | `'retiro'`), persistida en `localStorage` junto al carrito (o en su propia clave). Por defecto **Delivery** seleccionado.
- **Campo de dirección contextual**: cuando está en **Delivery**, el `textarea` de notas resalta y su placeholder pasa a "Dirección de entrega + referencias…"; en **Retiro** el placeholder pasa a "Notas para tu pedido (opcional)…". (Opcional: exigir dirección no vacía si es Delivery antes de enviar.)
- **Mensaje de WhatsApp** (`sendWhatsApp` en `script.js`): agregar una línea destacada según el tipo, ubicada bajo el total:
  - `🛵 *ENTREGA: DELIVERY (despacho a domicilio)*`
  - `🏪 *ENTREGA: RETIRO EN LOCAL*`
  - La dirección/notas se mantienen en la sección "📍 Notas / Dirección" que ya existe en el mensaje.

---

## Resumen de cambios al modelo de datos

- **Producto** (en `productos.json`): campos opcionales nuevos `enPromocion` (bool), `precioPromo` (number). Ya existían `agotado` (bool) y `productosIncluidos` (array, ahora opcional en packs).
- **Nuevo `config.json`**: `{ "packsActivos": boolean }`.

## Cambios en la API (`api/admin.js`)

- `ALLOWED_FILES` += `config.json`.
- `save-file`: permitir contenido **objeto** (no solo array) para `config.json`; **mantener** validación `Array.isArray` para `productos.json`.
- Sin cambios en `auth`, `verify-auth`, `get-file` ni `upload-image`.

## Archivos a modificar / crear

- **Modificar:** `index.html`, `script.js`, `style.css`, `admin.html`, `api/admin.js`.
- **Crear:** `manifest.json`, `sw.js`, `config.json`.

---

## Ideas adicionales (opcionales — NO se implementan salvo que el dueño las apruebe)

- **Favoritos** (corazón en cada producto, guardados en localStorage, vista "Mis favoritos").
- **Estado abierto/cerrado** + info de despacho/horario en el hero o footer.
- **Compartir producto individual** (Web Share API nativa del celular).
- **Modo oscuro** automático según el teléfono.
- **Fecha de última actualización** del catálogo visible (da confianza).
- **Aligerar carga**: reemplazar Tailwind CDN (pesado) por CSS propio, ya que casi todo el estilo vive en `style.css`.
- **Costo/zona de delivery**: si el delivery tiene costo o zonas, agregar un campo de zona o un recargo al total (a definir con el dueño).

---

## Verificación (pruebas end-to-end)

1. **Lenguaje**: `grep` de patrones voseo (`necesitás|Deslizá|Agregá|Intentá|Creá|Verificá|Recargá`) debe dar 0 resultados. Revisión visual del hero, carrito y banners del admin.
2. **Admin categorías**: crear producto nuevo → la categoría es un desplegable; probar "➕ Nueva categoría" (ej "Baño") → aparece sección nueva; guardar → el producto queda en esa categoría en el catálogo.
3. **Promos individuales**: marcar un producto en promo con precio de oferta → card muestra precio tachado + oferta + badge; agregar al carrito → total y mensaje WhatsApp usan `precioPromo`.
4. **Packs on/off**: apagar el switch de packs → el carrusel desaparece del sitio; prender → vuelve. Crear un pack con foto/precio y verlo en el carrusel.
5. **Admin mejoras**: duplicar un detergente y editar color; aplicar +10% a una categoría y verificar precios; mover un producto ▲▼ y confirmar el nuevo orden en el catálogo.
6. **Sitio**: compartir el link `https://www.casaahorro.cl` en WhatsApp (o validar con el debugger de OG de Facebook) muestra logo+título; "Agregar a pantalla de inicio" instala la PWA y el catálogo abre sin señal; orden/filtros funcionan; "Consultar" abre WhatsApp con el producto prellenado.
7. **Entrega**: en el carrito, alternar entre Delivery y Retiro anima el selector y cambia el placeholder de notas; enviar el pedido → el mensaje de WhatsApp incluye la línea de entrega correcta (Delivery vs Retiro); la selección persiste al recargar.
8. **Flujo end-to-end**: guardar desde el admin → commit en GitHub → deploy Vercel (~30s) → cambios visibles en producción.

## Notas de ejecución

- **Dominio:** `www.casaahorro.cl` ya comprado. Falta apuntarlo a Vercel (DNS + agregar dominio en el panel de Vercel). Usar `https://www.casaahorro.cl` en OG tags, `manifest.json` y referencias absolutas.
- **Git:** se hará commit + push al finalizar. Antes de push, hacer `git pull --rebase` por si el admin guardó datos (`productos.json` cambia seguido desde el panel); si hay conflicto en `productos.json`, conservar la versión del remoto (los datos en vivo) — como en cambios anteriores.
- **Mensajes de commit:** terminar con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Memoria del proyecto:** al terminar, anotar el cambio en `MEMORY.md` del proyecto (patrón ya usado en cambios anteriores).
