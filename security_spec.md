# Security Specification: Torneo del Pavo 2.0

**Base de datos Firestore:** `ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2`
**Modelo de autorización:** Control de acceso basado en documentos (`/admins/{uid}` y `/admins_by_email/{email_lower}`) con verificación obligatoria de correo (`request.auth.token.email_verified == true`), sin correos hardcodeados en reglas ni en el código del cliente.

---

## 1. Reglas por Colección e Invariantes

### Denegación por defecto (`/{document=**}`)
- Toda ruta no declarada explícitamente queda bloqueada (`allow read, write: if false`).

### `/participantes/{participanteId}` (Colección privada de inscritos)
- **Lectura (`get`, `list`):** Exclusivamente administradores (`isAdmin()`). Bloqueada por completo a usuarios anónimos y a usuarios Google no autorizados o sin correo verificado.
- **Campos exactos permitidos (`hasOnly`):** `nombre`, `fechaNacimiento`, `whatsapp`, `correo`, `categoria`, `estatusPago`, `fechaRegistro`, `folio`, `esFemenil`, `esAficionado`, `tieneRecibo`, `reciboId`, `reciboNombreArchivo`, `notas`, `website`, `aceptoAviso`, `aceptoAvisoVersion`, `consentimientoTutor`, `nombreTutor`, `fechaConsentimiento`, `pagadoPor`, `pagadoEn`, `historial`, `asistencia`, `asistenciaEn`, `eliminado`, `eliminadoEn`, `eliminadoPor`.
- **Creación pública (`create`):**
  - Solo permitida cuando `/configuracion/general.inscripcionesAbiertas == true` y `request.time <= fechaLimiteTimestamp` (si existe).
  - `estatusPago == 'pendiente'`, `tieneRecibo == true`, `notas` ausente o `''`, `website` (honeypot) ausente o `''`, y **sin** campos administrativos (`pagadoPor`, `pagadoEn`, `historial`, `asistencia`, `eliminado`, etc.).
  - **Liga 1:1 (R2):** `!exists(/comprobantes/$(reciboId))` y `existsAfter(/comprobantes/$(reciboId))` con `getAfter(...).data.participantId == participanteId` (impide colgar comprobantes ajenos existentes).
  - Debe existir en el mismo `writeBatch` `/participantes_publicos/$(participanteId)` (`existsAfter`).
  - `whatsapp` exactamente 10 dígitos (`^[0-9]{10}$`), `correo` en minúsculas y formato válido (≤ 100 caracteres), `nombre` sin espacios al inicio/fin (3–150 caracteres), `fechaNacimiento` formato `YYYY-MM-DD`, `categoria in ['Juvenil', 'Libre']`, `folio` formato `^PAVO-[A-HJ-NP-Z2-9]{6}$`.
  - **Coherencia edad / categoría (R5):** `Juvenil` solo permitido si `fechaNacimiento > getJuvenilCutoff(cfg)` (por defecto `'2007-12-19'`, derivable desde `configuracion/general.fechaCorteJuvenil`).
  - **Consentimiento de menores dinámico (3.1):** `aceptoAviso == true` y `fechaConsentimiento` obligatorios. Si `fechaNacimiento > getMajorityCutoff(cfg)` (derivado desde `configuracion/general.fechaCorteMayoriaEdad`, respaldo `'2008-12-19'`), exige `consentimientoTutor == true` y `nombreTutor` válido (≥ 3 caracteres).
- **Actualización / Eliminación (`update`, `delete`):** Exclusivamente administradores (`isAdmin()`). En `update` se mantienen las categorías heredadas y formatos de registros previos para no romper ediciones o migraciones.

### `/participantes_publicos/{participanteId}` (Padrón público sanitizado)
- **Lectura (`get`, `list`):** Pública (`if true`).
- **Campos exactos permitidos (`hasOnly`):** `folio`, `nombre`, `categoria`, `esAficionado`, `esFemenil`, `estatusPago`, `rangoEdad`, `edad`, `fechaRegistro`. **Nunca** almacena `correo`, `whatsapp`, `fechaNacimiento`, `notas`, `reciboId` ni `nombreTutor`.
- **Privacidad y filtro de nombres (R4):**
  - `nombre` validado por lista estricta de letras Unicode (`^[\p{L}][\p{L} .'-]{1,148}[\p{L}.]$`) que acepta acentos, `ñ`, diéresis (`ë`, `ï`), cedillas (`ç`), apóstrofos (`O'Connor`), partículas (`De la Cruz`, `Del Río`) y guiones (`Pérez-Soto`), bloqueando URLs, números y etiquetas HTML en creación pública.
  - Cuando `MASK_PUBLIC_LAST_NAMES` está activo, el documento almacenado en Firestore ya guarda el nombre abreviado (ej. `Emiliano C.`) generado desde la misma función compartida (`buildParticipantNames`) para garantizar coincidencia con `validatePublicRosterMatch`.
  - Para menores (`fechaNacimiento > getMajorityCutoff(cfg)`), las reglas exigen `!('edad' in pubData)` en creación pública (solo se publica `rangoEdad`).
  - Se contrastan con `getAfter(/participantes/$(participanteId))` los campos `folio`, `categoria`, `esAficionado`, `esFemenil`, `estatusPago`, `fechaRegistro` y el primer nombre (`split(' ')[0]`), además de exigir `estatusPago == 'pendiente'`.
