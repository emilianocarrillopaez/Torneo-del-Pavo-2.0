import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCountdown,
  shuffleArray,
  calculateAgeAtTournament,
  validateRegistrationInput,
  validateReceiptFileMeta,
  buildParticipantExportRows,
  buildPublicExportRows,
  buildTournamentExportSummary,
  buildSwissPairingRows,
  generateSecureFolio,
  safeHttpUrl,
  formatWhatsAppUrl,
  sanitizeSpreadsheetCell,
  normalizeEmailKey,
  normalizeWhatsappKey,
  sha256Hex,
  formatPublicParticipantName,
  deriveAgeCutoffs,
  toPublicParticipantPayload,
  findPossibleDuplicates,
  buildParticipantNames,
  PARTICIPANT_FULL_NAME_REGEX,
} from './tournamentUtils';
import {
  generateHeadersFileContent,
  getProductionSecurityHeaders,
  getPreviewHeaders,
  assertCloudflareHeaderLimits,
  CLOUDFLARE_MAX_LINE_LENGTH,
} from '../../scripts/security-headers.mjs';
import {
  validateReceiptMagicBytes,
  isSafeReceiptDataUrl,
  sanitizeReceiptFileName,
} from './receiptUtils';
import { evaluatePaymentConfig, isPlaceholderPaymentConfig } from './paymentConfig';
import { classifyAndFormatError } from './errorMessages';
import { DEFAULT_CONFIG, Participant, PublicParticipant } from '../types/tournament';

test('computeCountdown calculates exact remaining days, hours, minutes, and seconds', () => {
  const target = '2026-12-19T16:30:00-06:00';
  const targetMs = Date.parse(target);
  const diffMs = ((2 * 86400) + (5 * 3600) + (14 * 60) + 33) * 1000;
  const res = computeCountdown(target, targetMs - diffMs);

  assert.equal(res.isStarted, false);
  assert.equal(res.days, 2);
  assert.equal(res.hours, 5);
  assert.equal(res.minutes, 14);
  assert.equal(res.seconds, 33);
});

test('computeCountdown handles elapsed event dates and invalid dates safely', () => {
  const target = '2026-12-19T16:30:00-06:00';
  const res = computeCountdown(target, Date.parse(target) + 60_000);

  assert.equal(res.isStarted, true);
  assert.equal(res.days, 0);
  assert.equal(res.hours, 0);
  assert.equal(res.minutes, 0);
  assert.equal(res.seconds, 0);

  const fallbackRes = computeCountdown('invalid-date', Date.parse(target) - 86_400_000);
  assert.equal(fallbackRes.days, 1);
});

test('shuffleArray preserves all items without mutating original array', () => {
  const original = ['A', 'B', 'C', 'D', 'E'];
  const shuffled = shuffleArray(original, () => 0.3);

  assert.deepEqual(original, ['A', 'B', 'C', 'D', 'E']);
  assert.equal(shuffled.length, original.length);
  assert.deepEqual([...shuffled].sort(), [...original].sort());
});

test('calculateAgeAtTournament handles exact birthday boundaries and leap year Feb 29', () => {
  // Torneo el 2026-12-19
  assert.equal(calculateAgeAtTournament('2008-12-19', '2026-12-19T16:30:00-06:00'), 18); // Cumple el día del torneo
  assert.equal(calculateAgeAtTournament('2008-12-18', '2026-12-19T16:30:00-06:00'), 18); // Un día antes
  assert.equal(calculateAgeAtTournament('2008-12-20', '2026-12-19T16:30:00-06:00'), 17); // Un día después -> menor

  assert.equal(calculateAgeAtTournament('2007-12-19', '2026-12-19T16:30:00-06:00'), 19); // Ya tiene 19 -> Libre
  assert.equal(calculateAgeAtTournament('2007-12-20', '2026-12-19T16:30:00-06:00'), 18); // Todavía 18 -> Juvenil

  // Año bisiesto: nacido el 29 de febrero de 2008
  assert.equal(calculateAgeAtTournament('2008-02-29', '2026-02-28T16:00:00-06:00'), 17);
  assert.equal(calculateAgeAtTournament('2008-02-29', '2026-03-01T16:00:00-06:00'), 18);
  assert.equal(calculateAgeAtTournament('2026-02-29', '2026-12-19T16:30:00-06:00'), null); // 2026 no es bisiesto
  assert.equal(calculateAgeAtTournament(''), null);
});

