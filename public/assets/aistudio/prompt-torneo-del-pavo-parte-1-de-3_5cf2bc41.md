# PARTE 1 DE 3 — Contexto, reglas, reconocimiento y SEGURIDAD
## Proyecto: «Torneo del Pavo 2.0»

> **Cómo usarlo:** pega todo lo que está bajo la línea en tu asistente de código (AI Studio, Claude Code, Cursor, etc.) con el proyecto abierto. Esta parte cubre **contexto + reglas + Fase 0 (reconocimiento) + Fase 1 (seguridad y privacidad)**. Las Partes 2 (bugs y mejoras) y 3 (verificación, documentación y entrega final) se pegan después, **cuando esta termine y pase lint, build y pruebas**.

---

# 0. ROL Y OBJETIVO

Actúa como un **equipo de tres perfiles trabajando juntos**:

1. **Ingeniero full-stack senior** (React, TypeScript, Vite, Firebase).
2. **Auditor de seguridad de aplicaciones web** (OWASP Top 10, reglas de Firestore, privacidad de datos).
3. **Diseñador de producto / QA** (accesibilidad, rendimiento móvil, experiencia de registro).

**Objetivo general del proyecto:** dejar la página lista para producción antes del evento (**sábado 19 de diciembre de 2026, 16:30 h**, Corredor Constitución, Durango, Dgo.), de modo que:

- ningún dato personal (especialmente de **menores de edad**) ni comprobante de pago pueda ser leído, alterado o abusado por terceros;
- el registro sea **confiable** (sin duplicados, sin folios repetidos, sin cupos falsos, sin registros huérfanos);
- la página sea **rápida en celular**, accesible y se vea bien al compartirse por WhatsApp;
- el organizador (una persona sin perfil técnico) pueda **operar el torneo** desde el panel admin sin riesgo de borrar o filtrar datos por accidente.

**Alcance de ESTA parte (Parte 1):** reconocimiento del proyecto y **todo lo relacionado con seguridad y privacidad**. **No ejecutes todavía** correcciones de bugs generales ni mejoras de diseño/SEO/UX: eso es de las Partes 2 y 3.

---

# 1. CONTEXTO DEL PROYECTO

## 1.1 Qué es
Sitio web del torneo de ajedrez del **Club de Ajedrez Don Gonzalo** (Durango). Muestra la convocatoria (fecha, lugar, categorías, sistema de competencia, premios, transitorios), un carrusel de patrocinadores, un formulario de **inscripción con comprobante de pago obligatorio**, un padrón público de inscritos y un **panel de administración** para validar pagos, editar contenido y administrar accesos.

Datos de negocio relevantes (vienen de `DEFAULT_CONFIG` en `src/types/tournament.ts`): cuota de inscripción de **$200 MXN**, cupo por defecto de **100 jugadores**, bolsa de premios de **más de $10,000**, **$2,500 en efectivo** al 1.er lugar, categorías **Juvenil** (18 años o menos al día del evento) y **Libre** (con premios especiales a Mejor Aficionado y Mejor Femenil), pago por transferencia (CLABE) con comprobante.

## 1.2 Stack
- React 19 + Vite + TypeScript + Tailwind 4, animaciones con `motion`, íconos `lucide-react`.
- Firebase: **Firestore con base de datos con nombre** (`firestoreDatabaseId` en `firebase-applet-config.json`; **no** es la base `(default)`), **Firebase Auth** (Google y correo/contraseña).
- Exportaciones: `jspdf` + `jspdf-autotable` (PDF) y `xlsx` (Excel).
- Pruebas existentes: `src/utils/tournamentUtils.test.ts` con `node:test`.
- Origen: proyecto generado en AI Studio (de ahí el nombre `react-example`, `.env.example` con `GEMINI_API_KEY`, `firebase-applet-config.json`, carpeta `public/assets/aistudio/`).

