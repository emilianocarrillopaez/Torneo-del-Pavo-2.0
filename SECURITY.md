# Seguridad y Privacidad — Torneo del Pavo 2.0

Este documento describe el modelo de amenazas, las defensas aplicadas en Firestore Rules y Cloudflare Workers (Static Assets), y los riesgos residuales aceptados para la operación del torneo.

---

## 1. Activos Protegidos y Modelo de Amenazas

El sistema procesa información sensible de participantes (incluidos **menores de edad**):
- **Datos personales privados (`/participantes`):** nombre completo, fecha de nacimiento, correo electrónico, WhatsApp y nombre/autorización de madre, padre o tutor.
- **Comprobantes de pago (`/comprobantes`):** imágenes JPG/PNG/WEBP y PDFs almacenados como `data:` URLs verificadas en cliente y reglas.
- **Lista de espera (`/lista_espera`):** solicitudes de contacto cuando se llena el cupo.
- **Control administrativo (`/admins`, `/admins_by_email`):** privilegios otorgados únicamente por documentos Firestore (sin correos ni contraseñas en el código).

**Amenazas principales cubiertas:**
1. Lectura o enumeración pública de datos personales o comprobantes.
2. Falsificación de estatus `pagado`, cupo (`totalInscritos`), fechas límite o edad para categoría `Juvenil`.
3. Inyección de scripts (`XSS`), archivos HTML camuflados como recibos (`data:text/html`), o fórmulas ejecutables al exportar a Excel/CSV.
4. Robo o filtración accidental de credenciales administrativas o bancarias en el repositorio.

---

## 2. Qué Protege Cada Regla de Firestore (`firestore.rules`)

- **Denegación por defecto (`/{document=**}`):** cualquier ruta no declarada queda cerrada.
- **`/participantes/{id}`:**
  - Lectura (`get`, `list`), actualización y borrado exclusivos para `isAdmin()` (exige `email_verified == true` y documento activo en `/admins` o `/admins_by_email`).
  - Creación pública condicionada a: registro abierto + `request.time <= fechaLimiteTimestamp`, `estatusPago == 'pendiente'`, `tieneRecibo == true`, liga 1:1 con comprobante nuevo (`!exists` / `existsAfter` + `reciboId`), creación simultánea de su ficha pública (`participantes_publicos`), `website == ''` (honeypot), consentimiento de aviso de privacidad, autorización de tutor obligatoria para menores de 18 años al día del evento (`fechaCorteMayoriaEdad`), coherencia de categoría `Juvenil` (`fechaCorteJuvenil`) y validación Unicode de nombres (`\p{L}`).
- **`/participantes_publicos/{id}`:**
  - Lectura pública sanitizada sin correo, WhatsApp, fecha de nacimiento, tutor ni recibo.
  - Para menores de edad, las reglas prohíben publicar el campo `edad` (solo se permite `rangoEdad`).
  - Se contrastan con el documento privado `folio`, `categoria`, `estatusPago`, `fechaRegistro` y la primera palabra del nombre (`validatePublicRosterMatch`).
- **`/comprobantes/{id}`:** lectura y gestión solo para `isAdmin()`. Creación ligada 1:1 a participante nuevo (`!exists`), peso `<= 950,000` bytes/caracteres y prefijo MIME base64 estricto (`jpg`, `png`, `webp`, `pdf`).
- **`/registro_llaves/{hashId}`:** sin lectura ni actualización (`allow get, list, update: if false`) para evitar enumeración de correos o teléfonos. Creación exige ID SHA-256 de 64 caracteres, registro abierto y participante nuevo en el mismo batch.
- **`/lista_espera/{esperaId}`:** lectura, edición y purga solo para `isAdmin()`. Creación pública exige ID determinista SHA-256 de 64 hexadecimales (derivado del correo normalizado), registro abierto, `habilitarListaEspera != false`, consentimiento de menor y coherencia de categoría.
- **`/configuracion/general` y `/patrocinadores`:** lectura pública, escritura exclusiva de `isAdmin()`, validando URLs seguras (`https://` o `#`).

---

## 3. Qué Protege Cada Cabecera HTTP (`scripts/security-headers.mjs` → `public/_headers`)