test('deriveAgeCutoffs derives dynamic legal and Juvenil cutoffs from fechaIso', () => {
  const cutoffs2026 = deriveAgeCutoffs('2026-12-19T16:30:00-06:00');
  assert.equal(cutoffs2026.fechaCorteMayoriaEdad, '2008-12-19');
  assert.equal(cutoffs2026.fechaCorteJuvenil, '2007-12-19');
  assert.equal(cutoffs2026.juvenilMinBirthYmd, '2007-12-20');

  const cutoffs2027 = deriveAgeCutoffs('2027-12-18T16:30:00-06:00');
  assert.equal(cutoffs2027.fechaCorteMayoriaEdad, '2009-12-18');
  assert.equal(cutoffs2027.fechaCorteJuvenil, '2008-12-18');
  assert.equal(cutoffs2027.juvenilMinBirthYmd, '2008-12-19');
});

test('toPublicParticipantPayload omits exact age for minors and keeps only range', () => {
  const minorPayload = toPublicParticipantPayload(
    {
      nombre: 'López Ruiz Sofía',
      fechaNacimiento: '2012-05-10',
      whatsapp: '6181234567',
      correo: 'sofia@example.com',
      categoria: 'Juvenil',
      estatusPago: 'pendiente',
      fechaRegistro: '2026-11-20T12:00:00.000Z',
      folio: 'PAVO-ABC234',
      esAficionado: false,
      esFemenil: true,
    },
    true,
    '2026-12-19T16:30:00-06:00'
  );
  assert.equal('edad' in minorPayload, false);
  assert.equal(minorPayload.rangoEdad, 'Juvenil (13–18)');
  assert.equal(minorPayload.nombre, 'López R. S.');

  const adultPayload = toPublicParticipantPayload(
    {
      nombre: 'García Pérez Ana',
      fechaNacimiento: '2008-12-19',
      whatsapp: '6181234567',
      correo: 'ana@example.com',
      categoria: 'Juvenil',
      estatusPago: 'pagado',
      fechaRegistro: '2026-11-20T12:00:00.000Z',
      folio: 'PAVO-XYZ789',
      esAficionado: false,
      esFemenil: true,
    },
    true,
    '2026-12-19T16:30:00-06:00'
  );
  assert.equal(adultPayload.edad, 18);
  assert.equal(adultPayload.rangoEdad, 'Juvenil (13–18)');
});

test('validateRegistrationInput enforces receipt, privacy notice, age coherence, future dates, and minor tutor consent', () => {
  const missingReceipt = validateRegistrationInput({
    paterno: 'Carrillo',
    materno: 'Páez',
    nombre: 'Emiliano',
    fechaNacimiento: '1995-05-10',
    whatsapp: '618 123-4567',
    correo: 'test@example.com',
    categoria: 'Libre',
    hasReceipt: false,
    aceptoAviso: true,
  });
  assert.ok(missingReceipt.recibo, 'Missing receipt must return validation error');
  assert.equal(missingReceipt.whatsapp, undefined, 'Spaces/hyphens should normalize to 10 digits');

  const futureDate = validateRegistrationInput(
    {
      paterno: 'Carrillo',
      materno: 'Páez',
      nombre: 'Emiliano',
      fechaNacimiento: '2028-01-01',
      whatsapp: '6181234567',
      correo: 'test@example.com',
      categoria: 'Libre',
      hasReceipt: true,
      aceptoAviso: true,
    },
    '2026-12-19T16:30:00-06:00',
    '2026-11-20'
  );
  assert.ok(futureDate.fechaNacimiento);

  const missingPrivacy = validateRegistrationInput({
    paterno: 'Carrillo',
    materno: 'Páez',
    nombre: 'Emiliano',
    fechaNacimiento: '1995-05-10',
    whatsapp: '6181234567',
    correo: 'test@example.com',
    categoria: 'Libre',
    hasReceipt: true,
    aceptoAviso: false,
  });
  assert.ok(missingPrivacy.privacidad, 'Missing privacy acceptance must return error');

  const ageMismatch = validateRegistrationInput({
    paterno: 'López',
    materno: 'Ruiz',
    nombre: 'Carlos',
    fechaNacimiento: '2000-01-01',
    whatsapp: '6181234567',
    correo: 'carlos@example.com',
    categoria: 'Juvenil',
    hasReceipt: true,
    aceptoAviso: true,
  });
  assert.ok(ageMismatch.categoria, 'Player over 18 cannot register in Juvenil');

  const minorWithoutTutor = validateRegistrationInput({
    paterno: 'López',
    materno: 'Ruiz',
    nombre: 'Sofía',
    fechaNacimiento: '2010-03-12',
    whatsapp: '6189876543',
    correo: 'sofia@example.com',
    categoria: 'Juvenil',
    hasReceipt: true,
    aceptoAviso: true,
    consentimientoTutor: false,
    nombreTutor: '',
  });
  assert.ok(minorWithoutTutor.tutor, 'Minor under 18 must provide tutor name and consent');

  const validMinor = validateRegistrationInput({
    paterno: 'López',
    materno: 'Ruiz',
    nombre: 'Sofía',
    fechaNacimiento: '2010-03-12',
    whatsapp: '6189876543',
    correo: 'sofia@example.com',
    categoria: 'Juvenil',
    hasReceipt: true,
    aceptoAviso: true,
    consentimientoTutor: true,
    nombreTutor: 'María Ruiz Pérez',
  });
  assert.deepEqual(validMinor, {});
});

