# Auditoría de Seguridad, Privacidad y Operación — Torneo del Pavo 2.0

**Proyecto:** Torneo del Pavo 2.0 (Club de Ajedrez Don Gonzalo, Durango, Dgo.)
**Fecha de corte (Parte 3 — Final):** 2026-11-24
**Proyecto Firebase:** `yogic-decoder-5lxdt`
**Base de datos Firestore:** `ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2`
**Hosting estático definitivo:** **Cloudflare Pages** (plan gratuito). Firebase Hosting quedó retirado de `firebase.json` y guías.

---

## 1. Línea Base y Auditoría de Dependencias (Verificación 3.5)

- **Entorno verificado:** `node v22.23.5` (`.node-version`), `bun 1.4.4`, `firebase-tools 15.36.0`. Único lockfile: `bun.lock`.
- **Java / Emulador en contenedor:** sin Java instalado en este entorno (`java: not found`). Para ejecutar `npm run test:rules` sin instalar Java en la computadora del organizador, se configuró **GitHub Actions (`.github/workflows/ci.yml` con Java 17)** y un respaldo opcional en `docker-compose.yml`.
- **Dependencias instaladas y auditoría (`bun audit`):** **0 vulnerabilidades** conocidas (tras reemplazar `xlsx` por `exceljs`, actualizar `firebase` a `^13.4.0`, fijar `overrides` y añadir `@playwright/test` + `@axe-core/playwright` en `devDependencies`).
- **Calidad de código:** TypeScript `"strict": true`, ESLint con `react-hooks`, `jsx-a11y` y `@firebase/eslint-plugin-security-rules`.

---

## 2. Matriz Consolidada de Hallazgos y Cierre de Riesgos

### Hallazgos Parte 1 y Regresiones Parte 2 (`H1–H21`, `R1–R7`)

| # | Severidad | Resumen técnico | Estado en Parte 3 |
|---|---|---|---|
| **H1** | **CRÍTICO** | Aislamiento PII `/participantes` vs padrón público `/participantes_publicos` con enmascaramiento y sin `edad` exacta de menores. | **Corregido y verificado** (código/lint/build; emulador pendiente de CI) |
| **H2** | **CRÍTICO** | Control de acceso en `/admins` y `/admins_by_email`, `email_verified == true`, Google Sign-In, timeout 30 min. | **Corregido y verificado** |
| **H3** | **ALTO** | Conteo en servidor vía `getCountFromServer` sin escritura pública a `totalInscritos`. | **Corregido y verificado** |
| **H4** | **ALTO** | Magic bytes en recibos, `data:` regex estricta en reglas, visor PDF `iframe sandbox` con Blob URL. | **Corregido y verificado** |
| **H5** | **ALTO** | App Check integrado en `src/lib/firebase.ts` con activación escalonada segura. | **Corregido en código; enforcement pendiente manual en consola** |
| **H6** | **ALTO** | `hasOnly`, validación de formatos/tamaños y denegación por defecto. | **Corregido y desplegado en reglas** |
| **H7** | **ALTO** | Prevención de duplicados con `/registro_llaves` SHA-256 sin lectura pública. | **Corregido y desplegado en reglas** |
| **H8** | **ALTO** | `writeBatch` atómico + `request.time <= fechaLimiteTimestamp`. | **Corregido y desplegado en reglas** |
| **H9** | **MEDIO** | Folios con `crypto.getRandomValues` (`PAVO-XXXXXX` / `ESPERA-XXXXXX`). | **Corregido y verificado (pruebas unitarias)** |
| **H10** | **MEDIO** | `exceljs` bajo demanda + `sanitizeSpreadsheetCell` contra inyección de fórmulas. | **Corregido y verificado (pruebas unitarias)** |
| **H11** | **MEDIO** | Validación `safeHttpUrl` (`https://` / `#`) y `formatWhatsAppUrl`. | **Corregido y verificado (pruebas unitarias)** |
| **H12** | **MEDIO** | Base con nombre en `firebase.json` y retiro total de sección `hosting` para migrar a Cloudflare Pages. | **Corregido y verificado** |
| **H13** | **MEDIO** | Aviso de Privacidad, consentimiento explícito y autorización obligatoria de tutor para menores. | **Corregido y verificado** |
| **H14** | **MEDIO** | Eliminación de credenciales bancarias del código + bloqueo automático si siguen datos de ejemplo. | **Corregido y verificado** |
| **H15** | **MEDIO** | Sincronización de `security_spec.md` y `firebase-blueprint.json` con `firestore.rules`. | **Corregido y verificado** |
| **H16** | **MEDIO** | Parsing seguro de `#admin-recibo=` y `<ErrorBoundary>`. | **Corregido y verificado** |
| **H17** | **BAJO** | Eliminado seed en visitas públicas; acción solo-admin en *Convocatoria*. | **Corregido y verificado** |
| **H18** | **BAJO** | Cortes de edad dinámicos `deriveAgeCutoffs(fechaIso)` sincronizados con Firestore. | **Corregido y verificado** |
| **H19** | **BAJO** | Único `bun.lock`, auditoría limpia y scripts actualizados. | **Corregido y verificado** |
| **H20** | **BAJO** | Imágenes WebP, `AdminPanel`/exportadores lazy, `VITE_SITE_URL` dinámico en SEO/JSON-LD. | **Corregido y verificado** |
| **H21** | **ALTO** | Mensajes de error amigables en español sin filtrar rutas ni UIDs (`errorMessages.ts`). | **Corregido y verificado** |
| **R1–R7** | **CRÍTICO/ALTO/MEDIO** | Liga atómica 1:1 participante-comprobante-llave, filtro de nombre público, coherencia Juvenil, compatibilidad de purga/anonimización y optimización de `getConfig()`. | **Desplegado a base con nombre** (`V1–V34` listos para CI) |

