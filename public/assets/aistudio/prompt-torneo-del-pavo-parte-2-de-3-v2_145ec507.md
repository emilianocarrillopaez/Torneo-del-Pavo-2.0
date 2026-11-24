# PARTE 2 DE 3 (v2) — Verificación de la Parte 1, BUGS y MEJORAS
## Proyecto: «Torneo del Pavo 2.0»

> **Cómo usarlo:** pega todo lo que está bajo la línea en el **mismo asistente y el mismo proyecto** donde terminó la Parte 1 (necesita ver los cambios que ya hizo). Esta parte cubre **verificación de regresiones de la Parte 1 + Fase 2 (bugs y robustez) + Fase 3 (mejoras de la página)**. La Parte 3 (verificación final, CI/CD y documentación) se pega después.

---

# 0. ROL Y ALCANCE

Mantén los mismos tres perfiles de la Parte 1: **ingeniero full-stack senior** (React, TypeScript, Vite, Firebase), **auditor de seguridad** y **diseñador de producto / QA**.

**Alcance de ESTA parte:**
1. Revisar con ojo crítico lo que se hizo en la Parte 1 (fue un cambio grande: ~36 archivos) y corregir regresiones, huecos y deuda.
2. Corregir bugs y robustez general (Fase 2).
3. Mejorar rendimiento, SEO, accesibilidad, registro y panel de administración (Fase 3).

**Fuera de alcance (Parte 3):** CI/CD, entornos, datos de prueba masivos, pruebas extremo a extremo, documentación final y entrega consolidada. **No los ejecutes ahora.**

**Objetivo del proyecto (recordatorio):** página lista para producción antes del evento (**sábado 19 de diciembre de 2026, 16:30 h**, Durango, Dgo.): datos personales de jugadores (incluidos menores) protegidos, registro confiable, página rápida en celular y accesible, y un panel que el organizador (sin perfil técnico) pueda operar sin riesgo.

---

# 1. ESTADO ESPERADO TRAS LA PARTE 1 (VERIFÍCALO, NO LO DES POR HECHO)

Según el cierre de la Parte 1, deberían existir:

- Colecciones nuevas: **`/participantes_publicos`** (padrón sin datos privados) y **`/registro_llaves`** (llaves SHA-256 anti-duplicados).
- Registro con **`writeBatch` atómico**; folio con `crypto.getRandomValues` (`PAVO-XXXXXX`); conteo con `getCountFromServer` (Opción A), sin escritura pública de `totalInscritos`.
- `/participantes` y `/comprobantes` solo para administradores con **correo verificado**; solo Google Sign-In; cierre por inactividad; protección del último admin.
- Validación de comprobantes (magic bytes, prefijo `data:` ligado al `mimeType`), visor con `sandbox` y Blob URL; botones «Purgar comprobantes» y «Anonimizar post-torneo».
- `exceljs` en lugar de `xlsx`; neutralización de fórmulas; `safeHttpUrl`; `rel="noopener noreferrer"`.
- `PrivacyNoticeModal`, casilla obligatoria y consentimiento de tutor para menores de 18 años al día del evento.
- `firebase.json` (despliegue a la **base con nombre**, rewrites SPA, CSP y cabeceras), `firestore.indexes.json`, `eslint.config.mjs`, `tests/rules/firestore.rules.test.ts`, `docs/AUDITORIA.md`, scripts `test`, `test:rules`, `lint:rules`.
- App Check inicializado condicionalmente (requiere `recaptchaSiteKey`).

**Pendientes conocidos de la Parte 1 (manuales o de entorno):** la suite del emulador **no se pudo ejecutar** (falta Java JRE), App Check sin enforcement, Correo/Contraseña aún activo en Firebase Auth, API key sin restringir, y falta el documento del primer admin en `/admins` o `/admins_by_email`.

---

# 2. REGLAS DE TRABAJO (OBLIGATORIAS)

