# Despliegue en Cloudflare Workers (Static Assets) — Torneo del Pavo 2.0

El sitio web estático se publica en **Cloudflare Workers con Static Assets** (plan gratuito), configurado mediante `wrangler.jsonc` en la raíz del repositorio. La base de datos (**Cloud Firestore**), la autenticación con Google y App Check permanecen en **Firebase** (plan gratuito Spark, proyecto `yogic-decoder-5lxdt`, base con nombre `ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2`).

> *(Si en el futuro el comité prefiere usar **Cloudflare Pages** como camino alterno, está documentado en la sección 6 de este mismo archivo).*

---

## 1. Configuración paso a paso en Cloudflare Workers (camino activo)

Sigue estos pasos en el orden exacto:

1. **Crear o ubicar el Worker y conectar el repositorio privado:**
   - Entra a [dash.cloudflare.com](https://dash.cloudflare.com/) en el plan **Free**.
   - Ve a **Workers & Pages → Crear** (*Create*) o abre tu Worker existente llamado exactamente **`torneo-del-pavo-2-0`**.
   - Conecta tu repositorio **privado** de GitHub limitando el acceso únicamente a este repositorio.
   - **Rama de producción (*Production branch*):** `main`
   - *Validación importante:* el nombre del Worker en Cloudflare debe ser exactamente **`torneo-del-pavo-2-0`** para coincidir letra por letra con `"name": "torneo-del-pavo-2-0"` en `wrangler.jsonc`.

2. **Configurar los comandos de compilación y despliegue (*Build configuration*):**
   - **Build command (Comando de build):**
     ```bash
     bun run build
     ```
     *(Cloudflare instala dependencias usando `bun.lock` y ejecuta `prebuild` → `vite build` generando `./dist` junto con `dist/_headers`, `dist/robots.txt` y `dist/sitemap.xml`).*
   - **Deploy command (Comando de despliegue):**
     ```bash
     npx wrangler deploy
     ```
   - **Root directory (Directorio raíz):** déjalo **vacío** (o `/`).
   - **Archivo `wrangler.jsonc` en la raíz (ya incluido en el repositorio):**
     ```jsonc
     {
       "name": "torneo-del-pavo-2-0",
       "compatibility_date": "2026-11-25",
       "assets": {
         "directory": "./dist",
         "not_found_handling": "single-page-application"
       }
     }
     ```
     `not_found_handling: "single-page-application"` hace que rutas profundas como `/admin` y `/participantes` respondan `index.html` al recargar sin crear `404.html`.

3. **URL pública en `site.config.json` y variables de build (*Build Variables and Secrets*):**
   - La URL pública oficial del sitio **ya vive en `site.config.json`** en la raíz del repositorio:
     ```json
     {
       "siteUrl": "https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev"
     }
     ```
   - Gracias a esto, **el build no depende de `VITE_SITE_URL` en el panel de Cloudflare**. Si algún día cambia la URL oficial (por ejemplo al agregar un dominio propio), simplemente **edita `site.config.json` y haz commit** a `main`.
   - La variable `VITE_SITE_URL` en Cloudflare pasa a ser **opcional** (sirve únicamente para sobrescribir `site.config.json` en un entorno puntual).
   - Entra a **Settings → Build → Build Variables and Secrets** (**NO** en *Runtime Variables*) y configura:

   | Variable | Valor exacto | Obligatoria |
   | --- | --- | --- |
   | `NODE_VERSION` | `22.23.5` | Sí |
   | `BUN_VERSION` | `1.4.4` | Sí |
   | `VITE_APP_ENV` | `production` | Sí |
   | `VITE_SITE_URL` | `https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev` | **Opcional** (solo si quieres sobrescribir `site.config.json`) |

   - *(Opcional cuando ya tengas App Check listo)*: agrega también en *Build Variables and Secrets* la variable `VITE_RECAPTCHA_SITE_KEY` con la Site Key de reCAPTCHA Enterprise.
   - *Nota sobre versiones:* fijar `BUN_VERSION=1.4.4` (igual que `.github/workflows/ci.yml`) y `NODE_VERSION=22.23.5` (`.node-version`) garantiza que Cloudflare lea el formato de texto de `bun.lock` sin fallos.

4. **Advertencia sobre el pull request automático de Cloudflare:**
   - Si en algún momento conectaste un repositorio que aún no tenía `wrangler.jsonc`, Cloudflare puede abrir automáticamente un **Pull Request** en GitHub proponiendo crear/modificar un archivo de configuración de Wrangler.
   - **NO fusiones ese Pull Request** (el repositorio ya incluye `wrangler.jsonc` exacto para Static Assets SPA). Ciérralo directamente.

5. **Configuración obligatoria después del primer despliegue (URL `.workers.dev`):**
   - La URL pública definitiva del Worker es **`https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev`** (visible en **Settings → Domains & Routes**).
   - Agrega el dominio `torneo-del-pavo-2-0.club-don-gonzalo.workers.dev` en los 3 puntos de seguridad (ver detalles en [`docs/PASOS-MANUALES.md`](PASOS-MANUALES.md)):
     1. **Firebase Auth → Settings → Authorized domains**: añade `torneo-del-pavo-2-0.club-don-gonzalo.workers.dev` (**sin** `https://`).
     2. **Google Cloud Console → reCAPTCHA Enterprise**: añade `torneo-del-pavo-2-0.club-don-gonzalo.workers.dev` a tu Site Key.
     3. **Google Cloud Console → APIs & Services → Credentials**: restringe tu API Key Web de navegador al referrer `https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev/*`.
   - **Prueba el login de `/admin`** con tu cuenta autorizada en **Chrome de escritorio** y en un **teléfono celular** (Android Chrome / iPhone Safari).
   - **Importante sobre vistas previas (*Preview URLs*):** las URLs de vista previa generadas por ramas o Pull Requests en Cloudflare tienen otro subdominio y **no están autorizadas** en Firebase Auth, reCAPTCHA ni en las restricciones HTTP de la API Key, por lo que **el login de `/admin` no funciona ahí** (es esperado por seguridad).

6. **(Opcional) Dominio propio:**
   - En tu Worker ve a **Settings → Domains & Routes → + Add → Custom domain**, captura tu dominio propio y espera a que el certificado SSL quede activo.
   - Edita `site.config.json` con el nuevo dominio (con `https://` y sin `/` final), haz commit a `main` y añade ese dominio en Firebase Auth, reCAPTCHA Enterprise y restricción HTTP de la API Key.

---

## 2. Protección de la rama principal en GitHub (recomendado)

Como Cloudflare despliega automáticamente cada cambio que llega a `main`, exige en GitHub que el flujo de CI pase antes de fusionar:

1. Entra en GitHub a **Settings → Branches → Add branch protection rule** (o **Rules → Rulesets**).
2. **Branch name pattern:** `main`
3. Marca **Require a pull request before merging**.
4. Marca **Require status checks to pass before merging** y selecciona los trabajos del workflow `Calidad, Reglas y Seguridad (CI)`:
   - `Lint, Tipos, Unitarias, Auditoría y Build`
   - `Pruebas de Reglas Firestore (Emulador)`
   - `Pruebas E2E (Playwright) y Lighthouse CI`
5. Marca **Do not allow bypassing the above settings** y guarda.

---

## 3. Despliegue manual desde terminal o CI (alternativo)

Si en algún momento necesitas publicar `./dist` directamente con Wrangler (con `CLOUDFLARE_API_TOKEN` con permiso mínimo *Workers Scripts → Edit* y `CLOUDFLARE_ACCOUNT_ID`):

```bash
VITE_APP_ENV=production STRICT_SITE_URL=1 bun run build
bun run check:wrangler
bunx --no-install wrangler deploy
```

*(Las reglas de Firestore siempre se despliegan por separado con `bunx --no-install firebase deploy --only firestore:rules,firestore:indexes --project yogic-decoder-5lxdt` desde una sesión autorizada.)*

---

## 4. Cómo revertir una publicación defectuosa (menos de 5 minutos)

Si una actualización en `main` rompe la página o muestra un error tras publicarse:

1. Entra al panel de Cloudflare → **Workers & Pages → `torneo-del-pavo-2-0` → Deployments** (historial de despliegues).
2. Busca el despliegue inmediatamente anterior que funcionaba bien (estado *Active* / exitoso previo).
3. Haz clic en el botón de opciones (**`⋯`**) a la derecha de ese despliegue y selecciona **Rollback to this deployment** (*Revertir a este despliegue*).
4. Confirma. En menos de 1 minuto Cloudflare vuelve a servir la versión anterior de tus activos estáticos sin tocar los datos en Firestore.

---

## 5. Tabla de errores comunes y solución

| Error / Síntoma | Causa probable | Solución |
| --- | --- | --- |
| **`No se encontró una URL pública válida` o URL inválida** | Se borró/dañó `site.config.json` o la variable opcional `VITE_SITE_URL` tiene `PEGA_AQUI`, `http://` o barra final `/`. | Verifica que `site.config.json` tenga `"siteUrl": "https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev"` (sin `/` final) o corrige/elimina `VITE_SITE_URL` en *Build Variables*. |
| **`Directory "./dist" does not exist`** | Falló `bun run build` antes de ejecutar `npx wrangler deploy`, o el *Build command* está vacío/equivocado. | Revisa el log de compilación arriba del error, confirma **Build command** = `bun run build` y **Root directory** vacío. |
| **El despliegue falla porque el nombre del Worker no coincide** | El Worker en Cloudflare tiene otro nombre distinto de `torneo-del-pavo-2-0`. | Crea/renombra el Worker como `torneo-del-pavo-2-0` o confirma que `"name"` en `wrangler.jsonc` coincide letra por letra con el nombre en el panel de Cloudflare. |
| **Falta `wrangler.jsonc` o ruta `/admin` / `/participantes` da 404** | Se eliminó `wrangler.jsonc`, falta `not_found_handling: "single-page-application"`, o se creó `dist/404.html`. | Ejecuta `bun run check:wrangler`, asegúrate de conservar `wrangler.jsonc` exacto en la raíz y confirma que no existe `public/404.html` ni `dist/404.html`. |
| **Fallo al instalar paquetes por versión de Bun o lockfile** | Cloudflare intentó usar `npm ci` o una versión antigua de Bun incompatible con `bun.lock` en texto. | Verifica en **Settings → Build → Build Variables and Secrets** que `BUN_VERSION=1.4.4` y `NODE_VERSION=22.23.5` estén configuradas. |
| **La consola del navegador reporta recurso bloqueado por CSP** | Un origen legítimo nuevo (ej. subdominio de Firebase/reCAPTCHA) no está listado en `scripts/security-headers.mjs`. | Revisa el origen exacto en DevTools → Console, verifica que sea oficial de Google/Firebase, agrégalo únicamente en `scripts/security-headers.mjs`, recompila (`bun run build`) y despliega. |
| **El login de Google Sign-In no funciona en `/admin`** | Falta `torneo-del-pavo-2-0.club-don-gonzalo.workers.dev` en Firebase Auth → *Authorized domains*, falta el referrer en la API Key, o estás probando en una *Preview URL*. | Prueba siempre desde `https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev` (nunca en *Preview URLs*), agrega el dominio en Firebase Auth y Google Cloud API Key, y confirma que no exista `Cross-Origin-Opener-Policy: same-origin` en `dist/_headers`. |

---

## 6. Camino alterno: Cloudflare Pages (solo referencia, no activo)

Si el comité decidiera en otra edición crear un proyecto clásico de **Cloudflare Pages** en lugar de **Cloudflare Workers (Static Assets)**:
1. En **Workers & Pages → Crear → Pages → Conectar a Git**, selecciona la rama `main`, **Build system version: v3**, **Build command:** `bun install --frozen-lockfile && bun run build`, **Build output directory:** `dist`.
2. Configura las mismas variables (`NODE_VERSION=22.23.5`, `BUN_VERSION=1.4.4`, `VITE_APP_ENV=production` y, opcionalmente si difiere de `site.config.json`, `VITE_SITE_URL`) en *Settings → Environment variables*.
3. Conserva `dist/_headers`, `dist/robots.txt`, `dist/sitemap.xml` y recuerda **no** crear `public/404.html`.