test('isPlaceholderPaymentConfig detects missing or example payment data reliably', () => {
  assert.equal(isPlaceholderPaymentConfig(DEFAULT_CONFIG), true);
  assert.equal(evaluatePaymentConfig(DEFAULT_CONFIG).missingFields.length, 4);

  const partial = {
    ...DEFAULT_CONFIG,
    clabe: '012190001234567890',
    banco: 'BBVA',
    titular: 'Club de Ajedrez Don Gonzalo',
  };
  assert.equal(isPlaceholderPaymentConfig(partial), true);
  assert.deepEqual(evaluatePaymentConfig(partial).missingFields, ['WhatsApp de contacto (10 dígitos)']);

  const complete = {
    clabe: '012190001234567890',
    banco: 'BBVA México',
    titular: 'Eduardo Roqueta',
    whatsappContacto: '6181234567',
  };
  assert.equal(isPlaceholderPaymentConfig(complete), false);
});

test('validateReceiptFileMeta rejects unsupported mime types and oversized files', () => {
  assert.equal(validateReceiptFileMeta('image/jpeg', 200_000), null);
  assert.equal(validateReceiptFileMeta('application/pdf', 500_000), null);
  assert.ok(validateReceiptFileMeta('text/plain', 100));
  assert.ok(validateReceiptFileMeta('image/png', 10 * 1024 * 1024));
});

test('receiptUtils validates magic bytes, safe data URLs, and file names', () => {
  assert.equal(validateReceiptMagicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'), true);
  assert.equal(validateReceiptMagicBytes(new Uint8Array([0x3c, 0x73, 0x76, 0x67]), 'image/jpeg'), false);

  assert.equal(
    validateReceiptMagicBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'),
    true
  );

  assert.equal(
    validateReceiptMagicBytes(
      new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
      'image/webp'
    ),
    true
  );

  assert.equal(validateReceiptMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'application/pdf'), true);

  assert.equal(isSafeReceiptDataUrl('data:image/jpeg;base64,/9j/4AAQ', 'image/jpeg'), true);
  assert.equal(isSafeReceiptDataUrl('data:text/html;base64,PHNjcmlwdD4=', 'image/jpeg'), false);
  assert.equal(isSafeReceiptDataUrl('https://evil.example/receipt.jpg', 'image/jpeg'), false);
  assert.equal(sanitizeReceiptFileName('../../evil/recibo?.jpg'), '.._.._evil_recibo_.jpg');
});

test('generateSecureFolio produces unpredictable 6-char folios', () => {
  const folios = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const f = generateSecureFolio();
    assert.match(f, /^PAVO-[A-HJ-NP-Z2-9]{6}$/);
    folios.add(f);
  }
  assert.ok(folios.size >= 38, 'Random 6-char folios should not collide');
  assert.match(generateSecureFolio(6, 'ESPERA'), /^ESPERA-[A-HJ-NP-Z2-9]{6}$/);
});

test('safeHttpUrl and formatWhatsAppUrl block dangerous URL protocols', () => {
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(safeHttpUrl('http://insecure.example.com'), null);
  assert.equal(safeHttpUrl('#', { allowHash: true }), '#');
  assert.equal(safeHttpUrl('https://maps.app.goo.gl/abc'), 'https://maps.app.goo.gl/abc');

  assert.equal(formatWhatsAppUrl('0000000000', 'hola'), null);
  assert.equal(formatWhatsAppUrl('618-123-4567', 'hola\nfolio'), 'https://wa.me/526181234567?text=hola%0Afolio');
});

test('sanitizeSpreadsheetCell neutralizes formula injection prefixes', () => {
  assert.equal(sanitizeSpreadsheetCell('=CMD|"/C calc"!A0'), '\'=CMD|"/C calc"!A0');
  assert.equal(sanitizeSpreadsheetCell('+1+1'), '\'+1+1');
  assert.equal(sanitizeSpreadsheetCell('-10'), '\'-10');
  assert.equal(sanitizeSpreadsheetCell('@SUM(A1:A2)'), '\'@SUM(A1:A2)');
  assert.equal(sanitizeSpreadsheetCell('Juan Pérez'), 'Juan Pérez');
  assert.equal(sanitizeSpreadsheetCell(200), 200);
});

test('sha256Hex and normalization helpers create deterministic duplicate hashes', async () => {
  assert.equal(normalizeEmailKey(' Test@Example.COM '), 'test@example.com');
  assert.equal(normalizeWhatsappKey('+52 (618) 123-4567'), '6181234567');
  const h1 = await sha256Hex('email:test@example.com');
  const h2 = await sha256Hex('email:test@example.com');
  assert.match(h1, /^[a-f0-9]{64}$/);
  assert.equal(h1, h2);
});