1. **No cambies el diseño visual, la identidad (colores, tipografías, flyer) ni los textos oficiales**, salvo donde se indique.
2. **Verifica antes de cambiar.** Si un hallazgo ya no aplica o es un falso positivo, dilo y justifícalo.
3. **Cambios pequeños y revisables**, un tema por bloque, con mensaje claro.
4. **Sin dependencias nuevas innecesarias**; prioriza el plan gratuito de Firebase (Spark). Cloud Functions solo como *opción avanzada separada*.
5. **No inventes**: lo que no puedas verificar (consola de Firebase, despliegues reales) va como **paso manual pendiente**. Nunca digas que algo "pasa" si no lo ejecutaste.
6. **Nunca imprimas ni copies secretos** (claves, CLABE, teléfonos) en logs, commits o pruebas.
7. **Texto visible en español de México**, claro; los errores no revelan detalles internos.
8. **Toda corrección importante lleva su prueba** (falla antes, pasa después). Cualquier cambio en `firestore.rules` se entrega **completo** y con pruebas de reglas actualizadas.
9. **No rompas lo ya blindado**: ningún cambio de esta parte puede reabrir lectura pública de `/participantes`, `/comprobantes` ni `/registro_llaves`.

### Definición de terminado para la Parte 2
- [ ] `npm run lint`, `npm run build`, `npm test` y `npm run test:rules` pasan (si el emulador no puede correr, queda **documentado exactamente por qué** y cómo correrlo).
- [ ] Recorrido funcional completo (sección 3.2) sin errores en consola.
- [ ] Cada hueco R1–R7 de la sección 3.0 corregido **con su prueba de reglas**, incluida la prueba del registro completo «camino feliz» (si no pasa, **ninguna inscripción real funcionaría**).
- [ ] Prueba de humo en el despliegue real: inscribir un participante de prueba, verlo en el padrón y en el panel, y borrarlo desde el panel.
- [ ] Sin `DRAFT_*`, archivos temporales ni código muerto en el repositorio.
- [ ] Lighthouse móvil: Rendimiento ≥ 90, Accesibilidad ≥ 95, Buenas prácticas ≥ 95, SEO ≥ 95 (mide y reporta números reales).
- [ ] Apariencia en móvil (360–430 px) y escritorio intacta.

---

# 3. FASE 2.0 — VERIFICACIÓN DE REGRESIONES Y DEUDA DE LA PARTE 1

Hazlo **antes** de los bugs nuevos. Reporta cada punto como `ok` / `corregido` / `pendiente manual`.

## 3.0 Huecos detectados en las reglas reales (corregir ANTES de todo lo demás)

Se revisó el `firestore.rules` completo entregado al cierre de la Parte 1. **Patrón común:** varias reglas usan `existsAfter()` para «atar» documentos del mismo batch, pero `existsAfter()` también es verdadero para documentos que **ya existían** antes del batch. Por eso hoy se pueden crear documentos sueltos sin una inscripción real. Estas reglas, además, **aún no se han probado en el emulador**: el riesgo inverso es que una regla demasiado estricta bloquee **todas** las inscripciones, así que ningún cambio se da por bueno hasta que pase la prueba del batch completo.

- **R1 — `/comprobantes` (create público).** Solo exige registro abierto y `existsAfter(participantes/$(participantId))`. Cualquiera que conozca un id de participante (los ids son públicos a través de `participantes_publicos`) puede subir comprobantes de hasta ~950 KB **sin inscribirse**, sin límite (costo/almacenamiento), o colgarlos de participantes ajenos. **Corrección:** exigir `!exists(participantes/$(participantId))` (el participante es nuevo en este batch) y la liga 1:1 `getAfter(participantes/$(participantId)).data.reciboId == comprobanteId`.
- **R2 — `/participantes` (create público).** `reciboId` solo se valida con `existsAfter(comprobantes/$(reciboId))`: puede apuntar al comprobante de **otra persona** ya existente. **Corrección:** `!exists(comprobantes/$(reciboId))` y `getAfter(comprobantes/$(reciboId)).data.participantId == participanteId`.
- **R3 — `/registro_llaves` (create público).** `existsAfter(participantes/pid)` se cumple con cualquier participante existente y la regla no exige registro abierto: cualquiera puede **apartar correos o teléfonos ajenos** (bloqueando su inscripción con el mensaje de «ya existe») o llenar la colección de basura. **Corrección:** exigir `isRegistrationOpen()` y `!exists(participantes/$(participantId))` (participante nuevo en el mismo batch). Documentar el riesgo residual (las reglas no pueden verificar el hash) y agregar en el panel admin la acción **«liberar correo/WhatsApp»** (borrar una llave) por si alguien queda bloqueado.
- **R4 — `/participantes_publicos` (create público).** Solo se contrastan `folio`, `categoria`, `esAficionado`, `esFemenil` y `estatusPago` con el doc privado; **`nombre`, `edad`, `rangoEdad` y `fechaRegistro` no se contrastan**, así que se puede publicar texto arbitrario en el padrón (insultos, enlaces, suplantación). **Corrección:** validar `nombre` con un conjunto de caracteres estricto (letras con acentos, espacios, punto, apóstrofo y guion) y longitud acotada, y —si es viable en reglas— que el primer nombre público coincida con el inicio del nombre privado; si no es viable, dejar al menos el filtro de caracteres y documentar la limitación. Considera **no publicar la edad exacta de menores** (dejar solo `rangoEdad`).
  - **Verifica dónde se aplica `MASK_PUBLIC_LAST_NAMES`.** Si el doc público guarda el nombre **completo** y solo la interfaz lo enmascara al mostrarlo (p. ej. «Emiliano C.»), los nombres completos siguen legibles por cualquiera desde la API de Firestore, lo que anula el objetivo de H1. El doc público debe guardar **ya enmascarado** el nombre cuando la constante esté activa.
