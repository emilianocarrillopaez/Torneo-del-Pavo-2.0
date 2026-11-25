# Despliegue en Cloudflare Pages — Torneo del Pavo 2.0

El sitio web estático se publica en **Cloudflare Pages** (plan gratuito). La base de datos (Cloud Firestore), la autenticación con Google y App Check permanecen en **Firebase** (plan gratuito Spark, proyecto `yogic-decoder-5lxdt`, base con nombre `ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2`).

---

## 1. Configuración inicial paso a paso en el panel de Cloudflare

Sigue estos pasos en el orden exacto:

1. **Crear cuenta gratuita:** entra a [dash.cloudflare.com](https://dash.cloudflare.com/) y regístrate o inicia sesión en el plan **Free**.
2. **Conectar el repositorio Git:**
   - En el menú izquierdo ve a **Workers & Pages → Crear → Pages → Conectar a Git** (*Connect to Git*).
   - Autoriza tu cuenta de GitHub limitando el acceso **únicamente** al repositorio del torneo (se recomienda mantener el repositorio como **privado**).
3. **Configurar la compilación (*Build settings*):**
   - **Nombre del proyecto:** `torneo-del-pavo` (define la URL base `https://torneo-del-pavo.pages.dev`).
   - **Rama de producción (*Production branch*):** `main`
   - **Build system version:** selecciona **Version 3 (v3)** en la configuración del proyecto para garantizar compatibilidad con versiones fijadas de Node y Bun.
   - **Comando de compilación (*Build command*):**
     ```bash
     bun install --frozen-lockfile && bun run build
     ```
   - **Directorio de salida (*Build output directory*):** `dist`
   - **Directorio raíz (*Root directory*):** `/` (déjalo vacío o `/`)
   - *Nota sobre gestor de paquetes:* este repositorio usa exclusivamente **`bun.lock`** (formato texto de Bun 1.4.4, sin `package-lock.json`) y Node **`22.23.5`** (`.node-version`). Es obligatorio fijar `BUN_VERSION=1.4.4` (igual que en `.github/workflows/ci.yml`) porque la versión por defecto de Bun en Cloudflare Pages puede ser anterior y no entender este formato de `bun.lock`.
4. **Variables de entorno (*Environment variables*) — por separado:**
   Configura dos bloques distintos dentro de **Settings → Environment variables**:

   **Entorno Production (rama `main`):**
   | Variable | Valor exacto |
   | --- | --- |
   | `NODE_VERSION` | `22.23.5` |
   | `BUN_VERSION` | `1.4.4` |
   | `VITE_APP_ENV` | `production` |
   | `VITE_SITE_URL` | `https://torneo-del-pavo.pages.dev` *(en el primer despliegue; actualízalo en el paso 5 si cambia)* |
   | `STRICT_SITE_URL` | `1` *(opcional en Pages, obligatorio si quieres abortar cualquier build sin URL)* |
   | `VITE_RECAPTCHA_SITE_KEY` | *(Site Key de reCAPTCHA Enterprise cuando esté lista)* |

   **Entorno Preview (cualquier otra rama o Pull Request):**
   | Variable | Valor exacto |
   | --- | --- |
   | `NODE_VERSION` | `22.23.5` |
   | `BUN_VERSION` | `1.4.4` |
   | `VITE_APP_ENV` | `staging` |
   | `VITE_SITE_URL` | `https://torneo-del-pavo.pages.dev` *(o la URL `*.pages.dev` de vista previa si difiere)* |
   | `VITE_FIREBASE_STAGING_PROJECT_ID` | *(ID del proyecto Firebase de pruebas/staging, si aplica)* |
   | `VITE_FIREBASE_STAGING_API_KEY` | *(API Key Web del proyecto staging)* |
   | `VITE_FIREBASE_STAGING_AUTH_DOMAIN` | *(ej. `<staging-project>.firebaseapp.com`)* |
   | `VITE_FIREBASE_STAGING_APP_ID` | *(App ID del proyecto staging)* |
   | `VITE_FIREBASE_STAGING_DATABASE_ID` | *(ej. `(default)` o ID de base en staging)* |

5. **Primera publicación y actualización de URL:**
   - Haz clic en **Save and Deploy**.
   - Confirma que la URL pública asignada sea `https://torneo-del-pavo.pages.dev` (o anota el subdominio exacto si Cloudflare asignó uno alterno).
   - Si la URL asignada difiere, ve a **Settings → Environment variables → Production**, edita **`VITE_SITE_URL`** con esa URL exacta (sin `/` al final) y ejecuta **Retry deployment** para que `index.html`, JSON-LD, `robots.txt` y `sitemap.xml` apunten al dominio definitivo.
6. **(Opcional) Dominio propio:**
   - Registra el dominio o apunta sus DNS a Cloudflare.
   - En el proyecto de Pages ve a **Custom domains → Set up a custom domain**, escribe tu dominio propio y espera el certificado SSL activo.
   - Actualiza **`VITE_SITE_URL`** con tu dominio propio `https://...`, vuelve a desplegar y actualiza los dominios autorizados en Firebase Auth, reCAPTCHA Enterprise y la restricción HTTP de la API Key (ver [`PASOS-MANUALES.md`](PASOS-MANUALES.md)).
7. **Comprobar ramas y vistas previas:**
   - Crea una rama de prueba o Pull Request, verifica que Cloudflare genere una URL de **Preview** sin modificar producción, y comprueba que **Production** solo cambia al fusionar a `main`.

---

## 2. Protección de la rama principal en GitHub (recomendado)

Como la integración Git de Cloudflare Pages publica cualquier cambio que llegue a `main`, la barrera de calidad es exigir en GitHub que el flujo de CI pase antes de fusionar:

1. Entra en GitHub a **Settings → Branches → Add branch protection rule** (o **Rules → Rulesets**).
2. **Branch name pattern:** `main`
3. Marca **Require a pull request before merging**.
4. Marca **Require status checks to pass before merging** y selecciona los trabajos del workflow `CI - Calidad y Seguridad`:
   - `Calidad, Unitarias y Build`
   - `Pruebas de Reglas Firestore (Emulador)`
   - `E2E y Accesibilidad (Playwright + Emulador)`
5. Marca **Do not allow bypassing the above settings** (opcional pero recomendable) y guarda.

---

## 3. Modo alterno de despliegue (condicionado al CI)

El modo recomendado para este torneo es la **integración Git nativa** (sección 1) porque no requiere guardar tokens de Cloudflare en GitHub.

Si más adelante el comité prefiere que GitHub Actions publique manualmente a Cloudflare Pages **solo después de que todas las pruebas pasen**:

1. Crea un API Token en Cloudflare (**My Profile → API Tokens → Create Custom Token**) con el permiso mínimo:
   - **Account → Cloudflare Pages → Edit** (ningún otro permiso).
2. En GitHub **Settings → Secrets and variables → Actions**, agrega:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Desactiva los despliegues automáticos desde Git en Cloudflare Pages y agrega un trabajo final `deploy` que ejecute únicamente en `main` tras `needs: [quality-and-build, rules-emulator, e2e-emulator]`:
   ```bash
   npx wrangler pages deploy dist --project-name=torneo-del-pavo --branch=main
   ```

*(Las reglas de Firestore siempre se despliegan por separado con `bunx --no-install firebase deploy --only firestore:rules,firestore:indexes --project yogic-decoder-5lxdt` desde una sesión autorizada.)*

---

## 4. Cómo revertir una publicación defectuosa (menos de 5 minutos)

Si una actualización en `main` rompe la página o muestra un error tras publicarse:

1. Entra al panel de Cloudflare → **Workers & Pages → `torneo-del-pavo` → Deployments**.
2. Busca el despliegue inmediatamente anterior que funcionaba bien (estado *Success*).
3. Haz clic en el botón de tres puntos **`⋯`** a la derecha de ese despliegue y elige **Rollback to this deployment** (*Revertir a este despliegue*).
4. Confirma. En menos de 60 segundos Cloudflare vuelve a servir los archivos estáticos de la versión anterior sin tocar tus datos de Firestore.

---

## 5. Plan B: Workers Static Assets (solo documentado, no implementado)

Cloudflare recomienda *Workers Static Assets* para proyectos nuevos, aunque Pages sigue plenamente vigente. Gracias a que este proyecto ya genera `dist/_headers` y no crea `dist/404.html`, migrar a Workers en el futuro es trivial y **no requiere cambiar ni `_headers` ni `_redirects`**.

Si algún día decides migrar, crea en la raíz del proyecto un archivo `wrangler.jsonc` equivalente:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "torneo-del-pavo",
  "compatibility_date": "2026-11-24",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

Y cambia el comando de despliegue a `npx wrangler deploy`.

---

## 6. Solución de problemas comunes

| Problema | Causa probable | Solución |
| --- | --- | --- |
| **El build falla buscando `package-lock.json` o `npm ci` o al leer `bun.lock`** | Cloudflare usó `npm` o una versión antigua de Bun sin Build system v3. | Confirma **Build system version: v3**, **Build command** `bun install --frozen-lockfile && bun run build`, `BUN_VERSION=1.4.4` y `NODE_VERSION=22.23.5`. |
| **El build falla con error `VITE_SITE_URL no está definida`** | Faltó definir `VITE_SITE_URL` en el entorno (Production o Preview). | Agrega `VITE_SITE_URL=https://torneo-del-pavo.pages.dev` en **Settings → Environment variables** y reintenta el despliegue. |
| **Error 404 al recargar `/admin` o `/participantes`** | Alguien agregó un archivo `public/404.html` o una regla conflictiva en `_redirects`. | Confirma que **no existe** `dist/404.html` ni regla `/* /index.html 200` en `_redirects`. Pages aplica modo SPA automáticamente sin `404.html`. |
| **La ventana emergente de Google Sign-In no abre o se cierra sola** | Falta el dominio nuevo en Firebase Auth, o se activó `Cross-Origin-Opener-Policy: same-origin`. | Agrega el dominio exacto en **Firebase Console → Authentication → Authorized domains** y verifica en `curl -I` que NO exista cabecera `Cross-Origin-Opener-Policy: same-origin`. |
| **La consola del navegador reporta un recurso bloqueado por CSP** | Un dominio legítimo nuevo (ej. otro CDN o subdominio de reCAPTCHA) no está permitido en `scripts/security-headers.mjs`. | Revisa el error exacto en DevTools → Console, verifica que el origen sea oficial de Google/Firebase y añádelo únicamente en `scripts/security-headers.mjs` (fuente única de verdad). |
| **Los datos de Firebase apuntan a producción en una Preview** | Faltan las variables `VITE_FIREBASE_STAGING_*` en el entorno Preview o `VITE_APP_ENV` no vale `staging`. | Revisa las variables del entorno **Preview** en Cloudflare Pages. |