test('findPossibleDuplicates flags matching email, phone, or fuzzy accent-insensitive name', () => {
  const list: Participant[] = [
    {
      id: 'a1',
      nombre: 'García Pérez José',
      fechaNacimiento: '1995-01-01',
      whatsapp: '6181112222',
      correo: 'jose@example.com',
      categoria: 'Libre',
      estatusPago: 'pendiente',
      fechaRegistro: '2026-11-20T10:00:00Z',
      folio: 'PAVO-AAA111',
    },
    {
      id: 'a2',
      nombre: 'Garcia  Perez Jose',
      fechaNacimiento: '1995-01-01',
      whatsapp: '6189998888',
      correo: 'otro@example.com',
      categoria: 'Libre',
      estatusPago: 'pendiente',
      fechaRegistro: '2026-11-20T10:05:00Z',
      folio: 'PAVO-BBB222',
    },
    {
      id: 'a3',
      nombre: 'Luis Torres',
      fechaNacimiento: '1999-02-02',
      whatsapp: '6181112222',
      correo: 'luis@example.com',
      categoria: 'Libre',
      estatusPago: 'pagado',
      fechaRegistro: '2026-11-20T10:10:00Z',
      folio: 'PAVO-CCC333',
    },
  ];
  const dups = findPossibleDuplicates(list);
  assert.ok(dups.get('a1')?.includes('Nombre coincidente'));
  assert.ok(dups.get('a1')?.includes('Mismo WhatsApp'));
  assert.ok(dups.get('a2')?.includes('Nombre coincidente'));
  assert.ok(dups.get('a3')?.includes('Mismo WhatsApp'));
});

test('public vs admin exports and Swiss pairing export isolate PII properly', () => {
  assert.equal(formatPublicParticipantName('García Pérez Ana', true), 'García P. A.');
  assert.equal(formatPublicParticipantName('García Pérez Ana', false), 'García Pérez Ana');

  const sample: Participant[] = [
    {
      id: 'p1',
      folio: 'PAVO-1001AB',
      nombre: 'García Pérez Ana',
      fechaNacimiento: '2001-06-15',
      whatsapp: '6181112222',
      correo: 'ana@example.com',
      categoria: 'Libre',
      estatusPago: 'pagado',
      fechaRegistro: '2026-11-18T10:00:00.000Z',
      esAficionado: true,
      esFemenil: true,
      tieneRecibo: true,
      reciboId: 'rec_abc123',
      asistencia: true,
    },
  ];

  const pubSample: PublicParticipant[] = [
    {
      id: 'p1',
      folio: 'PAVO-1001AB',
      nombre: 'García P. A.',
      categoria: 'Libre',
      esAficionado: true,
      esFemenil: true,
      estatusPago: 'pagado',
      edad: 25,
      rangoEdad: 'Adulto (+18)',
      fechaRegistro: '2026-11-18T10:00:00.000Z',
    },
  ];

  const publicRows = buildPublicExportRows(pubSample);
  assert.equal('correo' in publicRows[0], false);
  assert.equal('whatsapp' in publicRows[0], false);
  assert.equal('reciboLink' in publicRows[0], false);

  const adminRows = buildParticipantExportRows(sample, {
    includeAdminReceiptLinks: true,
    origin: 'https://torneo.example.com',
  });
  assert.equal(adminRows[0].reciboLink, 'https://torneo.example.com/#admin-recibo=rec_abc123');
  assert.equal(adminRows[0].asistencia, 'Presente');

  const swiss = buildSwissPairingRows(sample);
  assert.equal(swiss[0].sex, 'F');
  assert.equal(swiss[0].birthYear, '2001');
  assert.equal(swiss[0].paid, 'SI');

  const summary = buildTournamentExportSummary(sample, { costo: 200, cupoMaximo: 100 });
  assert.equal(summary.recaudacionConfirmada, 200);
  assert.equal(summary.totalConRecibo, 1);
  assert.equal(summary.totalAsistencias, 1);
  assert.equal(summary.lugaresDisponibles, 99);
});

test('classifyAndFormatError returns actionable Spanish messages without leaking internal codes', () => {
  assert.equal(classifyAndFormatError({ code: 'resource-exhausted' }).category, 'rate-limit');
  assert.equal(classifyAndFormatError({ code: 'already-exists' }).category, 'duplicate');
  assert.equal(classifyAndFormatError({ code: 'unavailable' }).category, 'offline');
  assert.equal(classifyAndFormatError(new Error('Error de App Check')).category, 'app-check');
});

