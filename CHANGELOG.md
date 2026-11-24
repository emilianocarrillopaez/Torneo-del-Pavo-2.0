# Historial de Cambios — Torneo del Pavo 2.0

## Parte 3 (FINAL) — Migración a Cloudflare Pages, Cierre de Riesgos y Operación
- **Migración de hosting a Cloudflare Pages:**
  - Eliminada la sección `hosting` de `firebase.json` (se conservan únicamente `firestore` en la base con nombre `ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2` y bloque `emulators`).
  - Creada una sola fuente de verdad para cabeceras HTTP y CSP en `scripts/security-headers.mjs`, consumida por `scripts/generate-seo-files.mjs` (`public/_headers`) y `vite.config.ts` (`vite preview`).
  - Centralizada la URL pública con `VITE_SITE_URL` en `index.html`, `src/App.tsx` (JSON-LD `SportsEvent`), `public/robots.txt` y `public/sitemap.xml`, fallando la compilación de producción si falta la variable.
  - Fijado `.node-version` (`22.23.5`) y soporte multi-entorno `VITE_APP_ENV` (`production` | `staging`) + `.firebaserc` en `src/lib/firebase.ts`.
- **Cierre de riesgos Fase 5.0 (3.1–3.6):**
  - Unificado el ensamblado de nombre privado y nombre enmascarado público en `buildParticipantNames` (`src/utils/tournamentUtils.ts`) y ampliadas las reglas de Firestore a propiedades Unicode de letra (`\p{L}`).
  - ID determinista SHA-256 en `/lista_espera`, validación de tutor para menores y botón admin **«Vaciar convertidos / antiguos»**.
  - Operaciones en lote fragmentadas (`SAFE_ADMIN_BATCH_SIZE = 10`, `SAFE_ADMIN_PAIR_BATCH_SIZE = 8`, `SAFE_ADMIN_MULTI_OP_BATCH_SIZE = 4`) con indicador de progreso en el panel admin.
  - Listener del padrón público optimizado con pausa al ocultar pestaña (`visibilitychange`), caché de sesión de 60 s y límite de 500 documentos.
- **Pruebas, CI/CD y Documentación:**
  - Pipeline en `.github/workflows/ci.yml` con Java 17 para correr `npm run test:rules` (34 vectores `V1–V34`), auditoría de dependencias, Playwright E2E + `axe-core` (`tests/e2e/app.spec.ts`) y Lighthouse CI (`lighthouserc.json`), más `dependabot.yml`.
  - Scripts `seed:emulator`, `loadtest:emulator` y `docker-compose.yml`.
  - Documentación completa para operación y lanzamiento (`README.md`, `SECURITY.md`, `docs/DESPLIEGUE-CLOUDFLARE.md`, `docs/GUIA-ADMIN.md`, `docs/PLAN-DE-CAPACIDAD.md`, `docs/PRUEBA-DE-HUMO.md`, `docs/LANZAMIENTO-CHECKLIST.md`, `docs/RUNBOOK-INCIDENTES.md`, `docs/PASOS-MANUALES.md`, `docs/AUDITORIA.md`).

---

## Parte 2 — Regresiones R1–R7, Calidad y Mejoras Operativas
- Cierre de regresiones de reglas R1–R7 (enlace atómico 1:1 participante-comprobante-llaves, validación de nombre público, coherencia de edad en Juvenil, anonimización/purga compatible, reducción de lecturas `getConfig`).
- 32 vectores de prueba automatizados en `tests/rules/firestore.rules.test.ts` y pruebas unitarias en `src/utils/tournamentUtils.test.ts`.
- Refactorización modular (`hooks/`, `utils/`, `admin/*`), carga diferida de `AdminPanel`, `jsPDF` y `ExcelJS`, imágenes WebP y soporte de lista de espera, check-in, papelera, exportación Suizo y detección de posibles duplicados.

---

## Parte 1 — Endurecimiento Inicial de Seguridad y Privacidad
- Separación estricta entre `/participantes` (solo admin), `/participantes_publicos` (padrón sanitizado) y `/comprobantes` (bóveda privada).
- Autenticación administrativa sin correos hardcodeados (`/admins`, `/admins_by_email`) con Google Sign-In verificado y cierre por inactividad (30 min).
- Prevención de duplicados mediante `/registro_llaves` SHA-256 sin lectura pública, bloqueo automático ante datos de pago de ejemplo, validación de bytes mágicos y visor de recibos en `iframe sandbox`.
