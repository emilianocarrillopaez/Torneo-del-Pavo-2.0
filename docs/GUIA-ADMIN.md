# Guía Rápida del Organizador (Panel Admin) — Torneo del Pavo 2.0

Esta guía explica paso a paso cómo operar el torneo desde el panel de administración sin necesidad de conocimientos técnicos.

---

## 1. Cómo entrar y salir del panel

1. Abre la página del torneo y entra a **`/admin`** (por ejemplo `https://tu-sitio.pages.dev/admin`), o haz clic en el botón **Admin** en la parte inferior de la página.
2. Presiona **Iniciar sesión con Google** y elige la cuenta Gmail autorizada del comité.
   - *Nota:* si usas un correo que no ha sido autorizado, verás un aviso indicando que no tiene permisos.
3. Por seguridad, si dejas el panel abierto sin actividad durante **30 minutos**, la sesión se cierra automáticamente.
4. Al terminar de trabajar en una computadora compartida, presiona el botón rojo **Salir** en la esquina superior derecha.

---

## 2. Cómo revisar comprobantes y aprobar pagos

1. Entra a la pestaña **Inscritos y Recibos** (subvista **Activos**).
2. En la columna **Recibo (Solo Admin)** verás el botón azul **Ver Foto** junto a cada participante que subió su comprobante (imagen o PDF).
3. Haz clic en **Ver Foto**. Dentro del visor puedes:
   - Hacer zoom o **Rotar** si la foto salió volteada.
   - Presionar **Descargar** para guardar el archivo en tu computadora.
   - Presionar **Copiar Link Admin** si deseas compartir la referencia interna con otro miembro del comité autorizado.
   - Presionar **Reemplazar** si el jugador te envió un comprobante más claro por WhatsApp.
4. Si el pago es válido:
   - Presiona el botón amarillo **Aprobar y siguiente**: marcará al jugador como **Pagado** y abrirá automáticamente el siguiente comprobante pendiente.
   - También puedes usar el botón **Marcar Pagado** (o revertirlo a *Pendiente* si hubo un error).
5. **Aprobación en lote:** si revisaste varios pagos juntos, marca sus casillas a la izquierda de la tabla y presiona **Marcar pagados (lote)** en la barra amarilla superior.

---

## 3. Cómo dar de alta o editar un participante manualmente

- **Registrar manualmente (ej. pago en efectivo en mesa):**
  1. Presiona el botón amarillo **Nuevo** en la barra superior de **Inscritos y Recibos**.
  2. Llena los datos del jugador, selecciona categoría (**Libre** o **Juvenil**), estatus de pago y adjunta recibo si aplica.
  3. Presiona guardar. Si registras a un menor de edad, el sistema te pedirá confirmar el permiso del padre o tutor.
- **Corregir datos de un inscrito:**
  1. En la fila del jugador, haz clic en el icono de lápiz (**Editar**) a la derecha.
  2. Corrige el nombre, categoría, teléfono o estatus y guarda.
  3. Si necesitas revisar qué cambios se hicieron y quién aprobó un pago, presiona el icono de reloj (**Historial**).

---

## 4. Cómo agregar o quitar administradores (árbitros y tesoreros)

1. Ve a la pestaña **Accesos Admin**.
2. En **Autorizar Nuevo Administrador (Acceso con Google)** escribe:
   - **Correo de Google** exacto de la persona.
   - **Nombre completo**.
   - **Rol** (ejemplo: *Árbitro*, *Tesorero*, *Registro*).
3. Presiona **Autorizar Administrador**. Esa persona podrá entrar de inmediato a `/admin` con su propia cuenta de Google.
4. Para quitarle acceso a alguien cuando termine su función, haz clic en el bote de basura rojo (**Revocar acceso**) junto a su correo y confirma. *(El sistema impide eliminar al último administrador activo para que no pierdas el acceso).*

---

## 5. Cómo manejar la Lista de espera

Cuando se alcanza el cupo máximo (100 lugares por defecto), el formulario público registra a los interesados en **Lista de espera**:

1. En **Inscritos y Recibos**, entra a la subvista **Lista de espera**.
2. Si se libera un lugar (por baja o cancelación), presiona el número de **WhatsApp** del primer interesado para abrir un mensaje listo con su folio.
3. Cambia su columna **Estatus** de *En espera* a **Contactado**, y una vez que pague e ingrese como participante, cámbialo a **Convertido** (e inscríbelo con el botón **Nuevo**).
4. Para mantener limpia la lista después de varios días o al cerrar el evento, presiona **Vaciar convertidos / antiguos** para borrar las entradas ya atendidas o de más de 14 días.