test('buildParticipantNames & validateRegistrationInput handle compound names, particles, apostrophes, hyphens, accents, and umlauts consistently', () => {
  const realWorldCases = [
    { paterno: 'De la Cruz', materno: 'Del Río', nombre: 'María José' },
    { paterno: "O'Connor", materno: 'Pérez-Soto', nombre: 'Chloë' },
    { paterno: 'Nuñez', materno: 'Müller', nombre: 'François' },
    { paterno: 'Íñiguez', materno: '', nombre: 'Ïñigo' },
    { paterno: 'López', materno: '', nombre: 'Sofía' },
  ];

  for (const c of realWorldCases) {
    const { privateName, publicName } = buildParticipantNames(c, true);
    assert.equal(
      publicName.split(' ')[0],
      privateName.split(' ')[0],
      `First word must match for rule validatePublicRosterMatch: ${privateName} vs ${publicName}`
    );
    assert.match(privateName, PARTICIPANT_FULL_NAME_REGEX);
    assert.match(publicName, PARTICIPANT_FULL_NAME_REGEX);

    const errs = validateRegistrationInput({
      ...c,
      fechaNacimiento: '1995-05-10',
      whatsapp: '6181234567',
      correo: 'jugador.prueba@example.com',
      categoria: 'Libre',
      hasReceipt: true,
      aceptoAviso: true,
    });
    assert.deepEqual(errs, {}, `Valid name should pass validation: ${privateName}`);
  }
});

test('security-headers single source of truth enforces Cloudflare Pages limits and safe CSP rules', () => {
  const headersContent = generateHeadersFileContent();
  const stats = assertCloudflareHeaderLimits(headersContent);

  assert.ok(stats.maxLineLength <= CLOUDFLARE_MAX_LINE_LENGTH);
  assert.ok(stats.ruleCount <= 100);
  assert.equal(/Cross-Origin-Opener-Policy\s*:\s*same-origin/i.test(headersContent), false);

  const prod = getProductionSecurityHeaders();
  const preview = getPreviewHeaders();

  const prodScriptSrc =
    prod['Content-Security-Policy']
      .split(';')
      .find((d) => d.trim().startsWith('script-src')) || '';
  assert.equal(prodScriptSrc.includes('unsafe-inline'), false);
  assert.equal(prodScriptSrc.includes('unsafe-eval'), false);
  assert.ok(prod['Content-Security-Policy'].includes('yogic-decoder-5lxdt.firebaseapp.com'));
  assert.ok(prod['Content-Security-Policy'].includes('upgrade-insecure-requests'));
  assert.equal(preview['Content-Security-Policy'].includes('upgrade-insecure-requests'), false);

  // Confirmar que preview y producción comparten exactamente las mismas directivas base salvo upgrade-insecure-requests
  const normalizedProd = prod['Content-Security-Policy']
    .replace('; upgrade-insecure-requests', '')
    .trim();
  assert.equal(preview['Content-Security-Policy'].trim(), normalizedProd);

  // Ajuste B y G: caché de /img/* y X-Robots-Tag en /participantes
  assert.ok(headersContent.includes('/img/*\n  Cache-Control: public, max-age=86400'));
  assert.ok(headersContent.includes('/assets/*\n  Cache-Control: public, max-age=31536000, immutable'));
  assert.ok(headersContent.includes('/participantes\n  X-Robots-Tag: noindex, nofollow'));
  assert.ok(headersContent.includes('/participantes/*\n  X-Robots-Tag: noindex, nofollow'));
});

