# PARTE 3 DE 3 (FINAL) — Cierre de riesgos, PRUEBAS, CLOUDFLARE PAGES, CI/CD y DOCUMENTACIÓN
## Proyecto: «Torneo del Pavo 2.0»

> **Cómo usarlo:** pega todo lo que está bajo la línea en el **mismo asistente y proyecto** donde terminó la Parte 2. Es la **última parte**. No agrega funciones nuevas: cierra riesgos, **migra la publicación a Cloudflare Pages**, deja todo **verificable** y **operable** por el organizador (una persona sin perfil técnico) y entrega la documentación final.

---

# 0. ROL, DECISIONES Y ALCANCE

Mantén los tres perfiles: **ingeniero full-stack senior**, **auditor de seguridad** y **QA / DevOps**.

## 0.1 Decisión de hosting (ya tomada)
El sitio se publicará en **Cloudflare Pages** (plan gratuito), con **Firestore y Auth de Firebase en el plan gratuito (Spark)**. **Firebase Hosting deja de ser el destino de publicación**: no uses `firebase deploy --only hosting` y elimina del `firebase.json` la sección `hosting` (conserva solo lo de Firestore). Las reglas de Firestore se siguen desplegando a la **base con nombre**.

> **Nota técnica importante:** Cloudflare ahora recomienda *Workers Static Assets* para proyectos nuevos, aunque Pages sigue funcionando. Implementa **Pages** (decisión del organizador) pero deja todo preparado para que migrar a Workers sea trivial: `_headers` y `_redirects` funcionan igual en ambos; solo cambia el archivo de configuración (ver 5.3.7).

## 0.2 Alcance de esta parte
1. Cerrar los riesgos que dejó abiertos la Parte 2 (sección 3).
2. Dejar las pruebas **ejecutables sin que el organizador instale Java**, usando integración continua (sección 4).
3. **Implementar la publicación en Cloudflare Pages**, CI/CD y entornos (sección 5).
4. Preparar la prueba de humo, el plan de capacidad y la lista de lanzamiento (sección 6).
5. Entregar la documentación final y el reporte consolidado (secciones 7 y 8).

**Fuera de alcance:** funciones nuevas, rediseños, cambios de textos oficiales. Si encuentras un bug, **repórtalo**; arréglalo solo si es pequeño y queda con prueba.

**Contexto (recordatorio):** web del torneo de ajedrez del Club de Ajedrez Don Gonzalo (Durango, Dgo.), **sábado 19 de diciembre de 2026, 16:30 h**. Inscripción con comprobante de pago y cupo (100 por defecto), padrón público sin datos privados, panel admin. Stack: React 19 + Vite + TypeScript + Tailwind; Firebase (proyecto `yogic-decoder-5lxdt`, Firestore en la **base con nombre** `ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2`, Auth con Google). Se manejan datos de **menores de edad** y comprobantes de pago.

---

# 1. ESTADO ESPERADO TRAS LA PARTE 2 (VERIFÍCALO, NO LO DES POR HECHO)

Según el cierre de la Parte 2 deberían existir: reglas con R1–R7 corregidas y **`/lista_espera`**; 32 vectores de prueba (`V1–V32`) en `tests/rules/firestore.rules.test.ts`; `scripts/run-rules-tests.mjs`; `ErrorBoundary`; enrutamiento unificado; seed solo-admin; cortes de edad dinámicos (`fechaCorteMayoriaEdad`, `fechaCorteJuvenil`); hooks `useRegistrationForm`/`useParticipants`/`useFocusTrap`; carga diferida de `AdminPanel`, `jspdf`, `html2canvas` y `exceljs`; imágenes WebP; SEO (JSON-LD `SportsEvent`, `robots.txt`, `sitemap.xml`, manifest); lista de espera; panel con auditoría de pagos, papelera, check-in, exportación para sistema suizo y detección de duplicados; `docs/AUDITORIA.md` y `docs/PASOS-MANUALES.md`; CSP y cabeceras en `firebase.json` y en `vite preview` (`vite.config.ts`).

**Resultados reportados:** lint, `lint:rules`, 17/17 pruebas unitarias, build y `bun audit` aprobados. **NO se ejecutó:** `npm run test:rules` (falta Java), Lighthouse (solo tiempos locales), ni la prueba de humo con escritura real en producción.

---