- **Actualización / Eliminación (`update`, `delete`):** Solo `isAdmin()` (permite dígitos únicamente para procesos admin como anonimización post-torneo o folios heredados).

### `/lista_espera/{esperaId}` (Lista de espera cuando el cupo esté agotado)
- **Lectura (`get`, `list`):** Solo `isAdmin()`.
- **Creación pública (`create`):** Exige ID determinista SHA-256 de 64 hex (`^[a-f0-9]{64}$`, generado desde `waitlist:${correo}`), registro abierto, `habilitarListaEspera != false`, `estatus == 'en_espera'`, `notas` vacío y cumpliendo validaciones de formato Unicode, categoría/edad y consentimiento de menor.
- **Actualización / Eliminación:** Solo `isAdmin()` (incluye limpieza por lotes de entradas convertidas o con > 30 días).

### `/registro_llaves/{hashId}` (Prevención de duplicados sin enumeración)
- **Lectura y actualización (`get`, `list`, `update`):** Completamente bloqueadas (`if false`).
- **Creación (`create`, R3):** Solo con ID SHA-256 hexadecimal de 64 caracteres (`^[a-f0-9]{64}$`), campos exactos `['tipo', 'participantId', 'createdAt']`, `tipo in ['email', 'whatsapp']`, y para público exige `isRegistrationOpen()`, `!exists(/participantes/$(participantId))` y `existsAfter(/participantes/$(participantId))`.
- **Limitación documentada (3.7):** Las reglas de Firestore no disponen de función hash SHA-256 para recomputar el ID contra `correo`/`whatsapp`; la regla impide apartar llaves sin crear un participante nuevo en el mismo batch con registro abierto, mientras que el panel admin incluye detección heurística de posibles duplicados y acción explícita de liberar llave (`delete`).
- **Eliminación (`delete`):** Solo `isAdmin()`.

### `/comprobantes/{comprobanteId}` (Bóveda privada de recibos)
- **Lectura (`get`, `list`):** Solo `isAdmin()`.
- **Creación pública (`create`, R1):** Exige `isRegistrationOpen()`, `!exists(/participantes/$(participantId))` (participante nuevo), `existsAfter(/participantes/$(participantId))`, y liga 1:1 `getAfter(...).data.reciboId == comprobanteId` y `folio` coincidente.
- **Validación (`isValidComprobante`):** `hasOnly` de los 8 campos esperados, `fileName` sin `/` ni `\`, `mimeType` permitido, `fileSize` ≤ 950,000, y `imageDataUrl` estrictamente ligado al `mimeType`.
- **Actualización / Eliminación (`update`, `delete`):** Solo `isAdmin()`.

### `/configuracion/{configId}` (Opción A — Conteo seguro)
- **Lectura (`get`, `list`):** Pública (`if true`).
- **Escritura (`create`, `update`, `delete`):** Exclusivamente `isAdmin()` con `hasOnly`, validación de `fechaCorteMayoriaEdad`, `fechaCorteJuvenil`, `habilitarListaEspera`, `politicaDevolucionTexto`, `mapaUrl` (`https://...` o `#`), etc. Sin escritura pública a `totalInscritos`.

### `/patrocinadores/{patrocinadorId}`, `/admins/{adminId}`, `/admins_by_email/{emailId}`, `/test/{docId}`
- Patrocinadores: lectura pública, escritura solo `isAdmin()`, enlaces y logos validados.
- Admins: lectura de documento propio para usuario verificado o `isAdmin()`, resto solo `isAdmin()`.
- `/test/connection`: `allow get: if docId == 'connection'`.

---

## 2. Matriz de Vectores de Prueba (32 vectores en `tests/rules/firestore.rules.test.ts`)