- **R5 — Categoría contra edad.** `Juvenil` no se contrasta con la fecha de nacimiento: un adulto puede inscribirse como Juvenil saltándose la validación del cliente. **Corrección:** regla que exija, para `Juvenil`, una fecha de nacimiento posterior a la fecha de corte (ver 3.1).
- **R6 — Anonimización contra reglas.** `update` exige formato válido de correo, WhatsApp, fecha de nacimiento y `nombre` de al menos 3 caracteres, así que **«Anonimizar post-torneo» debe escribir valores que cumplan esos formatos** o las reglas lo rechazarán. Pruébalo contra las reglas (prueba nueva) y confirma también que «Purgar comprobantes» deja el participante en un estado válido (`tieneRecibo`/`reciboId` coherentes).
- **R7 — Límite de accesos a documentos por solicitud.** El registro público escribe 5 o más documentos y cada regla hace varias llamadas `get/exists/existsAfter/getAfter` (`configuracion/general` se consulta varias veces). Firestore limita esas llamadas por solicitud (10 en operaciones simples, 20 en batch). Confirma en el emulador que el batch completo de registro (incluido el caso con 2 llaves) **pasa**, y consolida las consultas repetidas si hace falta.

**Pruebas nuevas obligatorias (emulador):** comprobante sin participante nuevo → denegado; comprobante colgado de un participante existente → denegado; participante que apunta a un comprobante ajeno → denegado; llave sin participante nuevo → denegado; llave con registro cerrado → denegado; nombre público con URL o caracteres no permitidos → denegado; `Juvenil` con fecha de nacimiento de adulto → denegado; **registro completo válido (participante + público + comprobante + 2 llaves) → permitido**; anonimización por admin → permitida; purga de comprobantes por admin → permitida.

**Si el emulador no se puede correr en el entorno de la IA** (falta Java), la IA debe dejar el comando exacto y las instrucciones para correrlo en una computadora con Java 17+, y yo (el organizador) lo ejecuto antes de dar por buena esta parte.

## 3.1 Reglas y emulador
- Intenta correr `npm run test:rules`. Si falla por falta de Java o del emulador, haz que el script **falle con un mensaje claro y accionable** y documenta la instalación paso a paso para Windows, macOS y Linux (JRE ≥ 11, `firebase-tools`, `firebase emulators:exec`).
- Revisa **línea por línea** `firestore.rules` buscando: ramas que olviden `isAdmin()`, comparaciones de cadenas de fecha, expresiones regulares demasiado permisivas, campos opcionales sin validar y reglas de `participantes_publicos` y `registro_llaves` (create-only, sin `get`/`list` público). Confirma que **cada** una de las 20 pruebas definidas en la Parte 1 existe y asevera el resultado correcto.
- La fecha de corte de mayoría de edad aparece **hardcodeada** en las reglas (`'2008-12-19'`) y en el regex de `fechaNacimiento`. Guarda `fechaCorteMayoriaEdad` (formato `YYYY-MM-DD`) en `configuracion/general`, léela en reglas con `get()` y agrega pruebas de borde (nació el día del corte, un día antes, un día después).
- Confirma que `participantes_publicos` **solo** se puede crear si el mismo batch crea el participante privado y los valores coinciden (`getAfter`), y que no se puede crear uno "huérfano".