# 2. REGLAS DE TRABAJO (OBLIGATORIAS)

1. **No cambies el diseño visual, la identidad ni los textos oficiales** del torneo.
2. **Nunca declares que algo «pasa», «funciona» o «está desplegado» si no lo ejecutaste o verificaste tú.** Si no puedes (sin Java, sin navegador con Lighthouse, sin acceso a Cloudflare o a la consola de Firebase), dilo y deja el paso exacto para quien sí pueda. Es preferible un «no verificado» honesto a un «aprobado» inventado.
3. **Verifica antes de cambiar**; si un hallazgo no aplica, dilo y justifícalo.
4. **Cambios pequeños y revisables**, con mensaje claro; cualquier cambio en `firestore.rules` se entrega **completo** y con su prueba.
5. **Sin dependencias nuevas innecesarias**; todo debe poder funcionar con planes gratuitos (Cloudflare Pages, Firebase Spark, GitHub Actions).
6. **Nunca imprimas ni commitees secretos** (tokens, llaves de servicio, CLABE, teléfonos). Los secretos de CI van en *GitHub Secrets*.
7. **Texto visible en español de México**, sin tecnicismos para el organizador.
8. **No reabras lo ya blindado**: ningún cambio puede permitir lectura pública de `/participantes`, `/comprobantes`, `/registro_llaves` ni `/lista_espera`.
9. **Las cabeceras de seguridad tienen UNA sola fuente de verdad** (ver 5.3.2): nada de CSP escrita a mano en tres lugares distintos.
10. **Si tu respuesta final es muy larga, escríbela completa en `docs/PARTE_3_REPORTE.txt`** y en el chat deja solo un resumen y la ruta del archivo (la respuesta de la Parte 1 se cortó por longitud).

### Definición de terminado para la Parte 3
- [ ] CI en verde en un *push* real: lint, tipos, unitarias, **pruebas de reglas con emulador**, build, auditoría, E2E.
- [ ] Las 32 pruebas de reglas ejecutadas **de verdad** (en CI o localmente) y reportadas con su salida real.
- [ ] La build de producción contiene `_headers` correcto y funciona con rutas profundas (`/admin`, `/participantes`) sin 404.
- [ ] Prueba de humo en producción documentada como lista de verificación paso a paso.
- [ ] Documentación final completa en `docs/` y reporte consolidado entregado.
- [ ] Ningún secreto en el repositorio ni en el historial reciente (revisión explícita).

---

# 3. FASE 5.0 — CIERRE DE RIESGOS DE LA PARTE 2

Reporta cada punto como `ok` / `corregido` / `pendiente manual`, con prueba cuando aplique.

## 3.1 Nombre privado vs. nombre público (riesgo de bloquear TODAS las inscripciones)
La regla `validatePublicRosterMatch` exige que la **primera palabra** del nombre público coincida con la primera palabra del nombre privado. Si el nombre privado se guarda en un orden (p. ej. «paterno materno nombres») y el público enmascarado se genera en otro (p. ej. «Nombre A.»), **la regla rechazaría cada inscripción real**.
- Revisa el orden real con el que se construyen ambos nombres en `RegistrationForm`/`useRegistrationForm`/`tournamentService`/`tournamentUtils`, y genera **ambos desde una única función** compartida.
- Pruebas unitarias **y** de reglas con casos reales: nombres compuestos («María José»), apellidos con partículas («De la Cruz», «Del Río»), apóstrofos y guiones, un solo nombre, acentos y `ñ`, y letras como `ë`, `ï`, `ç`.
- El filtro de caracteres de nombres públicos solo permite un conjunto limitado de letras latinas; evalúa ampliarlo con propiedades Unicode de letra si el motor de expresiones de las reglas lo soporta (verifícalo en el emulador). Una persona con nombre válido **no debe quedar fuera** por la regla.
- Prueba obligatoria del **camino feliz completo** (participante + público + comprobante + llaves) con el flujo real del cliente, no con datos fabricados a mano.

## 3.2 Lista de espera (`/lista_espera`)
La creación pública solo exige registro abierto y datos válidos; ningún documento la ata a un registro real, así que se puede llenar de basura (la única barrera es App Check).
- Haz el id del documento **determinista** (hash del correo normalizado) para que el mismo correo no genere entradas repetidas desde el cliente legítimo.
- Documenta el riesgo residual en `SECURITY.md` (las reglas no pueden contar documentos ni verificar el hash) y agrega en el panel admin un botón para **vaciar entradas convertidas/antiguas**.
- Prueba que un menor en lista de espera también exige consentimiento de tutor y que la categoría sea coherente con la edad.