1. **V1:** Anónimo lee `/participantes` → **DENEGADO**.
2. **V2:** Anónimo lee `/participantes_publicos` → **PERMITIDO** y sin PII.
3. **V3:** Anónimo crea participante válido en `writeBatch` completo (privado + público + comprobante + 2 llaves) → **PERMITIDO**.
4. **V4:** Anónimo crea con `estatusPago: 'pagado'` → **DENEGADO**.
5. **V5:** Participante con campo extra (`isAdmin`, `pagadoPor`) → **DENEGADO**.
6. **V6:** `whatsapp` con letras o longitud ≠ 10 → **DENEGADO**.
7. **V7:** `nombre` > 150 caracteres → **DENEGADO**.
8. **V8:** Categoría fuera de `['Juvenil', 'Libre']` → **DENEGADO**.
9. **V9:** Honeypot `website` con texto no vacío → **DENEGADO**.
10. **V10:** Comprobante con `imageDataUrl` `https://…` → **DENEGADO**.
11. **V11:** Comprobante con `data:text/html…` → **DENEGADO**.
12. **V12:** Comprobante > 950,000 bytes/chars → **DENEGADO**.
13. **V13:** Anónimo actualiza `totalInscritos` en `/configuracion/general` → **DENEGADO**.
14. **V14:** Usuario Google autenticado **no admin** lee `/comprobantes` → **DENEGADO**.
15. **V15:** Usuario con correo autorizado pero `email_verified: false` → **DENEGADO**.
16. **V16:** Admin legítimo lee, actualiza (incl. auditoría `pagadoPor`/`historial`) y elimina → **PERMITIDO**.
17. **V17:** Duplicado de correo o WhatsApp en `/registro_llaves/{sha256}` → **DENEGADO**.
18. **V18:** Patrocinador con `enlace: 'javascript:alert(1)'` → **DENEGADO**.
19. **V19:** Anónimo escribe `/admins` o `/admins_by_email` → **DENEGADO**.
20. **V20:** Inscripción después de `fechaLimiteTimestamp` o con `inscripcionesAbiertas == false` → **DENEGADO**.
21. **V21 (R1):** Comprobante huérfano sin participante nuevo → **DENEGADO**.
22. **V22 (R1):** Comprobante colgado a un participante ya existente → **DENEGADO**.
23. **V23 (R2):** Participante que apunta al `reciboId` de otro participante ya existente → **DENEGADO**.
24. **V24 (R3):** Llave en `/registro_llaves` sin participante nuevo en el batch → **DENEGADO**.
25. **V25 (R3):** Llave en `/registro_llaves` cuando el registro está cerrado → **DENEGADO**.
26. **V26 (R4):** Nombre público con URL o caracteres no permitidos (`https://`, `<script>`) → **DENEGADO**.
27. **V27 (R4):** Menor de edad en padrón público con campo `edad` expuesto → **DENEGADO**; sin `edad` → **PERMITIDO**.
28. **V28 (R5):** Adulto intentando registrarse en categoría `Juvenil` → **DENEGADO**.
29. **V29 (3.1):** Borde dinámico de `fechaCorteMayoriaEdad` (nació el día del corte = mayor; un día después = menor requiere tutor; antes = mayor).
30. **V30 (R6):** Anonimización post-torneo y purga de comprobantes ejecutadas por admin → **PERMITIDO**.
31. **V31 (3.3):** Actualización por admin sobre registro heredado sin campos de consentimiento o con categoría heredada → **PERMITIDO**.
32. **V32 (5.4 / 3.2):** Lista de espera `/lista_espera`: creación pública válida con ID SHA-256 de 64 hex permitida; ID no-hash y duplicado del mismo correo denegados; menor sin tutor y adulto en Juvenil denegados; lectura pública denegada; lectura/actualización/borrado admin permitidos.
33. **V33 (3.1):** Flujo cliente completo (`buildParticipantNames`) con nombres compuestos, partículas (`De la Cruz`, `Del Río`), apóstrofos (`O'Connor`), guiones (`Pérez-Soto`), diéresis/cedilla (`Chloë`, `François`, `Ïñigo`) y un solo nombre.
34. **V34 (3.3):** Operaciones admin por lotes fragmentados (`SAFE_ADMIN_BATCH_SIZE = 10`, `SAFE_ADMIN_PAIR_BATCH_SIZE = 8`, `SAFE_ADMIN_MULTI_OP_BATCH_SIZE = 4`) probadas con 10, 25, 50 y 100 registros (sync público, pagos en lote, purga de recibos, anonimización).