## 1.3 Mapa del código
| Área | Archivos |
|---|---|
| Arranque, rutas por hash | `src/main.tsx`, `src/App.tsx` |
| Autenticación | `src/context/AuthContext.tsx`, `src/components/admin/AdminAuthScreen.tsx` |
| Acceso a datos | `src/services/tournamentService.ts`, `src/lib/firebase.ts` |
| Tipos y configuración por defecto | `src/types/tournament.ts` |
| Registro público | `src/components/RegistrationForm.tsx`, `RegistrationSuccessModal.tsx`, `src/utils/receiptUtils.ts` |
| Padrón público | `src/components/ParticipantsPage.tsx` |
| Secciones informativas | `Hero`, `InfoSection`, `CategoriesSection`, `RulesSection`, `PrizesSection`, `TransitoriosSection`, `SponsorsCarousel`, `EventCountdown`, `Footer`, `Navbar`, `TopRibbon`, `ChristmasDecorations` |
| Panel admin | `src/components/AdminPanel.tsx`, `src/components/admin/*` (Participants, Content, Sponsors, Access, ReceiptViewerModal) |
| Utilidades y pruebas | `src/utils/tournamentUtils.ts`, `exportUtils.ts`, `tournamentUtils.test.ts` |
| Seguridad declarada | `firestore.rules`, `security_spec.md`, `firebase-blueprint.json` |

## 1.4 Modelo de datos actual (Firestore)
- `/participantes/{id}`: `nombre`, `fechaNacimiento` (`YYYY-MM-DD`), `whatsapp` (10 dígitos), `correo`, `categoria`, `estatusPago` (`pendiente|pagado`), `fechaRegistro` (ISO string), `folio`, `esFemenil`, `esAficionado`, `tieneRecibo`, `reciboId`, `reciboNombreArchivo`, `notas`, `website` (honeypot).
- `/comprobantes/{id}`: `participantId`, `folio`, `participantNombre`, `fileName`, `mimeType`, `fileSize`, `imageDataUrl` (**imagen o PDF completo en base64 dentro del documento**, ~850 KB máx.), `uploadedAt`.
- `/configuracion/general`: textos y datos del evento, `costo`, `cupoMaximo`, `totalInscritos`, `inscripcionesAbiertas`, `fechaLimite` (**texto libre**), `fechaIso`, `clabe`, `banco`, `titular`, `whatsappContacto`, etc.
- `/patrocinadores/{id}`: `nombre`, `logo` (URL o data URL), `enlace`, `activo`, `orden`, `categoriaSponsor`.
- `/admins/{uid}` y `/admins_by_email/{email}`: administradores adicionales.
- `/test/{doc}`: prueba de conexión.

## 1.5 Activos a proteger y amenazas
**Activos:** (1) datos personales de jugadores, incluidos menores; (2) comprobantes de pago (pueden mostrar nombre, cuenta, movimientos); (3) integridad del cupo y del estatus de pago; (4) cuentas de administrador; (5) reputación del club; (6) cuota/costo de Firebase.

**Atacantes a considerar:** curioso con las DevTools del navegador; bot de spam; persona molesta que quiere "agotar el cupo" o llenar la base de basura; estafador que intenta suplantar al admin o falsificar comprobantes; usuario autenticado con Google que **no** es admin; scraper que recolecta teléfonos y correos.

**Principio rector:** *el cliente no es de confiar*. Toda regla de negocio importante (quién lee qué, quién escribe qué, formato de datos, cupo, estatus de pago) debe aplicarse en **`firestore.rules`**, no solo en React.

---

# 2. REGLAS DE TRABAJO (OBLIGATORIAS)

1. **No cambies el diseño visual, la identidad (colores, tipografías, flyer) ni los textos oficiales del torneo**, salvo donde se indique expresamente. Los cambios de UI deben ser mínimos y coherentes con lo existente.
2. **Verifica antes de cambiar.** Cada hallazgo de este documento fue detectado leyendo el código, pero confírmalo tú mismo en el archivo real. Si algo ya no aplica o es un falso positivo, dilo y justifícalo.
3. **Cambios pequeños y revisables.** Un tema por commit/bloque, con mensaje claro. No reescribas archivos completos si basta un cambio puntual (excepto `firestore.rules`, que debe entregarse completo).
4. **Sin dependencias nuevas innecesarias.** Si agregas una, justifica por qué, su tamaño aproximado y su mantenimiento. Prefiere soluciones que funcionen en el plan gratuito de Firebase (**Spark**). Si algo requiere **Cloud Functions** (plan Blaze), preséntalo como *opción avanzada separada*, nunca como requisito.
5. **No inventes.** Si no puedes verificar algo (por ejemplo, el estado real de la consola de Firebase), indícalo como **paso manual pendiente** en lugar de asumirlo.
6. **Nunca imprimas ni copies secretos** (claves, CLABE, teléfonos) en logs, mensajes de commit o pruebas.
7. **Todo texto visible para el usuario va en español de México**, claro y sin tecnicismos. Los mensajes de error **no deben revelar detalles internos** (rutas de Firestore, UID, correos, JSON de errores).
8. **Cada corrección de seguridad debe tener su prueba** (unitaria o con el emulador de reglas) que **falle antes** del arreglo y **pase después**.