test('generate-seo-files blocks forbidden internal files in public/ and excludes /participantes from robots/sitemap', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const {
    assertNoForbiddenPublicFiles,
    generateSeoAndHeaderFiles,
    DEFAULT_SITE_URL,
  } = await import('../../scripts/generate-seo-files.mjs');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pavo-public-test-'));
  try {
    // 1. Válido con robots.txt e img/
    fs.mkdirSync(path.join(tmpRoot, 'img'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'img', 'cartel-2026.webp'), 'ok', 'utf8');
    fs.writeFileSync(path.join(tmpRoot, 'robots.txt'), 'User-agent: *\n', 'utf8');
    assert.doesNotThrow(() => assertNoForbiddenPublicFiles(tmpRoot));

    const prevSiteUrl = process.env.VITE_SITE_URL;
    process.env.VITE_SITE_URL = DEFAULT_SITE_URL;
    try {
      const { siteUrl } = generateSeoAndHeaderFiles({ strict: true, publicDir: tmpRoot });
      assert.equal(siteUrl, 'https://torneo-del-pavo.pages.dev');
    } finally {
      if (prevSiteUrl === undefined) delete process.env.VITE_SITE_URL;
      else process.env.VITE_SITE_URL = prevSiteUrl;
    }

    const robots = fs.readFileSync(path.join(tmpRoot, 'robots.txt'), 'utf8');
    const sitemap = fs.readFileSync(path.join(tmpRoot, 'sitemap.xml'), 'utf8');
    assert.equal(robots.includes('/participantes'), false);
    assert.equal(sitemap.includes('/participantes'), false);
    assert.ok(sitemap.includes('https://torneo-del-pavo.pages.dev/'));

    // 2. Bloquea .md, .txt distinto a robots.txt, .log y carpetas aistudio/docs
    const mdFile = path.join(tmpRoot, 'nota.md');
    fs.writeFileSync(mdFile, '# secreto', 'utf8');
    assert.throws(() => assertNoForbiddenPublicFiles(tmpRoot), /nota\.md/);
    fs.unlinkSync(mdFile);

    const txtFile = path.join(tmpRoot, 'notas.txt');
    fs.writeFileSync(txtFile, 'secreto', 'utf8');
    assert.throws(() => assertNoForbiddenPublicFiles(tmpRoot), /notas\.txt/);
    fs.unlinkSync(txtFile);

    const logFile = path.join(tmpRoot, 'debug.log');
    fs.writeFileSync(logFile, 'log', 'utf8');
    assert.throws(() => assertNoForbiddenPublicFiles(tmpRoot), /debug\.log/);
    fs.unlinkSync(logFile);

    const aistudioDir = path.join(tmpRoot, 'assets', 'aistudio');
    fs.mkdirSync(aistudioDir, { recursive: true });
    assert.throws(() => assertNoForbiddenPublicFiles(tmpRoot), /aistudio/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('check-wrangler-config validates valid wrangler.jsonc (with comments) and rejects every invalid configuration', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { validateWranglerConfig } = await import('../../scripts/check-wrangler-config.mjs');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pavo-wrangler-test-'));
  try {
    // 1. Archivo faltante
    assert.throws(() => validateWranglerConfig(tmpRoot), /Falta wrangler\.jsonc/);

    // 2. Configuración válida con comentarios JSONC y URL literal https:// (no se debe cortar como comentario)
    const wranglerFile = path.join(tmpRoot, 'wrangler.jsonc');
    fs.writeFileSync(
      wranglerFile,
      `{
        // Comentario de línea https://ejemplo.com
        /* Bloque multilínea */
        "name": "torneo-del-pavo-2-0",
        "compatibility_date": "2026-11-25",
        "assets": {
          "directory": "./dist",
          "not_found_handling": "single-page-application",
        },
      }`,
      'utf8'
    );
    const okConfig = validateWranglerConfig(tmpRoot);
    assert.equal(okConfig.name, 'torneo-del-pavo-2-0');

    // 3. Nombre distinto
    fs.writeFileSync(
      wranglerFile,
      JSON.stringify({
        name: 'otro-worker',
        assets: { directory: './dist', not_found_handling: 'single-page-application' },
      }),
      'utf8'
    );
    assert.throws(() => validateWranglerConfig(tmpRoot), /torneo-del-pavo-2-0/);

    // 4. Directorio distinto de ./dist
    fs.writeFileSync(
      wranglerFile,
      JSON.stringify({
        name: 'torneo-del-pavo-2-0',
        assets: { directory: './build', not_found_handling: 'single-page-application' },
      }),
      'utf8'
    );
    assert.throws(() => validateWranglerConfig(tmpRoot), /assets\.directory/);

    // 5. not_found_handling distinto de single-page-application
    fs.writeFileSync(
      wranglerFile,
      JSON.stringify({
        name: 'torneo-del-pavo-2-0',
        assets: { directory: './dist', not_found_handling: '404-page' },
      }),
      'utf8'
    );
    assert.throws(() => validateWranglerConfig(tmpRoot), /not_found_handling/);

    // 6. Presencia de "main"
    fs.writeFileSync(
      wranglerFile,
      JSON.stringify({
        name: 'torneo-del-pavo-2-0',
        main: 'src/worker.ts',
        assets: { directory: './dist', not_found_handling: 'single-page-application' },
      }),
      'utf8'
    );
    assert.throws(() => validateWranglerConfig(tmpRoot), /"main"/);

    // 7. Existencia de dist/404.html
    fs.writeFileSync(
      wranglerFile,
      JSON.stringify({
        name: 'torneo-del-pavo-2-0',
        assets: { directory: './dist', not_found_handling: 'single-page-application' },
      }),
      'utf8'
    );
    fs.mkdirSync(path.join(tmpRoot, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'dist', '404.html'), '<h1>404</h1>', 'utf8');
    assert.throws(() => validateWranglerConfig(tmpRoot), /dist\/404\.html/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('parseJavaMajorVersion parses Java 8, 17, 21+, and invalid outputs accurately', async () => {
  const { parseJavaMajorVersion } = await import('../../scripts/run-rules-tests.mjs');

  assert.equal(parseJavaMajorVersion('openjdk version "21.0.5" 2024-10-15 LTS'), 21);
  assert.equal(parseJavaMajorVersion('java version "23.0.1" 2024-10-15'), 23);
  assert.equal(parseJavaMajorVersion('openjdk version "17.0.12" 2024-07-16'), 17);
  assert.equal(parseJavaMajorVersion('java version "1.8.0_402"'), 8);
  assert.equal(parseJavaMajorVersion(''), null);
  assert.equal(parseJavaMajorVersion('not-java-output'), null);
});

test('ci-report.mjs resets reports dir, preserves exit codes, builds concise summary, and blocks secrets', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const {
    cleanReportsDir,
    runCommandWithReport,
    buildJobSummaryMarkdown,
    writeJobSummary,
    assertSafeReportsDir,
  } = await import('../../scripts/ci-report.mjs');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pavo-cireport-test-'));
  const reportsDir = path.join(tmpRoot, 'reports');
  try {
    // 1. cleanReportsDir limpia contenido previo y recrea subcarpetas
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(path.join(reportsDir, 'viejo.txt'), 'residuo', 'utf8');
    cleanReportsDir(reportsDir);
    assert.equal(fs.existsSync(path.join(reportsDir, 'viejo.txt')), false);
    assert.equal(fs.existsSync(path.join(reportsDir, 'playwright')), true);
    assert.equal(fs.existsSync(path.join(reportsDir, 'lighthouse')), true);

    // 2. runCommandWithReport guarda salida y preserva código 0 y distinto de 0
    const okRun = runCommandWithReport({
      stepName: 'echo-ok',
      outputFile: 'ok.txt',
      command: process.execPath,
      args: ['-e', 'console.log("todo bien")'],
      reportsDir,
      echo: false,
    });
    assert.equal(okRun.exitCode, 0);
    assert.match(fs.readFileSync(path.join(reportsDir, 'ok.txt'), 'utf8'), /todo bien/);

    const failRun = runCommandWithReport({
      stepName: 'fail-step',
      outputFile: 'lint.txt',
      command: process.execPath,
      args: [
        '-e',
        'for (let i = 1; i <= 55; i++) console.error("error linea " + i + " token=ghp_1234567890secreto"); process.exit(2);',
      ],
      reportsDir,
      echo: false,
    });
    assert.equal(failRun.exitCode, 2);

    // 3. Summary parsea conteos TAP, Playwright JSON, Lighthouse y recorta errores a <= 40 líneas
    fs.writeFileSync(
      path.join(reportsDir, 'unit-tests.txt'),
      '# tests 14\n# pass 14\n# fail 0\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(reportsDir, 'rules-tests.txt'),
      '# tests 34\n# pass 34\n# fail 0\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(reportsDir, 'playwright', 'results.json'),
      JSON.stringify({ stats: { expected: 6, unexpected: 0, flaky: 0, skipped: 0 } }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(reportsDir, 'audit.txt'),
      '0 vulnerabilities found\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(reportsDir, 'lighthouse', 'manifest.json'),
      JSON.stringify([
        {
          url: 'http://127.0.0.1:4173/',
          summary: { performance: 0.96, accessibility: 1, 'best-practices': 1, seo: 1 },
        },
      ]),
      'utf8'
    );

    const failSummary = buildJobSummaryMarkdown({
      jobName: 'Calidad y Pruebas',
      status: 'failure',
      reportsDir,
    });
    assert.match(failSummary, /❌ Calidad y Pruebas/);
    assert.match(failSummary, /14\/14 aprobadas/);
    assert.match(failSummary, /34\/34 aprobadas/);
    assert.match(failSummary, /6\/6 aprobadas/);
    assert.match(failSummary, /\| `\/` \| 96 \| 100 \| 100 \| 100 \|/);
    assert.equal(failSummary.includes('ghp_1234567890secreto'), false);
    assert.equal(failSummary.includes('error linea 15 '), false);
    assert.ok(failSummary.includes('error linea 16 '));
    assert.ok(failSummary.includes('error linea 55 '));

    const stepSummaryFile = path.join(tmpRoot, 'github_step_summary.md');
    writeJobSummary({
      jobName: 'Calidad y Pruebas',
      status: 'success',
      reportsDir,
      stepSummaryPath: stepSummaryFile,
    });
    assert.match(fs.readFileSync(path.join(reportsDir, 'resumen.md'), 'utf8'), /✅ Calidad y Pruebas/);
    assert.match(fs.readFileSync(stepSummaryFile, 'utf8'), /✅ Calidad y Pruebas/);

    // 4. assertSafeReportsDir bloquea tokens, .env y comprobantes base64
    // Limpiamos lint.txt que contenía ghp_ sintético de prueba arriba antes de validar
    fs.unlinkSync(path.join(reportsDir, 'lint.txt'));
    assert.doesNotThrow(() => assertSafeReportsDir(reportsDir));

    fs.writeFileSync(path.join(reportsDir, '.env.leak'), 'SECRET=1', 'utf8');
    assert.throws(() => assertSafeReportsDir(reportsDir), /\.env\.leak/);
    fs.unlinkSync(path.join(reportsDir, '.env.leak'));

    fs.writeFileSync(
      path.join(reportsDir, 'fuga.txt'),
      'payload=data:image/png;base64,iVBORw0KGgoAAAANS',
      'utf8'
    );
    assert.throws(() => assertSafeReportsDir(reportsDir), /comprobante base64/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('cleanup-old-artifacts.mjs filters only older completed reportes-* artifacts and mocks API cleanup safely', async () => {
  const { selectArtifactsToDelete, selectRunsToDelete, runCleanup } = await import(
    '../../scripts/cleanup-old-artifacts.mjs'
  );

  const artifacts = [
    { id: 1, name: 'reportes-calidad', created_at: '2026-11-24T10:00:00Z', workflow_run: { id: 100 } },
    { id: 2, name: 'reportes-e2e', created_at: '2026-11-24T10:05:00Z', workflow_run: { id: 100 } },
    { id: 3, name: 'backup-manual', created_at: '2026-11-24T09:00:00Z', workflow_run: { id: 99 } },
    { id: 4, name: 'reportes-calidad', created_at: '2026-11-25T09:50:00Z', workflow_run: { id: 150 } },
    { id: 5, name: 'reportes-calidad', created_at: '2026-11-25T10:01:00Z', workflow_run: { id: 200 } },
    { id: 6, name: 'reportes-reglas', created_at: '2026-11-25T10:02:00Z', workflow_run: { id: 201 } },
  ];

  const selected = selectArtifactsToDelete({
    artifacts,
    currentRunId: 200,
    currentRunStartedAt: '2026-11-25T10:00:00Z',
    activeRunIds: new Set(['150']),
  });

  // Solo 1 y 2 deben borrarse (3 no tiene prefijo reportes-, 4 está activo, 5 es actual, 6 es posterior)
  assert.deepEqual(
    selected.map((a) => a.id),
    [1, 2]
  );

  // selectRunsToDelete conserva actual (200) y la última completada (180), borrando 120 y 100
  const runs = [
    { id: 200, status: 'in_progress', created_at: '2026-11-25T10:00:00Z' },
    { id: 190, status: 'queued', created_at: '2026-11-25T09:55:00Z' },
    { id: 180, status: 'completed', created_at: '2026-11-25T09:00:00Z' },
    { id: 120, status: 'completed', created_at: '2026-11-24T18:00:00Z' },
    { id: 100, status: 'completed', created_at: '2026-11-24T10:00:00Z' },
  ];
  assert.deepEqual(
    selectRunsToDelete({ runs, currentRunId: 200 }).map((r) => r.id),
    [120, 100]
  );

  // Simulación completa de runCleanup con fetch mockeado (sin llamadas de red reales)
  const originalFetch = globalThis.fetch;
  const deletedUrls: string[] = [];
  const prevEnv = {
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    CLEANUP_OLD_RUNS: process.env.CLEANUP_OLD_RUNS,
    GITHUB_STEP_SUMMARY: process.env.GITHUB_STEP_SUMMARY,
  };

  process.env.GITHUB_REPOSITORY = 'org/repo';
  process.env.GITHUB_RUN_ID = '200';
  process.env.GITHUB_TOKEN = 'fake-test-token';
  process.env.CLEANUP_OLD_RUNS = 'false';
  delete process.env.GITHUB_STEP_SUMMARY;

  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'DELETE') {
      deletedUrls.push(u);
      return new Response(null, { status: 204 });
    }
    if (u.endsWith('/actions/runs/200')) {
      return new Response(
        JSON.stringify({ id: 200, workflow_id: 77, run_started_at: '2026-11-25T10:00:00Z' }),
        { status: 200 }
      );
    }
    if (u.includes('/actions/runs?status=in_progress')) {
      return new Response(JSON.stringify({ workflow_runs: [{ id: 150 }] }), { status: 200 });
    }
    if (u.includes('/actions/runs?status=')) {
      return new Response(JSON.stringify({ workflow_runs: [] }), { status: 200 });
    }
    if (u.includes('/actions/artifacts')) {
      return new Response(JSON.stringify({ artifacts }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  try {
    const res = await runCleanup({ dryRun: false });
    assert.equal(res.deletedArtifacts, 2);
    assert.equal(res.deletedRuns, 0);
    assert.deepEqual(deletedUrls, [
      'https://api.github.com/repos/org/repo/actions/artifacts/1',
      'https://api.github.com/repos/org/repo/actions/artifacts/2',
    ]);

    // Manejo elegante si GitHub responde 403 (ej. PR sin permiso actions:write)
    globalThis.fetch = (async () => new Response('Forbidden', { status: 403 })) as typeof fetch;
    const forbiddenRes = await runCleanup({ dryRun: false });
    assert.equal(forbiddenRes.deletedArtifacts, 0);
    assert.equal(forbiddenRes.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});




