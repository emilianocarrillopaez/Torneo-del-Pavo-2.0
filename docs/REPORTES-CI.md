# Guía Móvil de Reportes y Logs de CI (Torneo del Pavo 2.0)

Esta guía está pensada para revisar cualquier ejecución de pruebas en **GitHub Actions** directamente desde el celular o navegador, sin tener que leer archivos largos ni instalar herramientas en tu computadora.

---

## 1. Dónde ver el resumen rápido (Summary)

Cada vez que haces `push` o abres un Pull Request se ejecuta el flujo **Calidad, Reglas y Seguridad (CI)**.

1. Abre tu repositorio en GitHub (en app móvil o navegador).
2. Toca la pestaña **Actions**.
3. Toca la ejecución más reciente (la de arriba; tendrá ✅ verde o ❌ rojo).
4. **Sin entrar a ningún trabajo todavía**, desliza hacia abajo hasta la sección **Summary**:
   - Ahí aparece un resumen corto en español por cada trabajo:
     - **Calidad, Lint, Unitarias, Auditoría y Build** (`reportes-calidad`)
     - **Pruebas de Reglas Firestore (Emulador)** (`reportes-reglas`)
     - **Pruebas E2E (Playwright) y Lighthouse CI** (`reportes-e2e`)
   - Muestra el conteo exacto de pruebas aprobadas/fallidas, el resultado de `bun audit`, los puntajes de Lighthouse (cuando corre E2E) y, si algo falló, **las últimas 40 líneas del error**.
   - Al final (en ejecuciones `push`), también verás cuántas ejecuciones/artefactos viejos se limpiaron (`Reportes anteriores eliminados: N`).

---

## 2. Cómo descargar la carpeta completa `reports/` (Artifacts)

Si necesitas el detalle completo o compartir el archivo exacto de un fallo:

1. En esa misma página de la ejecución en **Actions**, desliza hasta la parte de abajo llamada **Artifacts**.
2. Verás hasta tres archivos comprimidos (`.zip`), incluso si algún paso falló:
   - **`reportes-calidad`** → contiene `resumen.md`, `lint.txt`, `rules-lint.txt`, `unit-tests.txt`, `audit.txt`, `build.txt`.
   - **`reportes-reglas`** → contiene `resumen.md`, `rules-tests.txt`.
   - **`reportes-e2e`** → contiene `resumen.md`, `e2e.txt`, `lighthouse.txt`, `build.txt`, carpeta `playwright/` (`results.json` y reporte visual `html/index.html`) y carpeta `lighthouse/`.
3. Toca el nombre del artefacto para descargarlo como `.zip` y ábrelo en el celular (en iOS con *Archivos* o en Android con *Files*).

---

## 3. Qué archivo abrir primero cuando algo sale rojo (❌)

1. Abre primero **`resumen.md`** dentro del `.zip` (o míralo directo en **Summary** en GitHub).
2. Según el trabajo que falló, abre el archivo correspondiente:
   - Si falló **Lint / Tipos / Reglas**: abre **`lint.txt`** o **`rules-lint.txt`**.
   - Si falló **Auditoría**: abre **`audit.txt`**.
   - Si falló **Pruebas unitarias**: abre **`unit-tests.txt`**.
   - Si falló **Reglas de Firestore**: abre **`rules-tests.txt`** (muestra qué vector `V1–V34` falló).
   - Si falló **Pruebas E2E (Playwright)**: abre **`e2e.txt`** o abre **`playwright/html/index.html`** en navegador para ver capturas y paso exacto.
   - Si falló **Lighthouse CI**: abre **`lighthouse.txt`** o los reportes en **`lighthouse/`**.

---

## 4. Qué copiar o capturar para pedir ayuda sin exponer secretos

- **Sí puedes compartir:**
  - Una captura del **Summary** en GitHub Actions.
  - El texto de `resumen.md` o las últimas líneas del `.txt` que falló (`lint.txt`, `unit-tests.txt`, `rules-tests.txt`, `e2e.txt`).
- **Nunca compartas ni subas:**
  - Capturas de **Settings → Secrets and variables** ni llaves privadas o tokens (`GITHUB_TOKEN`, `.env`, archivos `.pem`/`.key`, cuentas de servicio).
  - *Nota:* El flujo ya bloquea automáticamente subir archivos sensibles o comprobantes en `reports/` antes de crear cada artefacto.

---

## 5. Política NO incremental y cuota de almacenamiento

- **Solo se conserva la última ejecución:** este flujo **no acumula historial** de reportes anteriores. En cada `push` exitoso o fallido en el repositorio principal, el trabajo final **`Limpiar Reportes Antiguos`** borra automáticamente los artefactos `reportes-*` de ejecuciones anteriores ya terminadas.
- **Límite máximo de retención (`90` días):** si por algún motivo no vuelve a haber un `push` en semanas, GitHub elimina automáticamente los artefactos restantes al cumplir **90 días** (tope de retención del plan estándar).
- **Cómo revisar tu cuota en GitHub (si algún día ves aviso de almacenamiento):**
  1. En GitHub, ve a **Settings** de tu cuenta u organización → **Billing and licensing** → **Usage** (o **Actions**).
  2. Revisa el apartado **Storage for Actions** para confirmar que el consumo está cerca de cero gracias a la limpieza automática.
- **Opción avanzada (`CLEANUP_OLD_RUNS=true`):** por defecto solo se borran los archivos descargables (`reportes-*`), conservando el historial visual de ejecuciones en la pestaña **Actions**. Si prefieres borrar también ejecuciones antiguas de la lista (dejando siempre la actual y la anterior completada), crea la variable de repositorio `CLEANUP_OLD_RUNS` = `true` en **Settings → Secrets and variables → Actions → Variables** *(advertencia: al habilitarla se pierden las bitácoras web de ejecuciones más antiguas en Actions)*.