### Definición de terminado para la Parte 1
- [ ] `npm run lint`, `npm run build` y `npm test` pasan sin errores.
- [ ] Las pruebas de reglas en el emulador (`npm run test:rules`) pasan.
- [ ] `npm audit` sin vulnerabilidades **altas o críticas** sin justificar.
- [ ] No quedan `console.log`/`console.error` con datos personales ni errores crudos mostrados al usuario.
- [ ] La experiencia visual en móvil (360–430 px) y escritorio no se rompió.
- [ ] Los pasos manuales están documentados paso a paso.

---

# 3. FASE 0 — RECONOCIMIENTO Y LÍNEA BASE

Antes de tocar nada:

1. Lee `firestore.rules`, `security_spec.md`, `firebase-blueprint.json`, `src/services/tournamentService.ts`, `src/context/AuthContext.tsx`, `src/lib/firebase.ts`, `src/App.tsx`, `src/components/RegistrationForm.tsx`, `src/components/ParticipantsPage.tsx` y `src/components/admin/*`.
2. Ejecuta `npm install` (el repo trae solo `bun.lock`; **elige un gestor de paquetes** —npm o bun— y deja un único lockfile coherente con los scripts de `package.json`), luego `npm run lint`, `npm run build`, `npm test` y `npm audit`. **Registra el estado inicial** (qué pasa y qué falla) en `docs/AUDITORIA.md`.
3. Confirma (o refuta) la tabla de **hallazgos ya detectados** de abajo y añade los que encuentres tú.
4. Propón en máximo 10 líneas el plan de la Fase 1 **antes** de ejecutarla.

## Tabla de hallazgos ya detectados

La columna **Parte** indica dónde se atiende cada uno. **En esta parte solo trabajas los marcados con «1».** Los demás quedan registrados en `docs/AUDITORIA.md` como pendientes para las Partes 2 y 3.

