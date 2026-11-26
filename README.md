# Torneo del Pavo 2.0 — Club de Ajedrez Don Gonzalo

Plataforma oficial de convocatoria, inscripción con comprobante de pago, padrón público protegido y panel administrativo para el **Torneo del Pavo 2.0** (sábado **19 de diciembre de 2026, 16:30 hrs**, Corredor Constitución, Durango, Dgo.).

---

## Arquitectura y Hosting

- **Frontend estático y CDN:** **Cloudflare Workers (Static Assets)** (plan gratuito, `wrangler.jsonc`). No se usa Firebase Hosting *(el camino alterno con Cloudflare Pages queda solo documentado en `docs/DESPLIEGUE-CLOUDFLARE.md`)*.
- **Backend y seguridad:** **Firebase Spark (plan gratuito)** en el proyecto `yogic-decoder-5lxdt`:
  - **Cloud Firestore** en la **base con nombre** `ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2`.
  - **Firebase Authentication** (solo Google Sign-In con correo verificado para administradores).
  - **Firebase App Check** (reCAPTCHA Enterprise vía `ReCaptchaEnterpriseProvider`).
- **Privacidad del repositorio:** **el repositorio en GitHub debe mantenerse como privado** para proteger la documentación operativa del comité y evitar exponer reglas o configuración interna innecesariamente.
- **Stack:** React 19, Vite 8, TypeScript (`strict: true`), Tailwind CSS 4, ExcelJS, jsPDF.

---

## Requisitos y Convención de Paquetes

- **Node.js:** `22.23.5` (fijado en `.node-version`).
- **Gestor de paquetes:** **Bun `1.4.4`** con **un único lockfile (`bun.lock`)**.
  - Instala siempre con `bun install --frozen-lockfile`.
  - No generes `package-lock.json` ni `yarn.lock`.
- **Java (JRE/JDK 21+):** **no es obligatorio** para el organizador ni para desarrollar la interfaz. Las pruebas de reglas de Firestore corren automáticamente en GitHub Actions (`.github/workflows/ci.yml` con Java 21), y opcionalmente en local con Docker (`docker compose run --rm firestore-tests`).
- **Dependabot:** configurado en `.github/dependabot.yml` (`bun` + `github-actions`, límite de 3 PRs/semana). **No fusiones un pull request de Dependabot si el CI no está en verde, y no aceptes cambios que modifiquen `package.json` sin actualizar `bun.lock`.**

---

## Scripts Disponibles

```bash
# Instalación limpia reproducible (único lockfile bun.lock)
bun install --frozen-lockfile

# Desarrollo local (conectado a configuración configurada en src/lib/firebase.ts)
bun run dev

# Desarrollo local conectado al Emulador de Firestore/Auth (staging)
bun run dev:emulator

# Sembrar ~50 participantes sintéticos, patrocinadores y admin de prueba en el emulador
npm run seed:emulator

# Ensayo de carga (~100 registros consecutivos) contra el emulador
npm run loadtest:emulator

# Compilación de producción (lee site.config.json o VITE_SITE_URL opcional; genera public/_headers, robots.txt y sitemap.xml)
bun run build

# Vista previa local con las mismas cabeceras CSP que Cloudflare Workers (sin HSTS/upgrade en HTTP)
bun run preview

# Calidad, tipos, reglas y pruebas
bun run lint          # tsc --noEmit + eslint
bun run lint:rules    # @firebase/eslint-plugin-security-rules sobre firestore.rules
bun run test          # Pruebas unitarias (incluye cabeceras, Wrangler, Java 21, reportes CI y Unicode)
bun run check:wrangler # Valida wrangler.jsonc y ausencia de dist/404.html
bun run reports:clean # Reinicia localmente la carpeta reports/ (gitignorada)
npm run test:rules    # Pruebas de reglas Firestore en emulador (requiere Java 21+ o Docker)
npm run test:e2e      # Pruebas Playwright + axe-core contra build local y emulador
bun audit --audit-level=high
```

---

## Pruebas Locales con Emulador (sin tocar datos reales)

1. Arranca el emulador de Firestore y Auth (con Java 21+ o usando `docker compose up emulators`):
   ```bash
   bunx --no-install firebase emulators:start --project yogic-decoder-5lxdt --only firestore,auth
   ```
2. En otra terminal, siembra datos sintéticos y levanta la app en modo emulador:
   ```bash
   npm run seed:emulator
   bun run dev:emulator
   ```
   - Usuario admin de prueba en emulador: `admin.torneo@example.test` (en la ventana emergente del emulador Auth).
   - Nunca ejecutes scripts de semilla sobre el proyecto de producción.

---

## Despliegue en Cloudflare Workers y Reglas de Firestore

- **Sitio web (Cloudflare Workers — Static Assets):** se publica automáticamente desde la rama `main` mediante `wrangler.jsonc` (`bun run build` + `npx wrangler deploy`, carpeta `./dist`). Consulta la guía paso a paso en [`docs/DESPLIEGUE-CLOUDFLARE.md`](docs/DESPLIEGUE-CLOUDFLARE.md).
- **Reglas e índices de Firestore (siempre a la base con nombre):**
  ```bash
  bunx --no-install firebase login
  bunx --no-install firebase deploy --only firestore:rules,firestore:indexes --project yogic-decoder-5lxdt
  ```
  El archivo `firebase.json` apunta explícitamente a `"database": "ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2"`. Verifica siempre en *Firebase Console → Firestore → Reglas* que el contenido coincide con `firestore.rules`.

---

## Estructura del Proyecto

- `src/components/`: vistas públicas, formulario (`RegistrationForm`), padrón público (`ParticipantsPage`) y panel admin (`admin/*`).
- `src/hooks/`: `useRegistrationForm`, `useParticipants`, `useFocusTrap`.
- `src/services/tournamentService.ts`: acceso a Firestore, caché en sesión del padrón público y operaciones admin en lotes fragmentados.
- `src/utils/`: validadores puros, cortes de edad dinámicos, magia binaria de comprobantes y exportación segura (`exceljs`, `jspdf`).
- `site.config.json`: URL pública oficial del sitio (`https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev`). La variable `VITE_SITE_URL` es **opcional** (solo sobrescribe este archivo); si algún día cambia la URL, edita `site.config.json` y haz commit.
- `scripts/site-config.mjs`: resolución compartida de URL pública (`VITE_SITE_URL` opcional → `site.config.json` → error en modo estricto si ambas faltan o son inválidas).
- `scripts/security-headers.mjs`: **única fuente de verdad** para CSP y cabeceras HTTP (`public/_headers` y `vite preview`).
- `scripts/generate-seo-files.mjs`: script `prebuild` que genera `public/_headers`, `public/robots.txt` y `public/sitemap.xml` usando `scripts/site-config.mjs`.
- `scripts/ci-report.mjs` y `scripts/cleanup-old-artifacts.mjs`: generación de reportes CI (`reports/`), resúmenes en `$GITHUB_STEP_SUMMARY` y limpieza no incremental de artefactos anteriores.
- `tests/rules/firestore.rules.test.ts`: suite de seguridad (34 vectores `V1–V34`).
- `tests/e2e/app.spec.ts`: flujos Playwright + `axe-core`.
- `docs/`: guías operativas para el comité organizador ([ver índice en `docs/PASOS-MANUALES.md`](docs/PASOS-MANUALES.md) y [guía de reportes CI en `docs/REPORTES-CI.md`](docs/REPORTES-CI.md)).