---

## 6. Posibles duplicados y «Liberar correo/WhatsApp»

El sistema bloquea automáticamente inscripciones repetidas con el mismo correo o teléfono. Sin embargo, si alguien se registró dos veces con ligeras variaciones o si un jugador borrado necesita volver a inscribirse:

- **Detectar duplicados:** si aparece la etiqueta roja **Posibles duplicados**, presiona el botón **Posibles duplicados** en los filtros para revisar solo esos casos y enviar el repetido a la papelera.
- **Liberar correo/WhatsApp:** si borraste a alguien por error o desea volver a usar su propio correo/WhatsApp en el formulario público:
  1. Presiona **Liberar correo/WhatsApp** en la barra **Operación, privacidad y respaldo**.
  2. Escribe exactamente el correo electrónico o el número de WhatsApp de 10 dígitos y confirma. Eso desbloquea esos datos para una nueva inscripción.

---

## 7. Cómo exportar listas (PDF, Excel, CSV y sistema Suizo)

En la barra superior de **Inscritos y Recibos**, usa los filtros (categoría, pago, recibo o búsqueda) si deseas exportar solo un subgrupo, o marca casillas específicas. Luego presiona:

- **PDF:** genera un reporte listo para imprimir o compartir en WhatsApp con el comité.
- **Excel:** descarga el libro `.xlsx` con hojas separadas de participantes, estadísticas y recaudación.
- **CSV:** tabla plana compatible con cualquier hoja de cálculo.
- **Suizo:** descarga un archivo limpio con nombre, categoría y estatus listo para importar en programas de emparejamiento (como Swiss-Manager o Vega).

---

## 8. Check-in el día del torneo (desde celular o tablet)

1. Abre `/admin` en una tablet o celular en la mesa de registro del club.
2. Usa el buscador superior para escribir el apellido o folio del jugador que llega.
3. En la columna **Check-in**, toca la pastilla gris **Pendiente**: cambiará de inmediato a azul **Presente** con la hora exacta de llegada.
4. Si tocaste por error al jugador equivocado, vuelve a tocar **Presente** para regresarlo a *Pendiente*.

---

## 9. Papelera, Respaldo JSON, Purga y Anonimización

### Papelera (borrar y recuperar)
- Para dar de baja a alguien sin perder su historial de inmediato, presiona el icono rojo **Mover a papelera**. Si estaba en el padrón público, saldrá de la vista pública al instante.
- En la subvista **Papelera** puedes presionar **Restaurar** si fue un error, o **Eliminar definitivo** para borrarlo por completo junto con su comprobante.

### Respaldo, Purga y Anonimización (en «Operación, privacidad y respaldo»)
1. **Sincronizar padrón:** úsalo solo si notas un aviso de desfase entre el total interno y el padrón público.
2. **Respaldo JSON:** descarga un archivo completo de respaldo en tu computadora. Hazlo **antes** del torneo y **antes** de purgar o anonimizar.
3. **Purgar comprobantes:** elimina definitivamente las fotos y PDFs de pago almacenados en `/comprobantes` conservando los nombres y folios de los jugadores.
4. **Anonimizar post-torneo:** reemplaza correos, teléfonos y fechas de nacimiento por datos anónimos en el padrón interno y cierra la recolección, manteniendo únicamente estadísticas y resultados históricos conforme al Aviso de Privacidad.

---

## 10. Convocatoria y Patrocinadores

- **Pestaña Convocatoria:** actualiza sede, costo, cupo, datos bancarios, fecha límite o los textos de premiación y reglamento.
  - Puedes usar los interruptores superiores (**Inscripciones Abiertas / Cerradas** y **Lista de espera activa / desactivada**) para abrir o pausar el formulario al instante.
  - El botón **Restaurar valores por defecto** recupera los textos base y los patrocinadores originales **sin borrar** tus datos bancarios reales ni tu WhatsApp.
  - Presiona siempre **Guardar Cambios de Convocatoria** al terminar.
- **Pestaña Patrocinadores:** usa **Agregar Patrocinador** para subir un logotipo nuevo (`JPG`, `PNG` o `WEBP`), cambiar el orden en el carrusel o usar el icono del ojo para ocultar temporalmente a un patrocinador sin eliminarlo.