| # | Severidad | Hallazgo | Evidencia | Parte |
|---|---|---|---|---|
| H1 | **CRÍTICO** | Lista de participantes **legible por cualquiera** con correo, WhatsApp y fecha de nacimiento (incluye menores). | `firestore.rules` → `/participantes` `allow read: if true`; `ParticipantsPage.tsx` los muestra y permite buscarlos | 1 |
| H2 | **CRÍTICO** | Tres correos se tratan como admin **sin exigir `email_verified`**; con correo/contraseña activo se puede crear una cuenta con ese correo y obtener privilegios. | `firestore.rules` → `isAdmin()`; `AuthContext.tsx` (`registerWithEmail`) | 1 |
| H3 | **ALTO** | Cualquiera puede escribir **cualquier número** en `totalInscritos` (p. ej. el cupo máximo para "agotar" el torneo). | `firestore.rules` → `/configuracion` `allow update` | 1 |
| H4 | **ALTO** | `imageDataUrl` de comprobantes no se valida como data URL: permite URLs externas (rastreo de IP del admin) o `data:text/html` abierto en un `<iframe>`. | `firestore.rules` → `isValidComprobante`; `ReceiptViewerModal.tsx` | 1 |
| H5 | **ALTO** | Sin App Check ni límites reales: spam masivo de registros y comprobantes de ~900 KB. | `firebase-applet-config.json` (`recaptchaSiteKey` vacío); solo hay honeypot en cliente | 1 |
| H6 | **ALTO** | Crear participante usa `hasAll` pero no `hasOnly`: se pueden inyectar campos extra; WhatsApp solo valida longitud, no dígitos. | `firestore.rules` → `isValidParticipant` | 1 |
| H7 | **ALTO** | Verificación de duplicados consulta la colección pública (permite **enumerar** quién está inscrito) y **falla abierta** si hay error. | `tournamentService.ts` → `checkDuplicateRegistration` | 1 |
| H8 | **ALTO** | Registro **no atómico** (comprobante → participante → contador) con `catch {}` vacío: quedan comprobantes huérfanos e inscritos sin contar. | `tournamentService.ts` → `registerParticipant`, `createParticipantAsAdmin` | 1 |
| H9 | **MEDIO** | Folio `PAVO-` + 4 dígitos aleatorios (`Math.random`): ~9,000 valores; con ~100 inscritos hay ≈40 % de probabilidad de repetir. | `tournamentService.ts` | 1 |
| H10 | **MEDIO** | Inyección de fórmulas en Excel (nombres/correos que empiezan con `=`, `+`, `-`, `@`); `xlsx@0.18.5` de npm sin mantenimiento con vulnerabilidades conocidas. | `exportUtils.ts`, `package.json` | 1 |
| H11 | **MEDIO** | `Sponsor.enlace`, `Sponsor.logo`, `config.mapaUrl` se renderizan sin validar el protocolo (`javascript:`). | `SponsorsCarousel.tsx`, `AdminSponsorsTab.tsx`, `InfoSection.tsx` | 1 |
| H12 | **MEDIO** | No hay `firebase.json`, ni cabeceras de seguridad/CSP, ni despliegue de reglas hacia la **base con nombre**. | raíz del repo | 1 |
| H13 | **MEDIO** | No hay aviso de privacidad ni consentimiento (ni de tutor para menores). | búsqueda en `src/` sin resultados | 1 |
| H14 | **MEDIO** | `DEFAULT_CONFIG` trae en el **código fuente** la CLABE, el titular y el WhatsApp reales. Si el repositorio es público, quedan expuestos. | `src/types/tournament.ts` | 1 |
| H15 | **MEDIO** | `security_spec.md` describe un comportamiento (lectura pública prohibida, rechazo de campos extra) que las reglas **no** implementan. | `security_spec.md` vs `firestore.rules` | 1 |
| H16 | **MEDIO (bug)** | `decodeURIComponent` sobre el hash puede lanzar `URIError` (`#admin-recibo=%`) y, sin Error Boundary, la página queda en blanco. | `App.tsx` | 2 |
| H17 | **BAJO** | `seedInitialDataIfEmpty()` corre en cada visita pública (lecturas/escrituras que fallan en silencio; riesgo de duplicar patrocinadores). | `App.tsx`, `tournamentService.ts` | 2 |
| H18 | **BAJO** | Fecha del torneo hardcodeada (`2026-12-19`, "nacidos a partir del 20 de diciembre de 2007") en varios archivos. | `tournamentUtils.ts`, `types/tournament.ts`, `RegistrationForm.tsx` | 2 |
| H19 | **BAJO** | `package.json`: nombre `react-example`, script `clean` que borra un `server.js` inexistente, dependencias probablemente sin uso (`express`, `dotenv`, `@google/genai`), sin script `test`. | `package.json` | 2 |
| H20 | **BAJO** | Imágenes pesadas (~3.2 MB entre PNG/JPG, con nombres de capturas de pantalla del teléfono) y `og:image` con ruta relativa. | `public/assets/aistudio/`, `index.html` | 3 |

> Nota: de H19, en esta parte solo atiendes lo estrictamente necesario para seguridad (quitar dependencias sin uso que amplíen la superficie de ataque y agregar los scripts `test` y `test:rules`). El resto de la limpieza va en la Parte 2.

---

# 4. FASE 1 — SEGURIDAD Y PRIVACIDAD

> Para **cada** punto: implementa, escribe la prueba del emulador (o unitaria) y verifica el **criterio de aceptación** antes de pasar al siguiente.

## 1.1 Cerrar la fuga de datos personales (H1) — PRIORIDAD ABSOLUTA

