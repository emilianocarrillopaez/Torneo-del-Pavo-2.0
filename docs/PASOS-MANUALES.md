# Guía de Pasos Manuales (Orden Obligatorio) — Torneo del Pavo 2.0

Esta guía está escrita para el **comité organizador** sin necesidad de conocimientos técnicos. Sigue los pasos **en el orden exacto numerado** para evitar bloqueos en las inscripciones o quedarte sin acceso al panel.

---

## 1. Dar de alta al primer administrador (obligatorio antes de abrir)

El código de la página **no contiene correos ni contraseñas fijas**. Debes autorizar al primer organizador directamente en la Consola de Firebase:

1. Entra a [Firebase Console](https://console.firebase.google.com/) y abre el proyecto **`yogic-decoder-5lxdt`**.
2. En el menú izquierdo ve a **Build → Firestore Database**.
3. En el selector de base de datos (arriba de la tabla), selecciona **`ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2`** (no uses `(default)`).
4. Crea la colección **`admins_by_email`**:
   - Haz clic en **Iniciar colección** (o *+ Agregar documento*).
   - **ID de colección:** `admins_by_email`
   - **ID del documento:** tu correo de Google exacto **en minúsculas** (ejemplo: `tucorreo@gmail.com`).
   - Agrega exactamente estos campos (todos tipo **string**):
     - `email`: `tucorreo@gmail.com` (en minúsculas)
     - `nombre`: `Tu Nombre Completo`
     - `rol`: `Organizador Principal`
   - Guarda el documento.
5. *(Opcional recomendado)* También puedes abrir **Build → Authentication → Users**, copiar tu **User UID** de Google y crear un documento en la colección **`admins`** con ID = ese UID y campos `email`, `nombre`, `rol`.
6. Más adelante, cuando entres a `/admin`, podrás agregar o quitar árbitros y tesoreros desde la pestaña **Accesos Admin** (el sistema impide borrar al último administrador activo).

---

## 2. Configurar datos bancarios reales y verificar fechas

Por seguridad, el código base ya no incluye números de cuenta ni teléfonos reales. Mientras sigan los datos de ejemplo (`000000000000000000`), el formulario público mostrará *"Datos de pago no disponibles; contacta al organizador"* y bloqueará el envío.

1. Inicia sesión en `/admin` (en local o tras publicar en Cloudflare).
2. En el aviso amarillo superior presiona **Configurar ahora** (o ve a la pestaña **Convocatoria**).
3. Captura los datos oficiales del torneo:
   - **Banco**
   - **Titular**
   - **CLABE Interbancaria** (18 dígitos sin espacios)
   - **WhatsApp Contacto** (10 dígitos)
   - Confirma la fecha del evento (`2026-12-19T16:30:00-06:00`), la fecha límite de inscripción, el costo (`200`) y el cupo máximo (`100`). Las fechas de corte de mayoría de edad (`2008-12-19`) y Juvenil (`2007-12-19`) se actualizan automáticamente al guardar.
4. Presiona **Guardar Cambios de Convocatoria**.

---

## 3. Publicar y verificar las reglas de Firestore (en la base con nombre)

Las reglas protegen la privacidad de menores, recibos e inscritos.

1. Si hiciste cambios locales a `firestore.rules`, despliégalos siempre apuntando al proyecto correcto (el archivo `firebase.json` ya apunta a la base con nombre):
   ```bash
   bunx --no-install firebase login
   bunx --no-install firebase deploy --only firestore:rules,firestore:indexes --project yogic-decoder-5lxdt
   ```
2. **Verificación visual obligatoria:** entra a **Firebase Console → Build → Firestore Database → base `ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2` → pestaña Reglas** y confirma que la fecha de publicación es reciente y que el contenido coincide con el archivo `firestore.rules` del repositorio (debe incluir las funciones `isValidWaitlistEntry`, `validatePublicRosterMatch` y el filtro Unicode `\\p{L}`).

---

## 4. Publicar el sitio en Cloudflare Workers

El sitio web ya no se publica en Firebase Hosting. La URL pública oficial vive en **`site.config.json`** (`https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev`), por lo que la variable `VITE_SITE_URL` del panel de Cloudflare es **opcional** (solo sirve para sobrescribirla). Si algún día cambia la URL del sitio, edita `site.config.json` y haz commit a `main`.

Sigue la guía [`docs/DESPLIEGUE-CLOUDFLARE.md`](DESPLIEGUE-CLOUDFLARE.md) para:
1. Conectar tu repositorio **privado** de GitHub al Worker **`torneo-del-pavo-2-0`** en **Cloudflare Workers**.
2. Configurar **Build command:** `bun run build`, **Deploy command:** `npx wrangler deploy`, **Root directory** vacío y las **Build Variables** (`NODE_VERSION=22.23.5`, `BUN_VERSION=1.4.4`, `VITE_APP_ENV=production`; `VITE_SITE_URL` es opcional).
3. Confirmar que el despliegue sirvió `https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev` y que `canonical`, `sitemap.xml`, `robots.txt` y las tarjetas de WhatsApp apuntan a esa dirección.

---

## 5. Configuración posterior al cambio de dominio (obligatoria)

El dominio oficial publicado del Worker es **`torneo-del-pavo-2-0.club-don-gonzalo.workers.dev`**. Configúralo en los siguientes 3 lugares (y repítelo si algún día agregas un dominio propio):

1. **Firebase Auth → Dominios autorizados:**
   - Entra a **Firebase Console → Build → Authentication → Settings → Authorized domains**.
   - Agrega exactamente este dominio (**sin** `https://`):
     `torneo-del-pavo-2-0.club-don-gonzalo.workers.dev`
   - **Elimina los dominios temporales de desarrollo** (`ais-dev-*`, `ais-pre-*`) una vez que termines la migración a Cloudflare Workers.
2. **reCAPTCHA Enterprise (para App Check):**
   - Entra a [Google Cloud Console → reCAPTCHA Enterprise](https://console.cloud.google.com/security/recaptcha?project=yogic-decoder-5lxdt) (o reCAPTCHA Admin) y crea/edita la clave de sitio agregando exactamente el dominio (**sin** `https://`):
     `torneo-del-pavo-2-0.club-don-gonzalo.workers.dev`
   - Registra esa **Site Key** en **Firebase Console → Build → App Check → Apps** y colócala en la variable `VITE_RECAPTCHA_SITE_KEY` en Cloudflare Workers (*Build Variables*) y/o en `firebase-applet-config.json`.
3. **Restricción de la API Key del navegador:**
   - Entra a [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=yogic-decoder-5lxdt).
   - Abre la clave Web usada por Firebase y en **Application restrictions → Websites (HTTP referrers)** agrega exactamente (**con** `https://` y `/*`):
     `https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev/*`
     *(y tu dominio propio si aplica; deja `http://localhost:*` solo mientras desarrolles)*.
4. **Probar el login de admin bajo la URL oficial** (`https://torneo-del-pavo-2-0.club-don-gonzalo.workers.dev/admin`) en Chrome de escritorio, Chrome móvil y Safari de iPhone.
   - **Aviso importante sobre URLs de vista previa (*Preview URLs*):** las URLs temporales de vista previa generadas por Cloudflare para ramas o Pull Requests tienen otro subdominio distinto y **no están autorizadas** en Firebase Auth, reCAPTCHA ni en la API Key, por lo que **el login de `/admin` no funciona ahí** (es el comportamiento esperado por seguridad).

---

## 6. Sincronizar el padrón si había registros previos

Si migraste datos o agregaste registros manualmente antes de publicar:
1. Entra a `/admin` → **Inscritos y Recibos**.
2. Si ves el aviso amarillo **«Faltan X en padrón público»**, presiona el botón **Sincronizar padrón** y espera a que concluya la barra de progreso.

---

## 7. Activar App Check en el orden seguro (muy importante)

Si activas el bloqueo obligatorio (*Enforcement*) antes de que los navegadores envíen tokens válidos, **nadie podrá inscribirse**. Hazlo exactamente en este orden:

1. Publica primero en Cloudflare Workers con `VITE_RECAPTCHA_SITE_KEY` (o `recaptchaSiteKey`) ya configurada.
2. Abre el sitio publicado en una ventana normal y realiza una visita al padrón público y una inscripción de prueba.
3. Espera unos minutos, entra a **Firebase Console → App Check → APIs / Metrics** y confirma en **Cloud Firestore** que aparecen **solicitudes verificadas** (línea verde).
4. **Solo cuando veas tráfico verificado**, haz clic en **Enforce (Aplicar)** para **Cloud Firestore**.

---

## 8. Endurecer Firebase Authentication

1. Entra a **Firebase Console → Build → Authentication → Sign-in method**.
2. Mantén habilitado únicamente **Google**.
3. Si aparece habilitado **Correo electrónico/contraseña** o acceso anónimo sin uso, desactívalo y guarda.

---

## 9. Correr la prueba de humo en producción

Ejecuta y marca todas las casillas de [`docs/PRUEBA-DE-HUMO.md`](PRUEBA-DE-HUMO.md) sobre la URL pública real de Cloudflare Workers (incluyendo prueba con celular en datos móviles y Safari/Chrome móvil).

---

## 10. Anunciar el torneo

Cuando las 10 comprobaciones de la prueba de humo estén en verde, borra los registros de prueba desde `/admin` (pestaña *Papelera → Eliminar definitivo*) y comparte oficialmente el enlace del torneo.

---

## Cierre obligatorio tras concluir el evento (19 de diciembre de 2026)

1. En `/admin` → **Inscritos y Recibos**, descarga primero tu **Excel Admin** y **Respaldo JSON** y guárdalos en una computadora segura del comité.
2. Presiona **«Purgar comprobantes»** para borrar imágenes y PDFs de pago en `/comprobantes`.
3. Dentro del plazo del Aviso de Privacidad (máximo 30 días tras el evento), presiona **«Anonimizar post-torneo»** y limpia la lista de espera con **«Vaciar convertidos / antiguos»**.
