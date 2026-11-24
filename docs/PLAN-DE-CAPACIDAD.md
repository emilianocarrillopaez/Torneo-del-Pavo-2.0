# Plan de Capacidad y Presupuesto Gratuito — Torneo del Pavo 2.0

Este documento estima el consumo de recursos frente a las cuotas gratuitas vigentes de **Cloudflare Pages (Free)**, **Firebase Spark (gratuito)** y **Google Cloud reCAPTCHA Enterprise (gratuito)**.

> **Fecha de verificación en documentación oficial:** **24 de noviembre de 2026**
> - Cloudflare Pages Free (`developers.cloudflare.com/pages/platform/limits`)
> - Firebase Spark Free (`firebase.google.com/docs/firestore/quotas`)
> - reCAPTCHA Enterprise Free (`cloud.google.com/recaptcha/pricing`)

---

## 1. Cuotas gratuitas vigentes verificadas

| Servicio / Recurso | Límite del plan gratuito | Comportamiento si se excede |
| --- | --- | --- |
| **Cloudflare Pages — Ancho de banda** | **Ilimitado** | Sin cargo ni corte por transferencia estática |
| **Cloudflare Pages — Solicitudes HTTP** | **Ilimitadas** (sitio estático) | Sin cargo por tráfico |
| **Cloudflare Pages — Compilaciones (*builds*)** | **500 builds/mes** (nivel cuenta, 1 simultáneo, máx. 20 min) | Se bloquean nuevos despliegues hasta el siguiente ciclo mensual |
| **Cloudflare Pages — Archivos y tamaño** | **20,000 archivos/sitio** · **25 MiB máx. por archivo** | Falla el despliegue si se supera |
| **Cloudflare Pages — `_headers`** | **100 reglas máx.** · **2,000 caracteres máx. por línea** | Cloudflare ignora/rechaza reglas fuera de límite |
| **Firebase Spark — Lecturas Firestore** | **50,000 lecturas / día** (reinicio 00:00 PT) | Devuelve `RESOURCE_EXHAUSTED` ($0 de cargo) |
| **Firebase Spark — Escrituras Firestore** | **20,000 escrituras / día** | Devuelve `RESOURCE_EXHAUSTED` ($0 de cargo) |
| **Firebase Spark — Eliminaciones Firestore** | **20,000 borrados / día** | Devuelve `RESOURCE_EXHAUSTED` ($0 de cargo) |
| **Firebase Spark — Almacenamiento Firestore** | **1 GiB** · **10 GiB/mes** de salida de red (*egress*) | Bloqueo al llenar ($0 de cargo) |
| **reCAPTCHA Enterprise (App Check)** | **10,000 evaluaciones / mes calendario** | HTTP 429 en nuevas verificaciones ($0 de cargo en capa gratuita) |

---

## 2. Consumo real medido y estimado del Torneo del Pavo 2.0

### A. Peso de la página (medido en build de producción `vite build`)
- **Tamaño total de `dist/`:** **4.3 MB** (12 archivos estáticos en total vs. límite de 20,000; el archivo mayor es `exceljs.min` con `929.38 kB` sin comprimir, muy por debajo de 25 MiB).
- **Carga inicial de un visitante en `/` (con caché fría):**
  - `index.html`: `4.70 kB` (`1.59 kB` gzip)
  - Hoja CSS principal: `98.07 kB` (`13.66 kB` gzip)
  - Bundle JS inicial: `1,480.32 kB` (`428.11 kB` gzip) + runtime `1.30 kB` (`0.71 kB` gzip)
  - Total código inicial comprimido: **~444 kB gzip** (más imágenes hero/patrocinadores visibles en WebP/PNG).
- **Carga diferida (*lazy-loaded*):** `AdminPanel` (`173.11 kB` / `29.81 kB` gzip), `jspdf` (`399.68 kB` / `129.91 kB` gzip), `html2canvas` (`199.40 kB` / `46.74 kB` gzip) y `exceljs` (`929.38 kB` / `256.38 kB` gzip) **no** se descargan al abrir la convocatoria ni el formulario.
- **Archivo `_headers` generado:** **9 reglas** (límite: 100) y línea más larga de **~812 caracteres** (límite: 2,000), validado automáticamente en cada compilación.