## 3.2 Recorrido funcional completo (sin saltarte pasos)
Con `npm run build && npm run preview` (y con el emulador si es posible), ejecuta y reporta:
1. Inscripción de un **adulto** y de un **menor** (con consentimiento de tutor), con comprobante JPG, PNG, WEBP y PDF; intento con archivo inválido y con archivo demasiado grande.
2. Inscripción duplicada (mismo correo; mismo WhatsApp) → mensaje amable, **sin revelar nada más**.
3. Padrón público: aparece el nuevo inscrito **sin** correo, WhatsApp ni fecha de nacimiento.
4. Cupo agotado e inscripciones cerradas (por flag y por fecha límite).
5. Panel admin: login con Google, usuario **no admin** (mensaje claro), validar pago, ver recibo (imagen y PDF), editar participante, exportar PDF y Excel (abre en Excel/LibreOffice sin fórmulas ejecutándose), purgar comprobantes, anonimizar.
6. Cierre por inactividad y cierre de sesión.
Revisa la **consola del navegador** en cada paso: cero errores de CSP, de Firestore o de React.

## 3.3 Datos que ya existen en producción (migración)
Si ya hay inscripciones en `/participantes` hechas antes de la Parte 1:
- El cierre de la Parte 1 indica que ya existe el botón **«Sincronizar padrón público»**. **Verifica** que sea solo-admin, idempotente, que genere/actualice `participantes_publicos` desde `participantes` **sin copiar campos privados** (y con el nombre ya enmascarado si `MASK_PUBLIC_LAST_NAMES` está activo), y que reporte cuántos registros procesó. Si falta algo, corrígelo.
- Maneja categorías heredadas (`Niños`, `Aficionados`, `Rankeado`, `Libre - Aficionados`, `Libre - Rankeado`) y registros **sin** campos de consentimiento: no deben romper la UI ni bloquear ediciones del admin (las reglas de `update` no deben exigir campos que los registros viejos no tienen).
- Muestra al admin cuántos registros tienen comprobante, cuántos no y cuántos faltan en el padrón público.

## 3.4 Datos de pago: nunca mostrar valores de ejemplo
La Parte 1 sustituyó la CLABE, titular y WhatsApp reales de `DEFAULT_CONFIG` por **valores de ejemplo**. Riesgo: si Firestore no tiene guardados los reales, el público vería datos falsos y podría **pagar a una cuenta inexistente**.
- Si `configuracion/general` no existe o `clabe`/`titular`/`whatsappContacto` son los valores de ejemplo, el formulario debe mostrar «Datos de pago no disponibles; contacta al organizador» y **bloquear el envío** en lugar de mostrar la cuenta de ejemplo.
- En el panel admin, aviso visible y persistente si falta alguno de esos tres datos o siguen siendo los de ejemplo.
- Prueba unitaria para esa detección.

## 3.5 Acceso de administradores
- Mensaje claro y amable para quien inicia sesión con Google pero **no** es admin («Tu cuenta no tiene permisos de administrador. Pide al organizador que te agregue»), sin revelar si otros correos son admin.
- Verifica que `docs/AUDITORIA.md` y/o `docs/PASOS-MANUALES.md` expliquen el **arranque del primer admin** (crear `/admins/{uid}` o `/admins_by_email/{correo}` desde la consola) con el orden exacto de pasos. Si no, agrégalo.
- Confirma que **no hay forma de quedar sin ningún admin** (protección del último admin también al eliminar por `admins_by_email`).

## 3.6 Hosting y CSP
- Averigua **dónde se sirve realmente la página**. El reporte menciona dominios `ais-dev-*.run.app` y `ais-pre-*.run.app` (AI Studio / Cloud Run). Las cabeceras de `firebase.json` **solo aplican si se publica en Firebase Hosting**; si el sitio se sirve desde Cloud Run, esas cabeceras (CSP incluida) **no están activas**. Resuelve una de dos: agregar las mismas cabeceras en el servidor que sirve el sitio, o documentar el paso a paso para publicar en Firebase Hosting con el dominio propio.
- La CSP actual de `script-src` solo permite `'self'` y reCAPTCHA. El inicio de sesión con Google mediante *popup* normalmente carga un script desde `https://apis.google.com`; verifica con la build de producción que el login de admin **funcione bajo la CSP** y, si hace falta, agrega solo ese origen a `script-src`.
- **Orden de App Check** (documéntalo en `PASOS-MANUALES.md`): primero publicar con la `recaptchaSiteKey` configurada, comprobar en la consola de App Check que las solicitudes llegan como *verificadas* y **solo entonces** activar el enforcement; si se activa antes, se bloquea todo el tráfico, incluidas las inscripciones. Si la consola no ofrece enforcement para Authentication en este proyecto, basta con Firestore.
- Con la build de producción, revisa que **no se bloquee** nada legítimo: Google Fonts, el *popup* de Google Auth, imágenes `data:`, Blob URL del visor de PDF, App Check/reCAPTCHA. Lista cada violación de CSP encontrada y su corrección.
- Confirma `rewrites` SPA, `Cache-Control` adecuado (assets con hash inmutables; `index.html` sin caché larga) y que `/admin` no se indexe.