## 3.3 Operaciones admin en lote y el límite de accesos de las reglas
Firestore limita las llamadas de acceso a documentos desde las reglas por solicitud (10 en operaciones simples, 20 en lotes). Cada escritura de admin llama `isAdmin()` (varias lecturas) y otras funciones.
- Prueba en el emulador **cada operación en lote del panel**: «Sincronizar padrón público», borrado/papelera, purga de comprobantes, anonimización, acciones en lote (marcar pagados), restauración. Usa tamaños reales (10, 25, 50 y 100 registros).
- Fija el **tamaño de lote seguro** que resulte de las pruebas, hazlo una constante configurable y haz que las operaciones largas se **fragmenten** y muestren progreso («procesados 40 de 100») sin quedar a medias.

## 3.4 Despliegue real de las reglas
El reporte afirma que las reglas están desplegadas en la base con nombre. Eso **no se puede dar por hecho**.
- Deja un paso manual de verificación: Firebase Console → Firestore → base con nombre → *Reglas*; confirmar que el texto coincide con `firestore.rules` del repositorio.
- El despliegue de reglas (manual con CLI o por CI) debe apuntar **siempre a la base con nombre**, nunca a `(default)`.

## 3.5 Instalación desde cero y versiones
- En un directorio limpio: instala con el lockfile **congelado** (`bun install --frozen-lockfile` o `npm ci`), luego lint, tipos, pruebas y build. Verifica que **todas** las versiones fijadas existen e instalan (incluidas `firebase`, `react-hooks`, `jsx-a11y`, `exceljs`, `tsx`), y ejecuta `bun audit` **y** `npm audit`. Deja clara en el README la convención de gestor de paquetes y que haya **un solo lockfile**.
- Reporta el resultado real, no el esperado.

## 3.6 Lecturas de Firestore del padrón
En el plan gratuito de Firebase las lecturas diarias son limitadas (**verifica las cuotas vigentes en la documentación oficial** antes de documentarlas). Cada visita al padrón con un listener en tiempo real lee todos los inscritos.
- Revisa `useParticipants` y el padrón público: escucha en tiempo real **solo mientras la pestaña está visible**, sin listeners duplicados, con consulta acotada y, si conviene, caché breve en memoria de sesión (p. ej. 60 s).
- Documenta una estimación de lecturas por visita y por día en `docs/PLAN-DE-CAPACIDAD.md` (6.3).

---

# 4. FASE 5.1 — PRUEBAS EJECUTABLES SIN INSTALAR JAVA

El organizador no tiene Java; el contenedor de la IA tampoco. La solución es la **integración continua de GitHub Actions**, que sí lo incluye.

## 4.1 Pruebas de reglas con emulador
- `npm run test:rules` debe correr en CI con `firebase emulators:exec` (Firestore). Si el script actual depende de que exista Java local, que **además** funcione en CI sin cambios manuales.
- Opcional: `docker-compose`/script para correr el emulador localmente sin instalar Java.
- Revisa que cada uno de los **32 vectores** tenga aserciones correctas (`assertSucceeds`/`assertFails`) y que el camino feliz sea **realista** (3.1). Añade los que falten por 3.2 y 3.3.
- **Muestra la salida real** de la ejecución en CI en el reporte (conteo de pruebas aprobadas y falladas).

## 4.2 Pruebas extremo a extremo (Playwright)
Contra la build de producción local y el **emulador** de Firestore/Auth, con datos sintéticos (sin datos personales reales). Flujos mínimos:
1. Inscripción de adulto y de menor (con tutor), con comprobante JPG, PNG, WEBP y PDF; archivo inválido y archivo demasiado grande.
2. Duplicado por correo y por WhatsApp → mensaje amable, sin revelar nada más.
3. Padrón público: el nuevo inscrito aparece **sin** correo, WhatsApp, fecha de nacimiento ni edad exacta de menores.
4. Cupo agotado → lista de espera; inscripciones cerradas (por bandera y por fecha límite).
5. Datos de pago de ejemplo → formulario bloqueado.
6. Admin: usuario no admin (mensaje claro), validar pago, ver recibo (imagen y **PDF dentro del visor bajo la CSP**), editar, exportar PDF/Excel/Suizo, papelera y restauración, purgar, anonimizar.
7. URL malformada (`#admin-recibo=%`) → sin caída.
8. **Rutas profundas** (`/admin`, `/participantes`) cargadas directamente (recarga con F5) → sin 404.
9. Intentos de abuso desde el navegador: leer `/participantes`, subir `data:text/html`, campos extra → todos denegados.
10. Accesibilidad con `axe` sobre las vistas principales (sin violaciones graves).

