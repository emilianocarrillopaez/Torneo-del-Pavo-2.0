import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'yogic-decoder-5lxdt';
const FIRESTORE_HOST = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').replace(/^https?:\/\//, '');
const AUTH_HOST = (process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099').replace(/^https?:\/\//, '');
const BASE_DOC_URL = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer owner',
};

// Imágenes y PDF mínimos sintéticos para pruebas E2E
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const JPG_MIN = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0xff, 0xd9,
]);
// WEBP VP8L lossless 1x1 mínimo válido
const WEBP_MIN = Buffer.from(
  'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
  'base64'
);
const PDF_MIN = Buffer.from(
  '%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF',
  'utf8'
);

function toFsVal(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFsVal) } };
  if (typeof val === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = toFsVal(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function patchDoc(col: string, id: string, data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFsVal(v);
  }
  const res = await fetch(`${BASE_DOC_URL}/${col}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: OWNER_HEADERS,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    throw new Error(`patchDoc(${col}/${id}) failed: ${res.status} ${await res.text()}`);
  }
}

async function resetEmulator(configOverrides: Record<string, unknown> = {}) {
  await fetch(
    `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });

  await patchDoc('configuracion', 'general', {
    titulo: 'Torneo del Pavo 2.0',
    fecha: 'Sábado 19 de diciembre de 2026',
    fechaIso: '2026-12-19T16:30:00-06:00',
    hora: '16:30 hrs',
    lugar: 'Corredor Constitución, Durango, Dgo.',
    costo: 200,
    cupoMaximo: 100,
    inscripcionesAbiertas: true,
    habilitarListaEspera: true,
    fechaLimiteIso: '2099-12-19T15:30:00-06:00',
    fechaLimiteTimestamp: new Date('2099-12-19T21:30:00Z'),
    fechaCorteMayoriaEdad: '2008-12-19',
    fechaCorteJuvenil: '2007-12-19',
    clabe: '012190001234567890',
    banco: 'BBVA Prueba',
    titular: 'Club de Ajedrez Don Gonzalo',
    whatsappContacto: '6185550100',
    ...configOverrides,
  });

  await patchDoc('admins', 'emu-admin-1', {
    email: 'admin.torneo@example.test',
    nombre: 'Organizador E2E',
    rol: 'Dirección',
  });
  await patchDoc('admins_by_email', 'admin.torneo@example.test', {
    email: 'admin.torneo@example.test',
    nombre: 'Organizador E2E',
    rol: 'Dirección',
  });

  // Sembrar dos usuarios en Auth Emulator (admin + no-admin)
  for (const user of [
    { localId: 'emu-admin-1', email: 'admin.torneo@example.test', displayName: 'Organizador E2E' },
    { localId: 'emu-nonadmin-1', email: 'jugador.normal@example.test', displayName: 'Jugador Normal' },
  ]) {
    await fetch(
      `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify({
          localId: user.localId,
          email: user.email,
          displayName: user.displayName,
          emailVerified: true,
          password: 'TestPassword123!',
        }),
      }
    );
  }
}

async function fillAndSubmitRegistration(
  page: Page,
  opts: {
    paterno: string;
    materno?: string;
    nombre: string;
    bday: string;
    whatsapp: string;
    email: string;
    categoria: 'Libre' | 'Juvenil';
    tutorName?: string;
    receipt?: { name: string; mimeType: string; buffer: Buffer };
    waitlistMode?: boolean;
  }
) {
  await page.locator('#reg-paterno').fill(opts.paterno);
  await page.locator('#reg-materno').fill(opts.materno || '');
  await page.locator('#reg-nombre').fill(opts.nombre);
  await page.locator('#reg-bday').fill(opts.bday);

  if (opts.tutorName) {
    await page.locator('#reg-tutor-name').fill(opts.tutorName);
    await page.locator('[data-testid="minor-tutor-consent"] input[type="checkbox"]').check();
  }

  await page.locator('#reg-whatsapp').fill(opts.whatsapp);
  await page.locator('#reg-email').fill(opts.email);

  if (opts.categoria === 'Juvenil') {
    await page.locator('#reg-cat-juvenil').check();
  } else {
    await page.locator('#reg-cat-libre').check();
  }

  if (!opts.waitlistMode && opts.receipt) {
    await page.locator('[data-testid="receipt-file-input"]').setInputFiles(opts.receipt);
    await expect(page.locator('[data-testid="receipt-preview"]')).toBeVisible();
  }

  await page.locator('#aceptoAvisoCheck').check();
  await page.locator('[data-testid="submit-registration-btn"]').click();
  await page.locator('[data-testid="confirm-registration-btn"]').click();
}

async function signInViaAuthEmulatorPopup(page: Page, email: string) {
  const popupPromise = page.waitForEvent('popup');
  await page.locator('[data-testid="admin-google-signin"]').click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.getByText(email, { exact: false }).first().click();
  await popup.waitForEvent('close').catch(() => undefined);
}

test.describe('Torneo del Pavo 2.0 - Flujos E2E críticos contra emulador', () => {
  test.beforeEach(async () => {
    await resetEmulator();
  });

  test('Flujos 1, 2 y 3: Registro adulto (PNG/JPG/WEBP/PDF) + menor con tutor, rechazo de archivo inválido/pesado, duplicado amable y padrón sin PII', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'load' });

    // Archivo inválido (.txt) y demasiado grande (> 8 MB) rechazados con aviso
    await page.locator('[data-testid="receipt-file-input"]').setInputFiles({
      name: 'falso.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await expect(page.locator('[data-testid="receipt-error"]')).toBeVisible();

    const oversized = Buffer.alloc(8 * 1024 * 1024 + 1024, 0x41);
    oversized[0] = 0x25;
    oversized[1] = 0x50;
    oversized[2] = 0x44;
    oversized[3] = 0x46;
    await page.locator('[data-testid="receipt-file-input"]').setInputFiles({
      name: 'pesado.pdf',
      mimeType: 'application/pdf',
      buffer: oversized,
    });
    await expect(page.locator('[data-testid="receipt-error"]')).toBeVisible();

    // Adulto con comprobante PNG y apellido compuesto
    await fillAndSubmitRegistration(page, {
      paterno: 'De la Cruz',
      materno: 'Pérez-Soto',
      nombre: 'María José',
      bday: '1994-06-15',
      whatsapp: '6181234501',
      email: 'maria.adulto@example.test',
      categoria: 'Libre',
      receipt: { name: 'comprobante.png', mimeType: 'image/png', buffer: PNG_1X1 },
    });

    await expect(page.getByText(/PAVO-/)).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar resumen', exact: true }).click();

    // Menor con tutor y comprobante PDF
    await fillAndSubmitRegistration(page, {
      paterno: "O'Connor",
      materno: 'Ríos',
      nombre: 'Chloë',
      bday: '2012-03-20',
      whatsapp: '6181234502',
      email: 'chloe.menor@example.test',
      categoria: 'Juvenil',
      tutorName: 'Patricio OConnor',
      receipt: { name: 'comprobante.pdf', mimeType: 'application/pdf', buffer: PDF_MIN },
    });
    await expect(page.getByText(/PAVO-/)).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar resumen', exact: true }).click();

    // Formatos JPG y WEBP aceptados por el procesador en cliente
    await page.locator('[data-testid="receipt-file-input"]').setInputFiles({
      name: 'recibo.jpg',
      mimeType: 'image/jpeg',
      buffer: JPG_MIN,
    });
    await expect(page.locator('[data-testid="receipt-preview"]')).toBeVisible();
    await page.locator('[data-testid="receipt-file-input"]').setInputFiles({
      name: 'recibo.webp',
      mimeType: 'image/webp',
      buffer: WEBP_MIN,
    });
    await expect(page.locator('[data-testid="receipt-preview"]')).toBeVisible();

    // Flujo 2: Duplicado por mismo correo y WhatsApp -> mensaje amable sin exponer datos ajenos
    await fillAndSubmitRegistration(page, {
      paterno: 'Otro',
      nombre: 'Jugador',
      bday: '1995-01-01',
      whatsapp: '6181234501',
      email: 'maria.adulto@example.test',
      categoria: 'Libre',
      receipt: { name: 'dup.png', mimeType: 'image/png', buffer: PNG_1X1 },
    });
    await expect(page.getByRole('alert').filter({ hasText: /ya existe|registrad/i })).toBeVisible();

    // Flujo 3: Padrón público muestra inscritos enmascarados sin correo, WhatsApp, nacimiento ni edad exacta de menores
    await page.goto('/participantes', { waitUntil: 'load' });
    await expect(page.getByText('De l. C. P. M. J.').or(page.getByText(/^De /))).toBeVisible();
    const tableText = await page.locator('table').innerText();
    expect(tableText).not.toContain('maria.adulto@example.test');
    expect(tableText).not.toContain('6181234501');
    expect(tableText).not.toContain('2012-03-20');
    expect(tableText).not.toContain('14 años'); // edad exacta de menor oculta
  });

  test('Flujos 4 y 5: Cupo agotado -> lista de espera; inscripciones cerradas; datos de pago de ejemplo bloquean envío', async ({
    page,
  }) => {
    // Cupo 1 y ya 1 participante sembrado -> lista de espera activa
    await patchDoc('configuracion', 'general', { cupoMaximo: 1 });
    await patchDoc('participantes_publicos', 'full_1', {
      folio: 'PAVO-FULL01',
      nombre: 'García A.',
      categoria: 'Libre',
      esAficionado: false,
      esFemenil: false,
      estatusPago: 'pagado',
      edad: 25,
      rangoEdad: 'Adulto (+18)',
      fechaRegistro: '2026-11-20T12:00:00.000Z',
    });

    await page.goto('/', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /LISTA DE ESPERA/i })).toBeVisible();

    await fillAndSubmitRegistration(page, {
      paterno: 'Vega',
      materno: 'Solís',
      nombre: 'Daniel',
      bday: '1997-08-10',
      whatsapp: '6189990001',
      email: 'daniel.waitlist@example.test',
      categoria: 'Libre',
      waitlistMode: true,
    });
    await expect(page.locator('[data-testid="waitlist-success-banner"]')).toBeVisible();

    // Inscripciones cerradas por bandera
    await patchDoc('configuracion', 'general', { inscripcionesAbiertas: false });
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /Inscripciones Cerradas/i })).toBeVisible();

    // Inscripciones cerradas por fecha límite pasada
    await patchDoc('configuracion', 'general', {
      inscripcionesAbiertas: true,
      cupoMaximo: 100,
      fechaLimiteIso: '2020-01-01T00:00:00-06:00',
      fechaLimiteTimestamp: new Date('2020-01-01T06:00:00Z'),
    });
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /Inscripciones Cerradas/i })).toBeVisible();

    // Flujo 5: Datos de pago placeholder bloquean el formulario
    await patchDoc('configuracion', 'general', {
      fechaLimiteIso: '2099-12-19T15:30:00-06:00',
      fechaLimiteTimestamp: new Date('2099-12-19T21:30:00Z'),
      clabe: '000000000000000000',
      banco: 'Por confirmar',
      titular: 'Comité Organizador',
      whatsappContacto: '0000000000',
    });
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('[data-testid="payment-placeholder-blocked"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-registration-btn"]')).toBeDisabled();
  });

  test('Flujo 6: Admin no autorizado recibe mensaje claro; admin autorizado valida pago, abre recibo PDF en visor sandbox, edita, exporta, usa papelera, purga y anonimiza', async ({
    page,
  }) => {
    const pId = 'e2e_p_pdf';
    const rId = 'e2e_r_pdf';
    const createdIso = '2026-11-20T12:00:00.000Z';
    const pdfDataUrl = `data:application/pdf;base64,${PDF_MIN.toString('base64')}`;

    await patchDoc('comprobantes', rId, {
      participantId: pId,
      folio: 'PAVO-E2EPDF',
      participantNombre: 'Sánchez Ruiz Elena',
      fileName: 'comprobante_elena.pdf',
      mimeType: 'application/pdf',
      fileSize: pdfDataUrl.length,
      imageDataUrl: pdfDataUrl,
      uploadedAt: createdIso,
    });
    await patchDoc('participantes', pId, {
      nombre: 'Sánchez Ruiz Elena',
      fechaNacimiento: '1995-07-04',
      whatsapp: '6181234599',
      correo: 'elena@example.test',
      categoria: 'Libre',
      estatusPago: 'pendiente',
      fechaRegistro: createdIso,
      folio: 'PAVO-E2EPDF',
      esAficionado: true,
      esFemenil: true,
      tieneRecibo: true,
      reciboId: rId,
      reciboNombreArchivo: 'comprobante_elena.pdf',
      aceptoAviso: true,
      aceptoAvisoVersion: '2026-11-v1',
      fechaConsentimiento: createdIso,
    });
    await patchDoc('participantes_publicos', pId, {
      folio: 'PAVO-E2EPDF',
      nombre: 'Sánchez R. E.',
      categoria: 'Libre',
      esAficionado: true,
      esFemenil: true,
      estatusPago: 'pendiente',
      edad: 31,
      rangoEdad: 'Adulto (+18)',
      fechaRegistro: createdIso,
    });

    await page.goto('/admin', { waitUntil: 'load' });

    // Usuario no-admin ve mensaje claro y no accede
    await signInViaAuthEmulatorPopup(page, 'jugador.normal@example.test');
    await expect(page.getByText(/Tu cuenta no tiene permisos de administrador/i)).toBeVisible();
    await page.getByRole('button', { name: /Cerrar sesión/i }).click();

    // Admin legítimo entra
    await signInViaAuthEmulatorPopup(page, 'admin.torneo@example.test');
    await expect(page.getByRole('heading', { name: /ADMINISTRADOR/i })).toBeVisible();
    await expect(page.getByText('PAVO-E2EPDF')).toBeVisible();

    // Abrir visor de PDF bajo la CSP y verificar iframe sandbox
    const cspErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('content security policy')) {
        cspErrors.push(msg.text());
      }
    });
    await page.getByRole('button', { name: /Ver recibo/i }).first().click();
    const pdfIframe = page.locator('iframe[sandbox=""]');
    await expect(pdfIframe).toBeVisible();
    const iframeSrc = await pdfIframe.getAttribute('src');
    expect(iframeSrc).toMatch(/^blob:/);
    await page.getByRole('button', { name: /Marcar Pagado/i }).click();
    await expect(page.getByRole('button', { name: /Pago Confirmado/i })).toBeVisible();
    await page.getByRole('button', { name: /Cerrar visor de comprobante/i }).first().click();
    expect(cspErrors).toEqual([]);

    // Editar participante
    await page.getByRole('button', { name: /Editar a Sánchez Ruiz Elena/i }).click();
    await page.getByLabel(/Nombre completo/i).fill('Sánchez Ruiz Elena Editada');
    await page.getByRole('button', { name: /Guardar Cambios/i }).click();
    await expect(page.getByText('Sánchez Ruiz Elena Editada')).toBeVisible();

    // Exportaciones Excel, PDF y Suizo
    const [dlPdf] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="admin-export-pdf"]').click(),
    ]);
    expect(dlPdf.suggestedFilename()).toMatch(/\.pdf$/i);

    const [dlXlsx] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="admin-export-excel"]').click(),
    ]);
    expect(dlXlsx.suggestedFilename()).toMatch(/\.xlsx$/i);

    const [dlSwiss] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Suizo' }).click(),
    ]);
    expect(dlSwiss.suggestedFilename()).toMatch(/\.csv$/i);

    // Papelera y restauración
    await page.getByRole('button', { name: /Enviar a papelera a Sánchez Ruiz Elena Editada/i }).click();
    await page.getByRole('button', { name: /Sí, mover a papelera/i }).click();
    await page.getByRole('tab', { name: /Papelera \(1\)/i }).click();
    await expect(page.getByText('Sánchez Ruiz Elena Editada')).toBeVisible();
    await page.getByRole('button', { name: /Restaurar a Sánchez Ruiz Elena Editada/i }).click();
    await page.getByRole('tab', { name: /Activos \(1\)/i }).click();
    await expect(page.getByText('Sánchez Ruiz Elena Editada')).toBeVisible();

    // Purgar comprobantes y anonimizar
    await page.getByRole('button', { name: /Purgar comprobantes/i }).click();
    await page.getByRole('button', { name: /Sí, purgar comprobantes/i }).click();
    await expect(page.getByText(/Se purgaron 1 comprobantes/i)).toBeVisible();

    await page.getByRole('button', { name: /Anonimizar post-torneo/i }).click();
    await page.getByRole('button', { name: /Sí, anonimizar todo/i }).click();
    await expect(page.getByText(/Participante PAVO-E2EPDF/)).toBeVisible();
  });

  test('Flujos 7 y 8: URL malformada (#admin-recibo=%) sin caída; rutas profundas (/admin y /participantes) con F5 sin 404', async ({
    page,
  }) => {
    // 7. Hash malformado
    await page.goto('/#admin-recibo=%', { waitUntil: 'load' });
    await expect(page.getByText(/El enlace del comprobante está incompleto/i)).toBeVisible();

    // 8. Rutas profundas con recarga F5 sin 404
    const resParticipantes = await page.goto('/participantes', { waitUntil: 'load' });
    expect(resParticipantes?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /Padrón Oficial de Participantes/i })).toBeVisible();
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /Padrón Oficial de Participantes/i })).toBeVisible();

    const resAdmin = await page.goto('/admin', { waitUntil: 'load' });
    expect(resAdmin?.status()).toBe(200);
    await expect(page.locator('[data-testid="admin-google-signin"]')).toBeVisible();
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('[data-testid="admin-google-signin"]')).toBeVisible();
  });

  test('Flujo 9: Intentos de abuso desde el navegador (/participantes read, data:text/html, campos extra) son denegados por Firestore Rules', async ({
    page,
  }) => {
    await patchDoc('participantes', 'secret_p1', {
      nombre: 'Secreto Privado',
      fechaNacimiento: '1990-01-01',
      whatsapp: '6180001122',
      correo: 'privado@example.test',
      categoria: 'Libre',
      estatusPago: 'pendiente',
      fechaRegistro: '2026-11-20T12:00:00.000Z',
      folio: 'PAVO-SEC001',
    });

    await page.goto('/', { waitUntil: 'load' });

    const abuseResults = await page.evaluate(async ({ firestoreHost, projectId }) => {
      const base = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents`;
      const readPriv = await fetch(`${base}/participantes/secret_p1`);
      const htmlReceipt = await fetch(`${base}/comprobantes?documentId=evil_html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            participantId: { stringValue: 'evil_p1' },
            folio: { stringValue: 'PAVO-EVIL01' },
            participantNombre: { stringValue: 'Abuso Html' },
            fileName: { stringValue: 'evil.html' },
            mimeType: { stringValue: 'text/html' },
            fileSize: { integerValue: '20' },
            imageDataUrl: { stringValue: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' },
            uploadedAt: { stringValue: '2026-11-20T12:00:00.000Z' },
          },
        }),
      });
      const extraField = await fetch(`${base}/participantes?documentId=evil_extra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            nombre: { stringValue: 'Abuso Extra' },
            fechaNacimiento: { stringValue: '1995-01-01' },
            whatsapp: { stringValue: '6181112233' },
            correo: { stringValue: 'abuso@example.test' },
            categoria: { stringValue: 'Libre' },
            estatusPago: { stringValue: 'pendiente' },
            fechaRegistro: { stringValue: '2026-11-20T12:00:00.000Z' },
            folio: { stringValue: 'PAVO-EVIL02' },
            esFemenil: { booleanValue: false },
            esAficionado: { booleanValue: false },
            isAdmin: { booleanValue: true },
          },
        }),
      });
      return {
        readPrivStatus: readPriv.status,
        htmlReceiptStatus: htmlReceipt.status,
        extraFieldStatus: extraField.status,
      };
    }, { firestoreHost: FIRESTORE_HOST, projectId: PROJECT_ID });

    expect(abuseResults.readPrivStatus).toBe(403);
    expect(abuseResults.htmlReceiptStatus).toBe(403);
    expect(abuseResults.extraFieldStatus).toBe(403);
  });

  test('Flujo 10: Accesibilidad con axe-core en vistas principales (sin violaciones críticas o serias)', async ({
    page,
  }) => {
    for (const route of ['/', '/participantes', '/admin']) {
      await page.goto(route, { waitUntil: 'load' });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const severe = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(severe, `Violaciones graves en ${route}: ${JSON.stringify(severe)}`).toEqual([]);
    }

    // Verificar además que public/_headers y dist/404.html cumplan con Cloudflare Pages
    const distHeaders = path.resolve(process.cwd(), 'dist/_headers');
    if (fs.existsSync(distHeaders)) {
      expect(fs.existsSync(path.resolve(process.cwd(), 'dist/404.html'))).toBe(false);
    }
  });
});

// Evitar warning de unused import en caso de uso parcial
void createHash;