## 3.7 Duplicados: limitación que las reglas no pueden cubrir
Las reglas de Firestore **no pueden calcular SHA-256**, así que no pueden verificar que `registro_llaves` corresponda al correo/WhatsApp del participante; un cliente malicioso podría omitirlas y crear duplicados.
- Documenta esta limitación en `SECURITY.md`/`docs/AUDITORIA.md` (impacto bajo: el admin valida pagos manualmente).
- Mitiga con **detección de posibles duplicados en el panel admin** (mismo correo, mismo WhatsApp o nombre muy similar), con marca visible y filtro «posibles duplicados».
- Menciona como *opción avanzada* (no implementar) la verificación con Cloud Functions (plan Blaze).

## 3.8 Calidad del código de la Parte 1
- Revisa `DRAFT_firestore.rules` y otros archivos temporales que aparecen en el historial de acciones. **No lo borres a ciegas**: puede ser parte del flujo de despliegue de reglas de AI Studio. Confirma cómo se despliegan las reglas; si el archivo no cumple función en ese flujo, elimínalo, y si la cumple, déjalo idéntico a `firestore.rules` para que no haya dos versiones distintas.
- Busca y corrige: `any`, `catch {}` vacíos, `console.log`/`console.error` con datos, código muerto, importaciones sin uso, textos duplicados, constantes repetidas (nombres de colecciones, límites, regex).
- Verifica que `handleFirestoreError` no filtre UID/correo/rutas **en ningún camino** (también en el panel admin).
- Confirma que `PrivacyNoticeModal` esté marcado como **borrador sujeto a revisión del organizador** y que el texto de retención coincida con las acciones de purga reales.

---

# 4. FASE 2 — BUGS Y ROBUSTEZ