## 4.3 Lighthouse real
Configura **Lighthouse CI** en el pipeline (sobre la build de producción) con umbrales: Rendimiento ≥ 90, Accesibilidad ≥ 95, Buenas prácticas ≥ 95, SEO ≥ 95. Si no es viable, deja las instrucciones para correr PageSpeed Insights sobre la URL pública y **no inventes puntajes**.

---

# 5. FASE 5.2 — CLOUDFLARE PAGES, CI/CD Y ENTORNOS

## 5.1 Pipeline de calidad (GitHub Actions)
Workflow en `.github/workflows/ci.yml` que, en cada *push* y *pull request*:
1. instale dependencias con lockfile congelado y caché;
2. ejecute lint, tipos y pruebas unitarias;
3. ejecute las **pruebas de reglas con emulador** (con Java 17 en el *runner*);
4. compile (`build`) y ejecute la auditoría de dependencias (falla ante vulnerabilidades altas o críticas);
5. ejecute E2E (4.2) y, si es viable, Lighthouse CI (4.3).
- **Seguridad del propio pipeline:** `permissions: contents: read` por defecto, acciones fijadas a una versión exacta (idealmente por SHA), sin secretos expuestos a código de *forks*, y sin imprimir variables.
- Recomienda (y documenta cómo activar) **protección de la rama principal** exigiendo que pase este workflow antes de fusionar.
- Activa actualizaciones automáticas de dependencias (Dependabot o equivalente) con revisión semanal.

