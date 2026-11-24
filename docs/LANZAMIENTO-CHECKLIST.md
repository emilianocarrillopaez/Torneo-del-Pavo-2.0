# Calendario de Operación y Checklist Go / No-Go — Torneo del Pavo 2.0

**Fecha oficial del evento:** Sábado **19 de diciembre de 2026**, **16:30 horas** (Durango, Dgo.).  
Las fechas siguientes son referencias operativas relativas al día del torneo (`D-0`).

---

## Fase 1: Preparación previa al lanzamiento (`D-21` a `D-14` · Finales de nov. – 5 dic. 2026)

- [ ] **Primer administrador creado** en Firestore (`admins_by_email`) en la base `ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2`.
- [ ] **Reglas de Firestore publicadas y verificadas visualmente** en Firebase Console comparando con `firestore.rules`.
- [ ] **Sitio publicado en Cloudflare Pages** con `VITE_SITE_URL` definitiva y `VITE_APP_ENV=production`.
- [ ] **Dominios actualizados** en Firebase Auth, reCAPTCHA Enterprise y restricción HTTP de la API Key Web.
- [ ] **Datos bancarios reales capturados** en `/admin → Convocatoria` (CLABE, banco, titular y WhatsApp sin valores `000000...`).
- [ ] **App Check verificado y activado (*Enforced*)** en Cloud Firestore tras comprobar tráfico verde legítimo.
- [ ] **Auth endurecida:** únicamente proveedor **Google** activo en Firebase Authentication.

---

## Fase 2: Congelamiento de código y Prueba de Humo (`D-10` · ~9 de diciembre de 2026)

- [ ] **Congelamiento de cambios (*Code Freeze*):** no hacer cambios de código ni rediseños a partir de esta fecha salvo correcciones críticas de seguridad o errores bloqueantes.
- [ ] **CI en verde en `main`:** lint, pruebas unitarias, pruebas de reglas con emulador, E2E y auditoría aprobados.
- [ ] **Prueba de humo completa ejecutada** (`docs/PRUEBA-DE-HUMO.md`), incluyendo prueba con celular en datos móviles y login de admin en Chrome móvil y Safari de iPhone.
- [ ] **Registros de prueba eliminados definitivamente** desde *Papelera → Eliminar definitivo*.

### Decisión GO / NO-GO para abrir inscripciones públicas
**NO se anuncia ni se abre la página si falla cualquiera de estos puntos:**
1. El formulario rechaza duplicados, valida menor con tutor y acepta comprobantes reales (imagen y PDF).
2. `/participantes` no expone ningún correo, WhatsApp, nacimiento, edad de menores ni recibo.
3. Las reglas en Firebase Console coinciden con `firestore.rules` y `/comprobantes` rechaza acceso anónimo.
4. Al menos dos integrantes del comité pueden entrar a `/admin` desde su teléfono/computadora.

---

## Fase 3: Periodo de inscripciones (`D-10` a `D-1` · 9 – 18 de diciembre de 2026)

- [ ] Revisar comprobantes nuevos diariamente en `/admin → Inscritos y Recibos` usando **Aprobar y siguiente**.
- [ ] Vigilar el uso diario en **Firebase Console → Firestore → Usage** (confirmar lectura/escritura muy por debajo de 50,000 lecturas / 20,000 escrituras diarias).
- [ ] Si se alcanza el cupo (`100`), atender la subvista **Lista de espera** en orden de folio conforme surjan bajas.
- [ ] **Cierre de inscripciones en línea (`D-0`, 15:30 h o según convocatoria):** confirmar que el cambio de bandera **Inscripciones Cerradas** o la fecha límite bloquea nuevos envíos web.

---

## Fase 4: Previo inmediato y Día del Torneo (`D-0` · Sábado 19 de diciembre de 2026)

### Mañana del torneo (antes de las 14:00 h)
- [ ] Descargar **Respaldo JSON**, **Excel** y **PDF** de emergencia desde `/admin` y guardarlos localmente en la laptop/tablet de arbitraje (por si falla internet en la sede).
- [ ] Verificar carga de batería y datos móviles de la tablet o celulares para la mesa de registro.

### En sede (15:00 h – 16:25 h)
- [ ] Hacer **Check-in** móvil en `/admin → Inscritos y Recibos` tocando la columna **Check-in** (*Pendiente → Presente*) conforme llegan los jugadores.
- [ ] Para inscripciones de último momento en mesa (si el comité lo aprueba), usar el botón **Nuevo**.
- [ ] Al cerrar registro, filtrar por confirmados y presionar **Suizo** para descargar el archivo CSV e importarlo en el software de emparejamiento del torneo.

---

## Fase 5: Cierre obligatorio post-torneo (`D+1` a `D+30` · 20 dic. 2026 – 18 ene. 2027)

Para cumplir con el principio de minimización de datos y el Aviso de Privacidad (especialmente por involucrar **menores de edad**):

1. [ ] **Respaldo final del archivo del club (`D+1`):** descargar **Excel** y **Respaldo JSON** completos y guardarlos en almacenamiento cifrado/privado del comité.
2. [ ] **Purgar comprobantes (`D+3` a `D+7`):** en `/admin → Inscritos y Recibos`, presionar **Purgar comprobantes** para eliminar todas las imágenes y PDFs de pago de `/comprobantes`.
3. [ ] **Limpiar lista de espera (`D+7`):** abrir subvista **Lista de espera** y presionar **Vaciar convertidos / antiguos** (o borrar manualmente las entradas restantes).
4. [ ] **Anonimizar post-torneo (máximo `D+30`, antes del 18 de enero de 2027):** presionar **Anonimizar post-torneo** para reemplazar correos, WhatsApp y fechas de nacimiento por marcadores anónimos, y cerrar inscripciones (`Inscripciones Cerradas`).
5. [ ] **Retirar padrón público / archivar (`D+30`):** si no se conservará un tablero histórico anual, evaluar desactivar el acceso público al padrón o mantener únicamente los resultados oficiales del club.
