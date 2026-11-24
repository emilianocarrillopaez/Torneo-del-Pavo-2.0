# Prueba de Humo en Producción — Torneo del Pavo 2.0

Ejecuta esta lista **después** de haber completado los pasos 1 a 8 de [`docs/PASOS-MANUALES.md`](PASOS-MANUALES.md), directamente sobre la **URL definitiva publicada en Cloudflare Pages**.

> **Importante:** al terminar la prueba de humo y antes de anunciar el torneo, elimina definitivamente los registros ficticios creados en estas pruebas.

---

## 1. Verificación técnica de cabeceras y rutas profundas (`curl -I`)

Ejecuta desde una terminal local reemplazando `https://TU-DOMINIO.pages.dev` y el nombre real de un archivo `.js` dentro de `dist/assets/` (puedes obtener el nombre exacto abriendo el código fuente de `/` o consultando `ls dist/assets`):

```bash
SITE="https://TU-DOMINIO.pages.dev"

# 1. Raíz: debe responder HTTP 200 con CSP, X-Frame-Options: DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS
#    y SIN Cross-Origin-Opener-Policy: same-origin
curl -sSI "$SITE/"

# 2. Activos con hash: debe responder Cache-Control: public, max-age=31536000, immutable
curl -sSI "$SITE/assets/<NOMBRE-ARCHIVO>.js"

# 3. Ruta profunda /admin: debe responder HTTP 200 (HTML de la SPA, no 404) y X-Robots-Tag: noindex, nofollow
curl -sSI "$SITE/admin"

# 4. Ruta profunda /participantes: debe responder HTTP 200 (no 404)
curl -sSI "$SITE/participantes"

# 5. Archivos SEO y políticas
curl -sS "$SITE/robots.txt"
curl -sS "$SITE/sitemap.xml"
```

Casillas de verificación técnica:
- [ ] `/` devuelve `200`, `Content-Security-Policy` activa y **sin** `Cross-Origin-Opener-Policy: same-origin`.
- [ ] `/assets/*.js` devuelve `Cache-Control: public, max-age=31536000, immutable`.
- [ ] `/admin` devuelve `200` también al recargar con `F5`, e incluye `X-Robots-Tag: noindex, nofollow`.
- [ ] `/participantes` devuelve `200` también al recargar con `F5`.
- [ ] `robots.txt`, `sitemap.xml`, `<link rel="canonical">` y JSON-LD apuntan al dominio final.

---

## 2. Lista de verificación funcional en vivo (en orden)

1. **Acceso al panel administrativo (`/admin`):**
   - [ ] Entra a `/admin` e inicia sesión con tu cuenta de Google autorizada en Chrome de escritorio. Confirma que no aparece error de permisos ni bloqueo por CSP en la consola.
2. **Datos bancarios reales y desbloqueo del formulario:**
   - [ ] En **Convocatoria**, verifica o captura **Banco**, **Titular**, **CLABE (18 dígitos)** y **WhatsApp Contacto (10 dígitos)** reales y guarda.
   - [ ] Abre la página principal en otra pestaña y confirma que desapareció el aviso de bloqueo y se muestran los datos bancarios reales (ningún `000000000000000000`).
3. **Inscripciones de prueba (adulto y menor con comprobante real pequeño):**
   - [ ] Realiza una inscripción de **adulto** adjuntando una imagen pequeña (`JPG` o `PNG` real). Anota el folio `PAVO-...`.
   - [ ] Realiza una segunda inscripción de **menor de edad** adjuntando un comprobante en **PDF** pequeño, verificando que exige casilla de consentimiento y nombre completo del padre/tutor. Anota el folio.
4. **Privacidad en padrón público vs. panel privado:**
   - [ ] Abre `/participantes` (y recarga con `F5`): confirma que ambos folios aparecen en el listado con nombre formateado y categoría, y **sin** correo, WhatsApp, fecha de nacimiento ni edad exacta del menor.
   - [ ] Regresa a `/admin → Inscritos y Recibos`: confirma que aparecen los datos completos y que tanto la imagen (**Ver Foto**) como el **PDF** se abren correctamente dentro del visor seguro bajo la CSP activa.
5. **Validación de pago y exportaciones:**
   - [ ] En el visor del recibo presiona **Aprobar y siguiente** (o **Marcar Pagado**) sobre uno de los registros de prueba.
   - [ ] Descarga **PDF**, **Excel** y **Respaldo JSON** desde la barra de herramientas; ábrelos en tu computadora y confirma que las celdas no muestran fórmulas ejecutables ni errores.
6. **Bloqueo de duplicados:**
   - [ ] Intenta inscribir en el formulario público el mismo correo y luego el mismo WhatsApp de la prueba 3. Confirma que el sistema rechaza el registro con mensaje claro y **sin** mostrar información del otro participante.
7. **Limpieza completa de pruebas:**
   - [ ] En `/admin → Inscritos y Recibos`, envía ambos registros de prueba a la papelera (**Mover a papelera**).
   - [ ] Entra a la subvista **Papelera** y presiona **Eliminar definitivo** en cada uno. Confirma que desaparecen del padrón público (`/participantes`) y de las estadísticas.
8. **Prueba en celular real con datos móviles (sin Wi-Fi):**
   - [ ] Abre la URL pública desde un teléfono usando **red celular** (4G/5G): verifica carga inicial, formulario, subida de fotografía desde galería/cámara.
   - [ ] Prueba iniciar sesión en `/admin` desde **Chrome móvil (Android)** y desde **Safari (iPhone)** para confirmar que la ventana emergente de Google funciona correctamente en el dominio final.
9. **Tarjeta al compartir en WhatsApp / Facebook:**
   - [ ] Pega la URL final en un chat privado de WhatsApp contigo mismo y confirma que aparece la imagen del torneo, el título correcto y el enlace final (si WhatsApp guardó caché vieja, agrega `?v=2` solo para validar o usa *Sharing Debugger* de Meta).
10. **Consola limpia y PageSpeed Insights:**
    - [ ] Revisa DevTools → **Console** en `/`, `/participantes` y `/admin`: confirma 0 errores de JavaScript, CSP o App Check.
    - [ ] Corre [PageSpeed Insights](https://pagespeed.web.dev/) sobre la URL pública en **Móvil** y **Computadora** y anota los puntajes reales:
      - Móvil — Rendimiento: `___` · Accesibilidad: `___` · Prácticas recomendadas: `___` · SEO: `___`
      - Escritorio — Rendimiento: `___` · Accesibilidad: `___` · Prácticas recomendadas: `___` · SEO: `___`
      *(Meta recomendada: Rendimiento ≥ 90; Accesibilidad, Buenas prácticas y SEO ≥ 95).*