## 5.2 Cómo se despliega (modo recomendado: integración Git de Cloudflare Pages)
- **Producción** = rama `main`; **vistas previas** = cualquier otra rama o *pull request*. Cloudflare construye y publica solo, **sin tokens en GitHub**.
- Como Pages despliega aunque el CI falle, la barrera es la **protección de la rama principal** (5.1): solo se fusiona a `main` con CI en verde.
- *Modo alterno (opcional, solo si el organizador quiere despliegue condicionado al CI):* trabajo de GitHub Actions con `wrangler pages deploy dist` tras pasar todo, usando `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en *GitHub Secrets*, token con el **mínimo de permisos** (solo Pages: editar). Documenta ambos, recomienda el primero por simple.
- **Reglas de Firestore:** se despliegan aparte: `firebase deploy --only firestore:rules --project yogic-decoder-5lxdt` desde una computadora autenticada, o desde CI **solo si** el organizador acepta crear una cuenta de servicio de permisos mínimos; en ese caso, trabajo separado que se ejecute **solo en `main`**. Verifica siempre el despliegue con 3.4.

## 5.3 IMPLEMENTACIÓN PARA CLOUDFLARE PAGES

### 5.3.1 Cambios en el proyecto (haz todos)
1. **`firebase.json`:** elimina `hosting` (cabeceras, rewrites, `public`). Conserva solo el bloque de Firestore (reglas e índices hacia la **base con nombre**).
2. **`public/_headers`:** archivo con cabeceras de seguridad y caché (ver 5.3.2). Debe terminar en `dist/_headers` tras el build.
3. **Rutas de aplicación de una sola página (SPA):** Pages sirve `index.html` para rutas que no existen **siempre que NO exista un `404.html` en la salida**. Por tanto: **no crees `404.html`** y **no añadas** una regla `/* /index.html 200` en `_redirects` (puede provocar bucles). Si usas `_redirects`, solo para redirecciones concretas.
4. **URL del sitio única:** crea la variable `VITE_SITE_URL` (p. ej. `https://torneo-del-pavo.pages.dev` o el dominio propio) y úsala en:
   - `index.html` mediante la sintaxis de reemplazo de variables de Vite (`canonical`, `og:url`, `og:image`, `twitter:image`);
   - el JSON-LD `SportsEvent` (en `App.tsx`);
   - un script de *prebuild* `scripts/generate-seo-files.mjs` que **genere** `public/robots.txt` (permitir todo salvo `/admin`, con la línea `Sitemap:`) y `public/sitemap.xml` (`/` y `/participantes`) a partir de esa variable.
   - **La build de producción debe fallar con un mensaje claro si `VITE_SITE_URL` no está definida**, para que nunca se publique con una URL equivocada (hoy esas URLs apuntan al dominio de AI Studio/Firebase).
5. **Versión de Node y gestor de paquetes:** crea `.node-version` (o `.nvmrc`) con la versión usada localmente y documenta las variables de entorno de Pages (`NODE_VERSION`, y `BUN_VERSION` si el lockfile es de bun). **Riesgo conocido:** el repositorio solo tiene `bun.lock` (formato de texto, requiere una versión reciente de bun). Verifica cómo detecta Cloudflare el gestor; si falla, usa el comando de build explícito (`bun install --frozen-lockfile && bun run build`) y fija `BUN_VERSION`, o migra a `package-lock.json` + `npm ci` y actualiza el README. Elige lo que **funcione de verdad en la build de Cloudflare** y documenta la elección.
6. **Selección de entorno sin tocar código:** `VITE_APP_ENV` (`production` | `staging`). El archivo de configuración de Firebase de pruebas (proyecto staging, 5.5) se elige por esa variable; en Pages, el entorno **Production** usa `production` y **Preview** usa `staging`. Nada de llaves privadas: la configuración web de Firebase es pública por diseño, pero debe estar restringida (5.4).
7. **Quita referencias a Firebase Hosting** en README, `docs/PASOS-MANUALES.md`, `docs/AUDITORIA.md`, scripts de `package.json` y comentarios (p. ej. el paso «`firebase deploy --only hosting,firestore`»).

### 5.3.2 Una sola fuente de verdad para las cabeceras
- Crea `scripts/security-headers.mjs` que exporte el objeto de cabeceras (incluida la CSP). De ahí salen: (a) el **`public/_headers`** (generado en el *prebuild*), y (b) las cabeceras de **`vite preview`/`vite dev`** en `vite.config.ts`. Así lo probado localmente es lo que se publica.
- **Línea base de `_headers`** (concilia con la CSP que ya existe en `firebase.json`/`vite.config.ts`; debe ser un **superconjunto funcional**, y **reemplaza `TU-AUTH-DOMAIN` por el `authDomain` real de `firebase-applet-config.json`**):

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseappcheck.googleapis.com https://www.googleapis.com https://www.google.com; frame-src 'self' blob: https://accounts.google.com https://TU-AUTH-DOMAIN https://www.google.com https://recaptcha.google.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache

/admin
  X-Robots-Tag: noindex, nofollow

/admin/*
  X-Robots-Tag: noindex, nofollow
```
- **Reglas que debes respetar:**
  - **No pongas `Cross-Origin-Opener-Policy: same-origin`** (rompe el inicio de sesión con ventana emergente de Google).
  - Verifica que la línea de la CSP **no exceda el límite de longitud por línea** ni el máximo de reglas de `_headers` documentados por Cloudflare (consulta la documentación vigente).
  - La CSP no debe permitir `unsafe-inline` ni `unsafe-eval` en `script-src`. Si una librería lo exige, **repórtalo** en vez de abrirlo.
  - Conserva la compatibilidad con: login de admin (Google), App Check (reCAPTCHA Enterprise), Firestore, Google Fonts, vista previa y descarga de PDF mediante `blob:` en iframe con `sandbox`, y las imágenes `data:` de comprobantes y logos.
  - Al probar, **añade solo lo que el navegador reporte como bloqueado y sea legítimo**; documenta cada origen agregado y por qué.

### 5.3.3 Configuración en el panel de Cloudflare (pasos para el organizador, en `docs/DESPLIEGUE-CLOUDFLARE.md`)
Redáctalos paso a paso, con el valor exacto de cada campo:
1. Crear cuenta gratuita de Cloudflare.
2. *Workers & Pages → Crear → Pages → Conectar a Git* y autorizar solo el repositorio del torneo (recomienda **repositorio privado**).
3. **Rama de producción:** `main`. **Comando de build:** el que resultó en 5.3.1-5. **Directorio de salida:** `dist`. **Directorio raíz:** `/`.
4. **Variables de entorno** (Producción y Vista previa por separado): `NODE_VERSION`, `BUN_VERSION` (si aplica), `VITE_SITE_URL`, `VITE_APP_ENV`.
5. Primera publicación y anotar la URL `*.pages.dev` resultante; actualizar `VITE_SITE_URL` con esa URL (o con el dominio propio) y **volver a desplegar**.
6. *(Opcional)* Dominio propio: registrarlo (o conectarlo si ya existe), agregarlo en **Dominios personalizados** del proyecto y esperar la verificación; actualizar `VITE_SITE_URL`, `canonical`, `sitemap` y los dominios de Firebase (5.4).
7. Comprobar que la **vista previa** de una rama funciona y que **producción** solo cambia al fusionar a `main`.

### 5.3.4 Pruebas específicas de Cloudflare (obligatorias, con evidencia)
- Con la **URL publicada**: `curl -I` a `/`, `/assets/<archivo>.js`, `/admin` y `/participantes` mostrando las cabeceras reales (CSP, caché, `X-Robots-Tag`); y confirmar que `/admin` y `/participantes` devuelven la aplicación (no 404) también al recargar.
- **Login de admin** bajo la CSP en: Chrome de escritorio, **Chrome móvil y Safari de iPhone** (la ventana emergente de Google es el punto más frágil al cambiar de dominio).
- Inscripción de prueba completa con comprobante de imagen y de PDF, y apertura del PDF en el visor.
- Que `robots.txt`, `sitemap.xml`, `canonical` y las etiquetas de compartir (WhatsApp/Facebook) apunten al dominio **final**.
- Si no puedes ejecutar algo (no tienes la URL ni acceso), déjalo como **lista de verificación** en `docs/PRUEBA-DE-HUMO.md`, sin darlo por hecho.

### 5.3.5 Límites del plan gratuito
En `docs/PLAN-DE-CAPACIDAD.md` documenta, **con las cifras vigentes verificadas en la documentación oficial de Cloudflare y con fecha de consulta**: ancho de banda y solicitudes, número de *builds* por mes, límites de archivos y tamaño por archivo. No asumas valores de memoria.

### 5.3.6 Qué NO se migra
Firestore, Auth, App Check y las reglas **se quedan en Firebase** (plan Spark). Cloudflare solo sirve los archivos estáticos.

### 5.3.7 Plan B: Workers Static Assets (solo documentar, no implementar)
Deja en `docs/DESPLIEGUE-CLOUDFLARE.md` una sección con el archivo `wrangler.jsonc` equivalente (carpeta `dist`, modo de aplicación de una sola página para rutas no encontradas) y la nota de que `_headers` y `_redirects` se reutilizan sin cambios, por si el organizador decide migrar más adelante.

## 5.4 Configuración posterior al cambio de dominio (obligatoria)
Con cada dominio nuevo (`*.pages.dev` y, si aplica, el propio):
1. Firebase Auth → **Dominios autorizados**: agregar el dominio. *Las vistas previas de Pages tienen subdominios únicos que no se pueden autorizar uno por uno; el login de admin se prueba en producción o en el proyecto de pruebas.* Quita los dominios de AI Studio (`ais-dev-*`, `ais-pre-*`) cuando termine la migración.
2. **App Check:** registrar el dominio en el sitio de reCAPTCHA (**Enterprise para integraciones nuevas**) y respetar el orden: publicar con la llave → comprobar solicitudes **verificadas** → **solo entonces** activar *enforcement*.
3. **Restricción de la API key** por *referrer* HTTP: el dominio definitivo (y el `*.pages.dev`, y `http://localhost:*` solo mientras se desarrolla).
4. Revisar de nuevo el login de admin bajo la CSP (5.3.4).

## 5.5 Entornos y datos de prueba
- **Producción** y **pruebas (staging)**: un segundo proyecto de Firebase gratuito para ensayar sin tocar datos reales; alias en `.firebaserc`; el entorno **Preview** de Pages usa la configuración de staging (5.3.1-6).
- **Desarrollo local con emulador:** scripts `dev:emulator` y un **script de datos de prueba** (≈50 inscritos ficticios, menores y adultos, algunos con comprobante pequeño, lista de espera) sin ninguna información real.
- Ensayo de carga ligero en staging/emulador: simular ~100 inscripciones seguidas y comprobar cupo, lista de espera, conteo y tiempos.

## 5.6 Monitoreo y respuesta (sin gasto)
- Cómo ver el **uso diario de Firebase** (lecturas/escrituras) y las solicitudes no verificadas de App Check; cómo ver las analíticas básicas y errores de despliegue en Cloudflare.
- Qué hacer si se **agota la cuota gratuita** durante el evento (bajar actualizaciones en tiempo real, cerrar el padrón en vivo, anunciar por WhatsApp).
- Cómo **revertir** una publicación defectuosa en Cloudflare (volver a un despliegue anterior desde el historial de despliegues) en menos de 5 minutos.

---

# 6. FASE 5.3 — LANZAMIENTO

## 6.1 Prueba de humo en producción (`docs/PRUEBA-DE-HUMO.md`)
Lista con casillas, en orden, para hacerse **después** de configurar al primer admin y los datos de pago reales, sobre la **URL publicada en Cloudflare**:
1. Entrar a `/admin` con Google y confirmar que no marca error de permisos.
2. Capturar CLABE, banco, titular y WhatsApp **reales**; confirmar que el formulario público se desbloquea y muestra los datos correctos (y **ninguno de ejemplo**).
3. Inscribir un jugador adulto de prueba con comprobante real pequeño; inscribir un menor de prueba con tutor.
4. Verlos en el padrón público (sin datos privados) y en el panel (con datos completos y recibo).
5. Marcar uno como pagado, exportar Excel/PDF/JSON y comprobar que abren sin fórmulas ejecutables.
6. Intentar inscribir el mismo correo/WhatsApp → mensaje de duplicado.
7. Borrar los registros de prueba desde el panel y confirmar que no quedan en el padrón ni en las llaves.
8. Probar desde un **celular real en datos móviles** (no solo WiFi): carga, formulario, subida del comprobante, **login de admin en Safari/iPhone y Chrome móvil**.
9. Comprobar compartir por WhatsApp (tarjeta con imagen y título correctos, apuntando al dominio final).
10. Revisar la consola del navegador sin errores y correr PageSpeed Insights sobre la URL final (anotar puntajes reales).

## 6.2 Orden de configuración manual (por dependencias, en `docs/PASOS-MANUALES.md`)
1. Crear al primer admin en `admins_by_email` (sin esto nadie entra al panel).
2. Capturar datos de pago reales y fechas/cortes de edad (sin esto el formulario queda bloqueado).
3. Publicar y verificar reglas (3.4).
4. Publicar el sitio en Cloudflare Pages (5.3.3) y anotar la URL definitiva.
5. Configuración posterior al dominio (5.4): dominios de Auth, reCAPTCHA y API key.
6. Sincronizar el padrón si había registros previos.
7. App Check: publicar con la llave, **comprobar solicitudes verificadas** y **solo entonces** activar *enforcement*.
8. Endurecer Auth: solo Google, desactivar correo/contraseña.
9. Correr la prueba de humo (6.1).
10. Anunciar la página.

## 6.3 Plan de capacidad (`docs/PLAN-DE-CAPACIDAD.md`)
Con las **cuotas vigentes verificadas en la documentación oficial** de Firebase y de Cloudflare (cita la fecha de consulta): visitas diarias esperadas, lecturas por visita al padrón y al formulario, escrituras por inscripción (≈5 documentos), peso de la página, evaluaciones de reCAPTCHA, *builds* por mes y transferencia. Indica el margen frente a cada límite gratuito y qué hacer si se acerca (3.6, 5.6).

## 6.4 Calendario de operación (`docs/LANZAMIENTO-CHECKLIST.md`)
Lista de *go/no-go* con fechas relativas al evento (**19 de diciembre de 2026**): congelamiento de cambios, prueba de humo, apertura/cierre de inscripciones, respaldo previo al evento (Excel/JSON), **check-in el día del torneo** (desde celular o tablet), exportación para el sistema suizo, y **posttorneo**: respaldo final, «Purgar comprobantes» y «Anonimizar post-torneo» dentro del plazo del Aviso de Privacidad, cierre de la lista de espera y baja del padrón.

---

# 7. FASE 5.4 — DOCUMENTACIÓN FINAL

Entrega, claros y sin relleno:

- **`README.md`**: qué es, requisitos, instalación, scripts, cómo correr con emulador, **cómo se publica en Cloudflare Pages**, cómo desplegar las reglas **a la base con nombre**, estructura del código, convención de gestor de paquetes y lockfile.
- **`SECURITY.md`**: modelo de amenazas resumido; qué protege cada regla y cada cabecera; riesgos residuales aceptados (duplicados no verificables por reglas, lista de espera, spam mitigado por App Check, datos de pago públicos por diseño); cómo reportar un problema.
- **`docs/AUDITORIA.md`** (final): línea base, todos los hallazgos **H1–H21 y R1–R7** con estado real y lo pendiente.
- **`docs/DESPLIEGUE-CLOUDFLARE.md`**: pasos de 5.3.3, variables de entorno, reversión de publicación, Plan B (5.3.7) y solución de problemas comunes (build que falla por gestor de paquetes, 404 en rutas, login que no abre, CSP que bloquea algo).
- **`docs/GUIA-ADMIN.md`**: guía del organizador **sin conocimientos técnicos**, con pasos numerados: entrar, validar pagos, ver comprobantes, agregar/quitar admins, lista de espera, duplicados y «liberar correo/WhatsApp», exportar, check-in del torneo, papelera, respaldo, purga y anonimización.
- **`docs/PASOS-MANUALES.md`** (final, ordenado según 6.2), **`docs/PRUEBA-DE-HUMO.md`**, **`docs/PLAN-DE-CAPACIDAD.md`**, **`docs/LANZAMIENTO-CHECKLIST.md`**.
- **`docs/RUNBOOK-INCIDENTES.md`**: qué hacer ante (a) sospecha de filtración de datos (cerrar inscripciones, revisar accesos de admin, rotar credenciales, avisar a los afectados), (b) spam o abuso, (c) cuota agotada, (d) **bloqueo de acceso de admin** (recuperarlo creando de nuevo el documento de admin desde la consola), (e) comprobante o dato publicado por error, (f) publicación defectuosa en Cloudflare (revertir).
- **`CHANGELOG.md`** resumido de las tres partes.
- **Revisión de secretos:** busca en el repositorio y en el historial reciente tokens, llaves de servicio, la CLABE, el titular y teléfonos reales; reporta lo encontrado y los pasos para limpiarlo si hay algo.

---

# 8. FORMATO DE LA RESPUESTA FINAL (ENTREGA CONSOLIDADA)

Escribe todo en `docs/PARTE_3_REPORTE.txt` y en el chat deja el resumen y la ruta. Debe incluir:

1. **Resumen ejecutivo** (máx. 10 líneas) en lenguaje sencillo: ¿está listo para lanzar?, ¿qué falta?
2. **Tabla consolidada final**: *hallazgo (H#, R#, 3.x, 4.x, 5.x) → estado real* (`corregido y verificado` / `corregido sin verificar` / `pendiente manual` / `descartado`), distinguiendo **verificado por ti** de **no verificado**.
3. **Lista de archivos creados o modificados para Cloudflare Pages** (`public/_headers`, `scripts/security-headers.mjs`, `scripts/generate-seo-files.mjs`, `.node-version`, `firebase.json`, `vite.config.ts`, `index.html`, `App.tsx`, workflow de CI, documentación) y el contenido final de `_headers`, indicando **cuáles orígenes de la CSP se añadieron o quitaron respecto de la línea base y por qué**.
4. **Resultados reales** de CI: unitarias, **pruebas de reglas (conteo)**, E2E, auditoría, build y Lighthouse (o por qué no corrieron). Sin cifras estimadas.
5. **Resultados de 5.3.4** (cabeceras reales con `curl`, rutas profundas, login en navegadores) o la lista de verificación pendiente si no tuviste acceso.
6. **`firestore.rules` final completo** (si cambió) y la lista de cambios respecto de la Parte 2.
7. **Riesgos residuales** (tabla: riesgo, impacto, mitigación, quién decide).
8. **Lista *go/no-go* de lanzamiento** con casillas.
9. **Pasos manuales** en orden, para alguien no experto.
10. **Decisiones pendientes del organizador** (nombres abreviados o completos en el padrón, lista de espera, política de devoluciones y retención de datos, formato de exportación del emparejador, **dominio propio sí/no**, modo de despliegue Git o con CI).
11. **Lo que no pudiste hacer**, dicho con claridad y con prioridad sugerida.

**Cuando termines, detente.** No agregues funciones nuevas.