1. **(H16) Caída por URL mal formada.** Envuelve `decodeURIComponent` en `try/catch` y añade un **Error Boundary** global en `main.tsx` con pantalla de recuperación («Algo salió mal. Recarga la página») y botón para volver al inicio. Prueba con `#admin-recibo=%`.
2. **Enrutamiento mezclado.** El código mezcla `#hash` y `pathname` (`/admin`, `/participantes`). Unifica a un esquema (ya hay `rewrites` en `firebase.json`), haz que el botón *Atrás* cierre el panel admin, que la vista se sincronice con la URL y que `#admin` no deje el modal abierto al navegar a otra vista.
3. **(H17) Seed en cada visita pública.** Mueve `seedInitialDataIfEmpty()` a una acción explícita **solo-admin** («Restaurar valores por defecto») con **ids fijos** para no duplicar patrocinadores, y que nunca sobrescriba datos de pago reales.
4. **(H18) Fechas y edades hardcodeadas.** Deriva fecha del torneo, corte de edad y textos como «nacidos a partir del 20 de diciembre de 2007» desde `config.fechaIso`/`fechaCorteMayoriaEdad`. Actualiza `calculateAgeAtTournament`, el *fallback* de `computeCountdown`, el aviso de privacidad y los mensajes de validación. Pruebas: cumpleaños el día del torneo, un día antes, un día después, año bisiesto.
5. **Validación del formulario.** Además de «Juvenil ≤ 18»: rechaza fecha futura y edades irreales (< 3 o > 100); apellido paterno y nombre obligatorios con longitud mínima; normaliza espacios y mayúsculas; correo plausible; WhatsApp de 10 dígitos (acepta espacios/guiones al escribir y los limpia).
6. **Doble envío y reintentos.** Garantiza idempotencia: dos toques en «Enviar» o un reintento tras fallo de red no crean dos registros ni dos comprobantes (reutiliza el mismo id/folio durante el intento).
7. **Mensajes de error accionables.** Distingue: sin conexión, cupo agotado, inscripciones cerradas, duplicado, archivo inválido o pesado, demasiadas solicitudes, App Check fallido. Nada técnico al usuario final.
8. **Temporizadores y *listeners*.** Limpia `setTimeout` pendientes (toasts de `AdminPanel`, cierre por inactividad), pausa el `setInterval` de `EventCountdown` cuando la pestaña no es visible y verifica que todos los `onSnapshot` se cancelen.
9. **Conteo de cupo (`getCountFromServer`).** Evita ejecutarlo en cada render o por cada visitante sin necesidad: una consulta al cargar, *refresh* ocasional, estado de carga (no mostrar «100 lugares» parpadeando) y manejo de error con valor seguro.
10. **(H19) Limpieza de `package.json`.** Renombra el proyecto (ya no `react-example`), corrige o elimina el script `clean`, confirma que **todas** las versiones declaradas existen e instalan sin conflictos (si alguna falla, fíjala a la última estable) y deja **un único lockfile**.
11. **TypeScript estricto.** Habilita `strict` en `tsconfig.json`, corrige lo que aparezca y configura ESLint con reglas de React Hooks y accesibilidad (`jsx-a11y`) sobre `eslint.config.mjs` ya existente.
12. **Rendimiento de arranque.** Carga bajo demanda (`React.lazy` + `import()`): `AdminPanel`, `jspdf`, `jspdf-autotable` y **`exceljs`** (pesada), para que el visitante normal no las descargue. Reporta el tamaño del bundle **antes y después**.
13. **`ChristmasDecorations`.** Memoiza los `Math.random()`, respeta `prefers-reduced-motion` y reduce partículas en dispositivos modestos.
14. **Carrusel de patrocinadores.** Comportamiento con 0, 1 y muchos patrocinadores; logos rotos (`onError` con *fallback*); pausa al pasar el cursor/tocar; respeta `activo` y `orden`.
15. **Panel admin.** Confirmación antes de acciones destructivas (borrar participante, comprobante, patrocinador, admin, purgar, anonimizar), mensajes de éxito/error consistentes, estado de lista vacía y de carga.
16. **Vulnerabilidades transitivas restantes.** El reporte indica `@grpc/grpc-js@1.9.16` (alta, vía `firebase`) y `uuid@8.3.2` (moderada, vía `exceljs`). Actualiza `firebase` a la última estable y, si siguen apareciendo, fija versiones parchadas con `overrides`/`resolutions`; vuelve a correr la auditoría, confirma que la app compile y funcione y reporta el resultado real.

---

# 5. FASE 3 — MEJORAS DE LA PÁGINA

## 5.1 Rendimiento (prioridad móvil) — (H20)
- Convierte las imágenes de `public/assets/aistudio/` a **WebP/AVIF**, redimensiona (cartel ≤ ~1600 px de ancho), **renómbralas** con nombres descriptivos (`cartel-2026.webp`, `convocatoria.webp`; los actuales revelan el modelo del teléfono y la app) y elimina las no usadas.
- `width`/`height` en todas las imágenes, `loading="lazy"` salvo el hero, `decoding="async"`.
- Precarga de la fuente crítica y `font-display: swap`; evalúa reducir las familias tipográficas a las necesarias.
- Objetivo medible: Lighthouse móvil ≥ 90 en Rendimiento y ≥ 95 en Accesibilidad, Buenas prácticas y SEO; LCP < 2.5 s en 4G simulada. **Reporta los números reales.**

## 5.2 SEO y compartir por WhatsApp/Facebook
- `og:image` y `twitter:image` con **URL absoluta** (WhatsApp y Facebook la exigen), `og:url`, `og:image:width/height`, `og:locale=es_MX`, `canonical`.
- Favicon, `apple-touch-icon` y `manifest` básico.
- Datos estructurados **JSON-LD `SportsEvent`** generados desde la configuración (nombre, fecha, lugar, precio, organizador).
- `robots.txt` y `sitemap.xml` sencillos; `noindex` para la vista de admin.

## 5.3 Accesibilidad (WCAG 2.1 AA)
- Navegación completa por teclado, foco visible, orden lógico.
- **Trampa de foco y cierre con `Esc`** en todos los modales (aviso de privacidad, registro exitoso, visor de recibos, panel admin).
- `aria-label` en botones de solo ícono; `role="status"`/`aria-live` para toasts y errores; `aria-invalid` y `aria-describedby` en campos con error.
- Contraste suficiente sobre verde/ámbar; no depender solo del color para estados.
- Respetar `prefers-reduced-motion` (nieve, luces, cuenta regresiva, carrusel).
- `alt` útil en cartel, convocatoria y logos; `label` asociado a cada campo y `autocomplete` correcto (`name`, `email`, `tel`, `bday`).