### Cierre de Riesgos Parte 3 (Fase 5.0: 3.1–3.6)

| Punto | Riesgo atendido | Acción implementada | Estado |
|---|---|---|---|
| **3.1** | Coincidencia nombre privado vs. público (`validatePublicRosterMatch`) y acentos/partículas/apóstrofos/diéresis. | `buildParticipantNames` como función única compartida + ampliación de `firestore.rules` a Unicode `\p{L}` (desplegado y compilado en servidor) + pruebas unitarias y `V33`. | **Corregido y desplegado; unitarias aprobadas; V33 listo para CI** |
| **3.2** | Relleno o duplicados en `/lista_espera`. | ID determinista SHA-256 (`waitlist:${correo}`) validado en cliente y `firestore.rules` (`^[a-f0-9]{64}$`), botón **«Vaciar convertidos / antiguos»** en admin y prueba `V32`. | **Corregido y desplegado; V32 listo para CI** |
| **3.3** | Límite de accesos/operaciones de reglas en lotes administrativos. | Fragmentación configurable (`SAFE_ADMIN_BATCH_SIZE = 10`, `SAFE_ADMIN_PAIR_BATCH_SIZE = 8`, `SAFE_ADMIN_MULTI_OP_BATCH_SIZE = 4`) con progreso visible («Procesados X de Y...») + prueba `V34` (10, 25, 50, 100). | **Corregido en código; V34 listo para CI** |
| **3.4** | Verificación real de reglas desplegadas en la base con nombre. | Reglas desplegadas con `DeployRules` sobre la base con nombre y paso manual obligatorio documentado en `docs/PASOS-MANUALES.md`. | **Desplegado; verificación visual en consola queda como paso manual** |
| **3.5** | Reproducibilidad de instalación desde cero y versiones. | Prueba en directorio limpio con `bun install --frozen-lockfile`, único `bun.lock` y `bun audit --audit-level=high`. | **Verificado** |
| **3.6** | Consumo de lecturas de Firestore en padrón público (plan Spark). | Listener único compartido, límite de 500 docs, caché de sesión de 60 s y pausa automática cuando la pestaña está oculta (`visibilitychange`). | **Corregido y verificado en código** |

---

## 3. Seguridad HTTP, CSP y Cloudflare Pages

- **Única fuente de verdad:** `scripts/security-headers.mjs` genera `public/_headers` (en `prebuild` → `dist/_headers`) e inyecta exactamente la misma política base en `vite preview` (`vite.config.ts`).
- **Reglas clave verificadas:**
  - Sin `Cross-Origin-Opener-Policy: same-origin` (preserva *popup* de Google Auth).
  - Sin `unsafe-inline` ni `unsafe-eval` en `script-src`.
  - Sin `public/404.html` ni catch-all `/* /index.html 200` en `_redirects`, garantizando que Cloudflare Pages resuelva `/admin` y `/participantes` sin 404 al recargar.
  - `Strict-Transport-Security` y `upgrade-insecure-requests` activos únicamente en producción HTTPS (`dist/_headers`), evitando fallos de carga sobre HTTP local (`vite preview`).