**Qué hacer**
- `/participantes`: lectura **solo administradores** (`allow get, list: if isAdmin()`).
- Crear la colección pública **`/participantes_publicos/{id}`** (mismo `id` que el participante). Campos permitidos, **únicamente**: `folio`, `nombre` (o *nombre + inicial del apellido* para mayor privacidad; deja la decisión como constante fácil de cambiar), `categoria`, `esAficionado`, `esFemenil`, `estatusPago`, `rangoEdad` o `edad` calculada. **Jamás** correo, WhatsApp, fecha de nacimiento, `notas`, ni datos del recibo.
- Reglas de `participantes_publicos`: lectura pública; `create` solo si en el **mismo batch** se crea el doc privado correspondiente (`existsAfter`) y los valores coinciden con él (`getAfter(...)`); `update`/`delete` solo admin.
- `ParticipantsPage.tsx`: leer de `participantes_publicos`; **quitar** la búsqueda por correo/WhatsApp y los enlaces `wa.me` de la vista pública (en el panel admin sí pueden permanecer).
- El panel admin mantiene sincronizados ambos documentos al cambiar estatus de pago o corregir nombre/categoría (misma operación atómica).
- Exportaciones **públicas** (PDF) sin datos de contacto; verifica que ningún formato público los incluya.

**Criterio de aceptación:** sin sesión, `getDocs(collection(db,'participantes'))` falla con `permission-denied`; `participantes_publicos` no contiene ningún campo privado; la página de padrón sigue funcionando y se ve igual.

## 1.2 Cerrar la escalada a administrador (H2)

- Exigir `email_verified == true` en **todas** las ramas de `isAdmin()`.
- Eliminar `registerWithEmail` de `AuthContext.tsx` y la ruta de registro por correo. Dejar **solo Google Sign-In** para admin. Documentar como paso manual desactivar el proveedor *Correo/Contraseña* en Firebase Authentication.
- Quitar `AUTHORIZED_ADMIN_EMAILS` del bundle del cliente. El cliente solo consulta si existe su documento en `/admins/{uid}`; **las reglas son la fuente de verdad**. Las reglas no deben tener correos hardcodeados: administrar admins desde `/admins` (con documento de arranque creado manualmente desde la consola; documenta ese *bootstrap* paso a paso).
- Validar forma y tamaño de los documentos de `/admins` y `/admins_by_email`.
- `AdminAccessTab`: impedir que un admin se quite a sí mismo el último acceso (evitar bloqueo total).
- Cierre de sesión de admin por **inactividad** (p. ej. 30 min) y limpieza del estado en memoria al cerrar sesión.

**Criterio de aceptación:** una cuenta con correo no verificado, aunque coincida con un correo "autorizado", **no** puede leer `/participantes` ni escribir `/configuracion`.

## 1.3 Contador, cupo e inscripciones abiertas (H3, H8)

Presenta e implementa **dos opciones** y recomienda una:

- **Opción A (recomendada, sin Cloud Functions):** eliminar por completo la escritura pública de `totalInscritos`. El total se calcula con una consulta de agregación (`getCountFromServer`) sobre `participantes_publicos`. El cupo se muestra en la UI y el admin valida pagos manualmente; documenta que el cupo estricto no se puede garantizar solo con reglas.
- **Opción B (estricta):** el contador solo se puede incrementar **+1**, **solo** si el mismo batch crea un participante (liga el incremento a ese registro, p. ej. con un campo `ultimoRegistroId` en el doc de configuración validado con `existsAfter`), sin superar `cupoMaximo` y solo si `inscripcionesAbiertas == true`.

Además, en ambos casos:
- Registro con **`writeBatch` atómico**: comprobante + participante + doc público + llaves de duplicado (1.7). Elimina los `catch {}` vacíos.
- Aplica lo mismo a `createParticipantAsAdmin`, `attachReceiptToParticipant` y `deleteParticipant` (borrar privado + público + comprobante + llaves en una sola operación).
- Convierte `fechaLimite` en un valor **máquina-legible** (`fechaLimiteIso`, `Timestamp` o ISO) y hazlo cumplir en reglas con `request.time`, conservando el texto bonito para mostrar.