## 5.4 Experiencia de registro
- Indicador de **progreso** y resumen final antes de enviar.
- Inputs optimizados para móvil: `inputMode="numeric"` en WhatsApp, `type="email"`, `type="date"` con mínimo/máximo.
- Subida del comprobante con **estado de procesamiento**, vista previa, botón para cambiar y mensaje claro si es muy pesado.
- Pantalla de éxito con **folio copiable**, resumen de datos, instrucciones de pago y botón de WhatsApp prellenado hacia el organizador.
- **Lista de espera** cuando se agote el cupo (en lugar de solo cerrar el formulario), con las mismas protecciones de privacidad y reglas que el registro normal.
- Cierre automático de inscripciones por `fechaLimiteTimestamp`, con mensaje claro y cuenta regresiva al cierre.
- Botón **«Copiar CLABE»** con confirmación visual y *fallback* sin `navigator.clipboard` (iOS/Android).
- Autoguardado del borrador **solo en memoria de sesión** (nunca datos sensibles en almacenamiento persistente).

## 5.5 Panel de administración
- Registrar **quién y cuándo** marcó un pago (`pagadoPor`, `pagadoEn`) y un **historial de cambios** por participante (validado en reglas).
- Filtros por categoría, estatus de pago, «sin recibo» y «posibles duplicados»; búsqueda rápida; **acciones en lote** (marcar pagados, exportar selección).
- **Borrado suave** (papelera con restauración) para evitar pérdidas por accidente.
- Botón de **respaldo completo** (JSON/Excel) con advertencia de confidencialidad.
- **Check-in del día del torneo** (marcar asistencia), usable desde tablet/celular.
- Exportación lista para el software de emparejamientos que use el club (sistema suizo).
- Vista de **estadísticas** (inscritos por categoría, pagados vs. pendientes, recaudación confirmada vs. esperada).
- Revisión de comprobantes con zoom/rotación y atajo «aprobar y siguiente».

## 5.6 Contenido y confianza
- Sección de **preguntas frecuentes** (cómo pagar, qué pasa si no aparezco en la lista, edad para Juvenil, qué llevar, reloj/tablero, cancelaciones).
- Estado de inscripción (abiertas/cerradas/cupo/lista de espera) mostrado **en un solo lugar coherente**.
- Enlace al aviso de privacidad y contacto visible en el pie de página.
- Borrador de **política de devolución/cancelación** (el organizador la define).

## 5.7 Calidad de código y mantenibilidad
- Divide los componentes más grandes (`RegistrationForm`, `AdminParticipantsTab`, `ParticipantsPage`) en piezas y *hooks* (`useRegistrationForm`, `useParticipants`), **sin alterar la apariencia**.
- Reemplaza `any`/`catch (err: any)` por tipos correctos y centraliza el manejo de errores y los textos en español.
- Constantes en un solo lugar (colecciones, límites de tamaño, categorías, expresiones regulares).

---

# 6. FORMATO DE LA RESPUESTA AL TERMINAR LA PARTE 2

1. **Resumen ejecutivo** (máx. 10 líneas): qué mejoró, qué regresiones de la Parte 1 se encontraron y qué riesgos permanecen.
2. **Tabla**: *punto (3.x / 4.x / 5.x) → archivos modificados → estado* (`corregido` / `pendiente manual` / `descartado` + motivo).
3. `firestore.rules` **completo** (si cambió) y el resultado **real** de `npm run lint`, `build`, `test`, `test:rules` (o el motivo exacto por el que no corrió).
4. **Números reales** de Lighthouse (móvil) y del tamaño del bundle antes/después.
5. **Pasos manuales nuevos**, redactados para alguien no experto.
6. **Lo que no pudiste hacer o dejaste para después**, con prioridad sugerida.
7. **Decisiones que debe tomar el organizador** (p. ej.: ¿lista de espera sí/no?, ¿nombre completo o abreviado en el padrón?, ¿política de devolución?, ¿exportación para el software de emparejamientos?).

**Cuando termines, detente y espera la Parte 3.** No empieces CI/CD, pruebas extremo a extremo ni documentación final por tu cuenta.
