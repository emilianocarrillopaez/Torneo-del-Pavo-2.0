# Manual de Respuesta a Incidentes (Runbook) — Torneo del Pavo 2.0

Guía de acción rápida para el comité organizador ante incidentes durante la operación del torneo.

---

## Escenario A: Sospecha de filtración o acceso no autorizado a datos

**Señales:** alguien reporta acceso a correos, teléfonos o recibos sin permiso, o aparece un cambio no reconocido en `/admin`.

1. **Contener de inmediato:**
   - Entra a `/admin → Convocatoria`, cambia a **Inscripciones Cerradas** y presiona **Guardar Cambios de Convocatoria**.
   - Entra a `/admin → Accesos Admin` y revoca cualquier correo desconocido o comprometido.
2. **Revisar consola de Firebase:**
   - Abre **Firebase Console → Firestore → base `ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2` → Data**: revisa las colecciones `admins` y `admins_by_email` y elimina cualquier documento ajeno.
   - Abre **Reglas** en la misma base y confirma que coinciden exactamente con `firestore.rules` (en especial que `/participantes`, `/comprobantes`, `/registro_llaves` y `/lista_espera` siguen cerrados al público).
3. **Rotar accesos:**
   - Cambia la contraseña y activa verificación en dos pasos (2FA) en la(s) cuenta(s) de Google de los administradores y en la cuenta de Cloudflare/GitHub.
   - Si existe sospecha sobre la clave API restringida en Google Cloud, genera una nueva y restringe el *referrer* HTTP únicamente a tu dominio final.
4. **Evaluar y avisar:**
   - Determina qué registros estuvieron expuestos y, si se confirma exposición de datos personales o de menores, notifica a los participantes afectados y a los tutores por los canales oficiales del club (correo/WhatsApp del torneo) dentro de las primeras 72 horas.

---

## Escenario B: Spam o registros basura masivos (inscripciones o lista de espera)

**Señales:** decenas de registros falsos en pocos minutos o subida acelerada de escrituras en Firebase.

1. **Pausar el ingreso público:**
   - En `/admin → Convocatoria` marca **Inscripciones Cerradas** (y **Lista de espera desactivada** si aplica) y guarda. Esto detiene nuevas escrituras desde Firestore Rules de forma inmediata aunque el atacante llame directo a la API.
2. **Verificar App Check:**
   - Entra a **Firebase Console → App Check → Cloud Firestore → Metrics**.
   - Si hay alto porcentaje de solicitudes **Unverified** y ya comprobaste que los usuarios legítimos sí envían tokens válidos (*Verified*), activa **Enforce** (aplicar bloqueo).
3. **Limpiar registros falsos:**
   - Mueve los registros basura a **Papelera** y luego usa **Eliminar definitivo** (libera también sus comprobantes).
   - En **Lista de espera**, usa **Vaciar convertidos / antiguos** o elimina las entradas basura.
4. **Reabrir de forma controlada** una vez confirmado que App Check está activo y funcionando.

---

## Escenario C: Cuota gratuita agotada durante el evento (Firebase Spark o reCAPTCHA)

**Señales:** los visitantes ven errores de carga, aparece mensaje de servicio saturado (`RESOURCE_EXHAUSTED`) o falla el registro en el día previo/evento.

1. **Conservar primero la operación del registro:**
   - En `/admin → Convocatoria`, cierra el registro público temporalmente (**Inscripciones Cerradas**) si el evento está por comenzar y descarga de inmediato tu último **Respaldo JSON** y **Excel** en cuanto recupere respuesta, o usa el respaldo preventivo descargado en la mañana (`D-0`).
2. **Reducir lecturas de Firestore al mínimo:**
   - El padrón público ya limita a 500 documentos, usa caché de 60 segundos y pausa escuchas en pestañas ocultas. Aun así, en horas pico pide por redes/WhatsApp a los jugadores que **no recarguen repetidamente** el padrón y comparte el listado oficial en **PDF** descargado desde `/admin` por el grupo de WhatsApp del torneo.
3. **Continuar en mesa sin internet:**
   - Realiza el **check-in** y los emparejamientos usando el archivo **Suizo / Excel** ya descargado en la computadora de arbitraje.
   - *(La cuota gratuita diaria de Firebase Spark se restablece automáticamente a la medianoche hora del Pacífico — approx. 01:00–02:00 a.m. hora de Durango).*

---

## Escenario D: Bloqueo total de acceso de administrador (ningún admin puede entrar)

**Señales:** al entrar a `/admin` con tu cuenta de Google aparece *"Tu correo no está autorizado"* o se eliminó por error el documento de admin en Firestore.

*(El sistema en la interfaz impide borrar al último administrador, pero si ocurre desde consola o por cambio de cuenta Google, se recupera en 2 minutos desde Firebase Console):*

1. Entra a [Firebase Console](https://console.firebase.google.com/) con la cuenta dueña del proyecto **`yogic-decoder-5lxdt`**.
2. Ve a **Build → Firestore Database**.
3. En el selector superior de base de datos, elige **`ai-studio-1b982696-e484-4fe2-a9e1-54984917aae2`** *(muy importante: NO uses `(default)`).*
4. Abre la colección **`admins_by_email`** (o créala si no existe).
5. Haz clic en **+ Agregar documento**:
   - **ID del documento:** tu correo exacto de Google **en minúsculas** (ejemplo: `organizador@gmail.com`).
   - Campo `email` (string): el mismo correo exacto en minúsculas.
   - Campo `nombre` (string): tu nombre.
   - Campo `rol` (string): `Organizador Principal`.
6. Guarda el documento, recarga `/admin` en tu navegador e inicia sesión con Google nuevamente.

---

## Escenario E: Comprobante o dato sensible expuesto por error

**Señales:** se escribió un teléfono/correo dentro del campo `nombre`, o se subió información confidencial en un texto público de la convocatoria o en patrocinadores.

1. **Si está en el padrón público (`/participantes`):**
   - Entra a `/admin → Inscritos y Recibos`, haz clic en **Editar** en el participante afectado, corrige el campo `nombre` (que es el único texto libre visible públicamente) y guarda; esto actualiza al instante tanto `/participantes` como `/participantes_publicos`.
   - Si no bastara, presiona **Sincronizar padrón** o mueve el registro a **Papelera** y usa **Eliminar definitivo**.
2. **Si está en Convocatoria o Patrocinadores:**
   - Edita y guarda de inmediato en `/admin → Convocatoria` o `/admin → Patrocinadores`.
3. **Si aparece en Cloudflare o caché del navegador:**
   - Verifica que se actualizó abriendo el sitio en una ventana de incógnito. Los documentos dinámicos en Firestore no quedan cacheados en CDN.

---

## Escenario F: Publicación defectuosa en Cloudflare Workers (pantalla en blanco o error tras actualizar)

**Meta:** restaurar el servicio en **menos de 5 minutos**.

1. Entra a **Cloudflare Dashboard → Workers & Pages → tu Worker (`torneo-del-pavo-2-0`) → Deployments**.
2. Localiza el último despliegue anterior que mostraba estado correcto.
3. Haz clic en **`⋯` → Rollback to this deployment** y confirma.
4. En menos de 1 minuto la URL pública volverá a la versión estable anterior mientras revisas el error en una rama de pruebas antes de volver a fusionar a `main`.