**Criterio de aceptación:** un usuario anónimo no puede modificar `totalInscritos` a un valor arbitrario; una falla a mitad de registro no deja documentos huérfanos.

## 1.4 Blindar los comprobantes (H4)

- Reglas de `/comprobantes`: `hasOnly` con la lista exacta de campos; `imageDataUrl` debe cumplir el prefijo con `.matches()` (`data:image/jpeg;base64,`, `data:image/png;base64,`, `data:image/webp;base64,`, `data:application/pdf;base64,`) **y coincidir con `mimeType`**; validar `participantId`, `fileSize` (rango), `fileName` (sin separadores de ruta) y `uploadedAt`.
- `ReceiptViewerModal.tsx`: PDF en `<iframe sandbox>` (sin permisos) o mediante `Blob` URL; **nunca** renderizar un `src` que no sea un `data:` de los tipos permitidos. Agrega `referrerPolicy="no-referrer"` a las imágenes.
- `receiptUtils.ts`: verificar el tipo real por **firma de bytes** (JPEG `FFD8FF`, PNG `89504E47`, WEBP `RIFF…WEBP`, PDF `%PDF`), no solo `file.type`. Es una validación de comodidad; la obligatoria está en reglas.
- Agregar en el panel admin un botón **«Purgar comprobantes»** (con confirmación fuerte) para borrarlos después del torneo (minimización de datos), y una nota de retención.

## 1.5 Anti-spam y abuso (H5)

- Integrar **Firebase App Check** (reCAPTCHA v3 o Enterprise; completa `recaptchaSiteKey`) y documentar cómo activar **enforcement** para Firestore y Authentication. Como capa adicional *opcional*, Cloudflare Turnstile en el formulario.
- En cliente: un solo envío en curso, enfriamiento tras error, límite de intentos por sesión. Aclara en comentarios que esto **no sustituye** a App Check.
- Alertas de presupuesto/cuotas en Google Cloud (paso manual) para detectar abuso por costo.

## 1.6 Endurecer reglas de creación de participantes (H6, H15)

- `hasOnly` basado en la interfaz `Participant` real de `types/tournament.ts` (deriva la lista de ahí).
- `whatsapp` con `matches('^[0-9]{10}$')`; `correo` con formato válido, en minúsculas y ≤ 100 caracteres; `fechaNacimiento` con `matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')` y año razonable; `nombre` ≥ 3 y ≤ 150 caracteres y sin espacios en los extremos; `folio` con el formato esperado; `esFemenil`/`esAficionado` booleanos; `reciboId` debe existir en el mismo batch (`existsAfter`).
- Unificar categorías: el tipo `TournamentCategory` arrastra valores heredados (`Niños`, `Aficionados`, `Rankeado`, `Libre - Aficionados`, `Libre - Rankeado`) que la UI no usa. Deja solo las vigentes (**Juvenil** y **Libre**, con `esAficionado`) y maneja lo heredado de forma segura.
- Validaciones equivalentes (tipos, tamaños, `hasOnly`) para `/patrocinadores` y `/configuracion`, incluyendo que `enlace`/`mapaUrl` empiecen con `https://` (o sean `#` para "sin enlace").
- `/test`: solo `get` del documento `connection`.
- **Reescribe `security_spec.md`** para que describa exactamente lo que hacen las reglas finales (qué colección lee/escribe quién, qué campos, qué se rechaza).

## 1.7 Duplicados sin filtrar información (H7)

- Sustituye `checkDuplicateRegistration` por **llaves deterministas**: documentos `/registro_llaves/{sha256(correo_normalizado)}` y `/registro_llaves/{sha256(whatsapp)}` creados en el mismo batch (hash con `crypto.subtle`). Las reglas permiten `create` pero **no** `update`/`get`/`list` públicos, por lo que un duplicado hace fallar el batch completo. Traduce ese fallo a un mensaje amable ("Ya existe una inscripción con ese correo o WhatsApp") **sin revelar nada más**.
- Normaliza antes de hashear (minúsculas, sin espacios; WhatsApp solo dígitos).
- Quita la política de "fallar abierto": si no se puede verificar, no se inscribe y se pide reintentar.