### B. Lecturas y escrituras en Cloud Firestore por operación
| Acción | Lecturas estimadas | Escrituras estimadas | Notas de optimización implementadas |
| --- | --- | --- | --- |
| **Visita a la página principal (`/`)** | **1 + N patrocinadores + 1 conteo** (~10–15 lecturas) | 0 | `getCountFromServer` cobra 1 lectura por cada 1,000 documentos indexados (≈ 1 lectura total para 100 inscritos). |
| **Visita al padrón público (`/participantes` con 100 inscritos)** | **100 lecturas iniciales** (1 por doc) + deltas mientras la pestaña está visible | 0 | Listener único compartido, consulta acotada a 500 docs (`limit(500)`), pausa automática cuando la pestaña pasa a segundo plano (`visibilitychange`) y caché breve en memoria (60 s). |
| **Envío de 1 inscripción válida** | 0 adicionales desde UI (las reglas consumen lecturas internas no facturadas aparte de la regla normal; consultar cuota Spark) | **5 documentos** (`/comprobantes`, `/participantes`, `/participantes_publicos`, 2 en `/registro_llaves`) | Escritura atómica única (`writeBatch`). |
| **Ingreso a Lista de espera** | 0–1 | **1 documento** (`/lista_espera/{sha256}`) | ID determinista evita registros repetidos del mismo correo. |
| **Operaciones admin (100 inscritos)** | ~100 (`participantes`) + N (`lista_espera`) + 1 por visor de recibo | Fragmentado en lotes seguros (4 a 10 docs por lote) | Respeta límite estricto de 20 accesos de reglas por lote. |

### C. Margen frente a los límites gratuitos (escenario esperado vs. pico)

Escenario esperado para un torneo regional de **100 plazas** en Durango:
- **Tráfico diario normal (campaña de 3 semanas):** 150 visitas/día a `/` + 60 visitas/día al padrón + 10 inscripciones/día.
  - **Lecturas/día:** `(150 × 12) + (60 × 100)` ≈ **7,800 lecturas/día** → **~15.6%** del límite de 50,000 (**84.4% de margen libre**).
  - **Escrituras/día:** `10 × 5` = **50 escrituras/día** → **0.25%** del límite de 20,000.
- **Día pico (cierre de inscripciones / día previo al torneo):** 300 visitas/día a `/` + 200 visitas/día al padrón + 30 inscripciones.
  - **Lecturas/día:** `(300 × 12) + (200 × 100)` ≈ **23,600 lecturas/día** → **~47.2%** del límite de 50,000 (**52.8% de margen libre**).
  - **Escrituras/día:** `30 × 5` = **150 escrituras/día** → **0.75%** del límite de 20,000.
- **Almacenamiento total (100 inscritos + 100 comprobantes comprimidos):**
  - Promedio ~250 KB/comprobante × 100 ≈ **25 MB** + ~1 MB datos/patrocinadores ≈ **26 MB** → **2.5%** de 1 GiB (**~97% de margen libre**).
- **Evaluaciones de reCAPTCHA Enterprise:** ~1 evaluación por sesión/formulario (~3,000–5,000 al mes) → **30–50%** de las 10,000 evaluaciones mensuales gratuitas.
- **Cloudflare Pages builds/mes:** ~10–25 despliegues en temporada → **< 5%** de los 500 builds/mes.

---

## 3. Qué monitorear y qué hacer si te acercas al límite

1. **Dónde vigilar cada semana (5 minutos):**
   - **Firebase Console → Build → Firestore Database → Usage:** revisa el gráfico de **Reads** y **Writes** diarios. Si ves un salto arriba de **35,000 lecturas/día**, revisa si hay tráfico anormal o recargas masivas.
   - **Firebase Console → App Check → Metrics:** confirma tráfico **Verified** alto y vigila picos de tráfico **Unverified** (posible bot).
   - **Cloudflare Dashboard → Workers & Pages → `torneo-del-pavo` → Analytics & Deployments:** revisa errores de build y solicitudes bloqueadas.
2. **Acciones rápidas sin gastar dinero si se acerca la cuota de 50,000 lecturas/día:**
   - **Paso 1:** Comparte en WhatsApp y redes el **PDF oficial de inscritos** generado desde `/admin`, pidiendo a los jugadores consultar ese archivo en lugar de refrescar `/participantes` repetidamente.
   - **Paso 2:** Si estás a horas de iniciar el torneo (`D-0`) y necesitas conservar lecturas solo para la mesa de arbitraje, cierra inscripciones (**Inscripciones Cerradas**), descarga **Respaldo JSON**, **Excel** y **Suizo** y opera el check-in y las rondas localmente.
   - **Paso 3:** Si ya concluyó el torneo y no se usará el padrón en tiempo real, cierra inscripciones y evita difundir el enlace de consulta en vivo. *(La cuota de Firebase Spark se reinicia automáticamente a la medianoche hora del Pacífico).*