Todas las cabeceras de producción y vista previa local provienen de un solo archivo (`scripts/security-headers.mjs`):

- **`Content-Security-Policy`:**
  - `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
  - `script-src` sin `'unsafe-inline'` ni `'unsafe-eval'`; restringido a `'self'`, Google Sign-In (`apis.google.com`) y reCAPTCHA Enterprise (`www.google.com/recaptcha/`, `www.gstatic.com/recaptcha/`).
  - `frame-src` permite `blob:` (visor aislado de PDFs en `<iframe sandbox="">`), Google Auth y reCAPTCHA.
  - `upgrade-insecure-requests` activo en producción HTTPS (Cloudflare Workers).
- **`Cross-Origin-Opener-Policy`:** **no se configura `same-origin`** de forma intencional para no romper la ventana emergente de Google Sign-In.
- **`X-Frame-Options: DENY`**: bloquea *clickjacking* en navegadores antiguos.
- **`X-Content-Type-Options: nosniff`**: evita interpretación errónea de MIME types.
- **`Referrer-Policy: strict-origin-when-cross-origin`** y **`Permissions-Policy`** (cámara, micrófono, geolocalización, pagos y USB deshabilitados).
- **`Strict-Transport-Security: max-age=31536000; includeSubDomains`** en Cloudflare Workers.
- **`X-Robots-Tag: noindex, nofollow`** en `/admin`, `/admin/*`, `/participantes` y `/participantes/*` (y exclusión de `/participantes` de `sitemap.xml` y `robots.txt`) para evitar que los buscadores indexen el padrón público con nombres abreviados (incluidos menores de edad); si el comité decide revertirlo, el procedimiento está en [`docs/GUIA-ADMIN.md`](docs/GUIA-ADMIN.md).

---

## 4. Riesgos Residuales Aceptados

| Riesgo residual | Razón técnica | Mitigación activa |
|---|---|---|
| **Llaves `/registro_llaves` no verificables por hash en servidor** | Firestore Rules no dispone de función nativa `sha256()` para comparar el ID de 64 hex con `correo`/`whatsapp`. | `R3` obliga a crear un participante nuevo en el mismo batch con registro abierto; el panel admin detecta posibles duplicados (`findPossibleDuplicates`) y permite liberar llaves. |
| **Spam o relleno de `/lista_espera`** | Las reglas tampoco pueden contar documentos globales ni validar criptográficamente el hash del correo en el servidor. | ID determinista evita repetición del mismo correo desde el cliente legítimo; App Check (reCAPTCHA Enterprise) mitiga bots; botón admin **«Vaciar convertidos / antiguos»** permite limpieza rápida. |
| **Datos bancarios públicos por diseño** | Para recibir transferencias, CLABE, banco, titular y WhatsApp deben mostrarse al público tras configurarlos. | Mientras sigan valores de ejemplo (`000000000000000000`), el formulario se bloquea automáticamente (`paymentConfig.ts`). Ningún dato bancario real vive en el repositorio. |
| **Límites de cuota gratuita (Spark)** | Sin tarjeta ni plan Blaze, superar 50,000 lecturas o 20,000 escrituras diarias devolverá `resource-exhausted` (sin cobros sorpresa). | Listener del padrón pausado en segundo plano, caché breve de 60 s, consulta acotada a 500 registros y plan de contingencia en `docs/PLAN-DE-CAPACIDAD.md`. |

---

## 5. Reporte de Incidentes y Cierre Post-Torneo

- Si detectas una vulnerabilidad, filtración o comportamiento anómalo, sigue de inmediato [`docs/RUNBOOK-INCIDENTES.md`](docs/RUNBOOK-INCIDENTES.md) (cerrar inscripciones desde `/admin` → *Convocatoria*, revisar accesos y contactar al responsable técnico del club).
- **Cierre obligatorio post-evento:** dentro del plazo indicado en el Aviso de Privacidad tras el **19 de diciembre de 2026**, descarga el respaldo interno seguro, ejecuta **«Purgar comprobantes»** y después **«Anonimizar post-torneo»** en el panel admin.