## 1.8 Folios únicos e impredecibles (H9)

- Genera el folio con `crypto.getRandomValues` (p. ej. `PAVO-` + 6 caracteres de un alfabeto sin ambigüedades: sin `0/O`, `1/I/L`), o usa el id del doc público como folio. Garantiza **unicidad** (reintento ante colisión) y agrega pruebas unitarias.

## 1.9 Enlaces, URLs y datos que vienen de configuración (H11)

- Función única `safeHttpUrl(url)` que solo acepte `https://` (y `http://` si lo justificas) y rechace `javascript:`, `data:`, `vbscript:`; úsala en `SponsorsCarousel`, `AdminSponsorsTab`, `InfoSection` (`mapaUrl`), `Footer` y cualquier `href`/`src` proveniente de datos.
- Todos los `target="_blank"` con `rel="noopener noreferrer"` (revisa Footer, InfoSection, Hero, ParticipantsPage, AdminParticipantsTab, RegistrationSuccessModal, SponsorsCarousel).
- `encodeURIComponent` en todo texto prellenado de `wa.me`; normaliza el número (solo dígitos + `52`).

## 1.10 Exportaciones seguras (H10)

- Neutraliza celdas peligrosas en Excel/CSV (prefijo `'` o tabulador si empiezan con `=`, `+`, `-`, `@`, tab o retorno de carro). Función única con pruebas.
- Reemplaza `xlsx@^0.18.5` por la distribución oficial mantenida de SheetJS (tarball de cdn.sheetjs.com) o por `exceljs`; ejecuta `npm audit` y documenta el resultado.
- Los PDF/Excel del admin deben incluir una advertencia visible de **"CONFIDENCIAL: contiene datos personales"** y no deben incluir el contenido del comprobante, solo el estatus.

## 1.11 Hosting, cabeceras y configuración de Firebase (H12)

- Crear **`firebase.json`** y **`firestore.indexes.json`**:
  - despliegue de reglas **hacia la base con nombre** (campo `database` = el `firestoreDatabaseId` de `firebase-applet-config.json`); si se despliega sin eso, las reglas van a la base `(default)` y la base real queda sin proteger;
  - Hosting con `rewrites` a `index.html` (para que `/admin` y `/participantes` no den 404) y cabeceras: `Content-Security-Policy` (script-src solo `'self'`; connect-src a `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`; frame-src para el flujo de Google Auth; img-src `'self' data: https:`; style/font-src para Google Fonts), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictivo, `Strict-Transport-Security` y `frame-ancestors 'none'`.
- Probar la CSP con `npm run build && npm run preview` y corregir todo bloqueo legítimo (fuentes, Auth, imágenes).
- Pasos manuales (documentar): restringir la **API key por referrer HTTP** en Google Cloud Console (la key es pública por diseño, pero debe estar restringida); dejar solo el dominio real en *Authorized domains*; desactivar Correo/Contraseña; activar App Check con enforcement; revisar permisos IAM del proyecto; activar **respaldos/exportaciones programadas** de Firestore.
- Limpiar secretos y ruido: quitar `GEMINI_API_KEY`/`APP_URL` de `.env.example` si no se usan; confirmar que `vite.config.ts` **no inyecta** variables secretas al bundle; quitar `express`, `dotenv`, `@google/genai` si no se usan.

## 1.12 Datos sensibles en el código fuente (H14)

- Quita del código fuente (`DEFAULT_CONFIG`) la **CLABE, el titular y el WhatsApp reales**; deja valores de ejemplo y que los reales vivan **solo** en Firestore (`configuracion/general`, editable desde el panel). Verifica el historial de git: si hubo datos reales, indica el paso manual de reescribir historial o aceptar el riesgo conscientemente.
- Si el repositorio es público, recomienda hacerlo privado y verifica que `.gitignore` cubra `.env*`.

## 1.13 Privacidad y menores de edad (H13)

- **Aviso de privacidad** accesible (modal o página) con borrador de texto: responsable (el club), datos que se recaban, finalidades (inscripción, comunicación de rondas, validación de pago), con quién se comparten (nadie, salvo el padrón público limitado), derechos ARCO, medio de contacto, tiempo de conservación. Márcalo claramente como *«borrador sujeto a revisión del organizador»*.
- **Casilla obligatoria** de aceptación en el formulario; si la edad al día del torneo es **menor de 18**, mostrar además **consentimiento de madre/padre/tutor** con campo de nombre del tutor.
- Guardar `aceptoAviso`, `consentimientoTutor`, `nombreTutor` y fecha del consentimiento; validarlos en reglas.
- Política de retención: botón admin para anonimizar/borrar datos y comprobantes tras el evento.

## 1.14 Registro de errores sin fugas

- `handleFirestoreError` en `src/lib/firebase.ts` construye un JSON con **UID, correo y proveedor** y lo lanza como `Error`. Asegura que **nunca** llegue a la interfaz ni a la consola en producción; muestra mensajes genéricos amables y deja el detalle solo en modo desarrollo.
- Mapea códigos (`permission-denied`, `unavailable`, `already-exists`, `resource-exhausted`) a mensajes útiles en español (por ejemplo, "Estamos recibiendo muchas solicitudes, intenta en unos minutos").

## 1.15 Pruebas de seguridad (emulador de reglas)

Crea `tests/rules/` con `@firebase/rules-unit-testing` y un script `npm run test:rules`. Cubre **al menos** estos casos (cada uno con su resultado esperado):

1. Anónimo lee `/participantes` → **denegado**.
2. Anónimo lee `/participantes_publicos` → **permitido** y sin campos privados.
3. Anónimo crea participante válido en batch completo → **permitido**.
4. Participante con `estatusPago: 'pagado'` → **denegado**.
5. Participante con campo extra (`isAdmin`, `rol`) → **denegado**.
6. `whatsapp` con letras o longitud ≠ 10 → **denegado**.
7. `nombre` > 150 caracteres → **denegado**.
8. Categoría fuera de la lista → **denegado**.
9. Honeypot `website` con texto → **denegado**.
10. Comprobante con `imageDataUrl` `https://…` → **denegado**.
11. Comprobante con `data:text/html…` → **denegado**.
12. Comprobante mayor al límite de tamaño → **denegado**.
13. Anónimo actualiza `totalInscritos` → **denegado** (o solo +1 ligado, según la opción elegida).
14. Usuario de Google **no admin** lee `/comprobantes` → **denegado**.
15. Usuario con correo "autorizado" **sin verificar** → tratado como **no admin**.
16. Admin legítimo lee, actualiza y borra → **permitido**.
17. Duplicado de correo o WhatsApp → batch **denegado**.
18. `enlace` de patrocinador con `javascript:` → **denegado**.
19. Anónimo escribe `/admins` o `/admins_by_email` → **denegado**.
20. Inscripción después de `fechaLimite` o con `inscripcionesAbiertas == false` → **denegado**.

Además agrega pruebas unitarias para: folio único, `safeHttpUrl`, sanitización de celdas de Excel y hash de llaves de duplicado.

---

# 5. FORMATO DE LA RESPUESTA AL TERMINAR LA PARTE 1

1. **Resumen ejecutivo** (máx. 10 líneas): qué quedó protegido y qué riesgos permanecen.
2. **Tabla**: *hallazgo (H#) → archivos modificados → estado* (`corregido` / `pendiente de paso manual` / `descartado` + motivo). Incluye también H16–H20 con estado «pendiente para Parte 2/3».
3. `firestore.rules` **completo**, `firebase.json` y `firestore.indexes.json`.
4. **Pasos manuales** numerados, redactados para alguien no experto (Firebase Console y Google Cloud Console).
5. **Resultados reales** de `npm run lint`, `npm run build`, `npm test`, `npm run test:rules` y `npm audit` (pega la salida resumida, no la inventes).
6. **Lo que no pudiste hacer o dejaste para después**, dicho con claridad, con prioridad sugerida.
7. **Decisiones que debe tomar el organizador** (por ejemplo: ¿nombre completo o abreviado en el padrón público?, ¿cupo estricto (Opción B) o flexible (Opción A)?, ¿tiempo de conservación de datos?).

**Cuando termines, detente y espera la Parte 2.** No empieces a corregir bugs generales ni mejoras de diseño por tu cuenta.
