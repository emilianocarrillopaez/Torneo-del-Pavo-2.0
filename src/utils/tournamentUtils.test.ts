import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCountdown,
  shuffleArray,
  calculateAgeAtTournament,
  validateRegistrationInput,
  validateReceiptFileMeta,
  buildParticipantExportRows,
  buildTournamentExportSummary,
} from './tournamentUtils';
import { Participant } from '../types/tournament';

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

test('computeCountdown handles elapsed event dates safely', () => {
  const target = '2026-12-19T16:30:00-06:00';
  const res = computeCountdown(target, Date.parse(target) + 60_000);

  assert.equal(res.isStarted, true);
  assert.equal(res.days, 0);
  assert.equal(res.hours, 0);
  assert.equal(res.minutes, 0);
  assert.equal(res.seconds, 0);
});

test('shuffleArray preserves all items without mutating original array', () => {
  const original = ['A', 'B', 'C', 'D', 'E'];
  const shuffled = shuffleArray(original, () => 0.3);

  assert.deepEqual(original, ['A', 'B', 'C', 'D', 'E']);
  assert.equal(shuffled.length, original.length);
  assert.deepEqual([...shuffled].sort(), [...original].sort());
});

test('calculateAgeAtTournament computes exact age on Dec 19, 2026', () => {
  assert.equal(calculateAgeAtTournament('2008-12-19'), 18);
  assert.equal(calculateAgeAtTournament('2007-12-19'), 19);
  assert.equal(calculateAgeAtTournament('2007-12-20'), 18);
  assert.equal(calculateAgeAtTournament(''), null);
});

test('validateRegistrationInput requires mandatory payment receipt and validates age coherence', () => {
  const missingReceipt = validateRegistrationInput({
    paterno: 'Carrillo',
    materno: 'Páez',
    nombre: 'Emiliano',
    fechaNacimiento: '1995-05-10',
    whatsapp: '6181234567',
    correo: 'test@example.com',
    categoria: 'Libre',
    hasReceipt: false,
  });
  assert.ok(missingReceipt.recibo, 'Missing receipt must return validation error');

  const ageMismatch = validateRegistrationInput({
    paterno: 'López',
    materno: 'Ruiz',
    nombre: 'Carlos',
    fechaNacimiento: '2000-01-01',
    whatsapp: '6181234567',
    correo: 'carlos@example.com',
    categoria: 'Juvenil',
    hasReceipt: true,
  });
  assert.ok(ageMismatch.categoria, 'Player over 18 cannot register in Juvenil');

  const valid = validateRegistrationInput({
    paterno: 'López',
    materno: 'Ruiz',
    nombre: 'Sofía',
    fechaNacimiento: '2010-03-12',
    whatsapp: '6189876543',
    correo: 'sofia@example.com',
    categoria: 'Juvenil',
    hasReceipt: true,
  });
  assert.deepEqual(valid, {});
});

test('validateReceiptFileMeta rejects unsupported mime types and oversized files', () => {
  assert.equal(validateReceiptFileMeta('image/jpeg', 200_000), null);
  assert.equal(validateReceiptFileMeta('application/pdf', 500_000), null);
  assert.ok(validateReceiptFileMeta('text/plain', 100));
  assert.ok(validateReceiptFileMeta('image/png', 10 * 1024 * 1024));
});

test('buildParticipantExportRows isolates admin receipt links from public exports', () => {
  const sample: Participant[] = [
    {
      id: 'p1',
      folio: 'PAVO-1001',
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
    },
  ];

  const publicRows = buildParticipantExportRows(sample, {
    includeAdminReceiptLinks: false,
    origin: 'https://torneo.example.com',
  });
  assert.equal(publicRows[0].reciboLink, undefined);
  assert.equal(publicRows[0].reciboEstado, 'Adjunto');

  const adminRows = buildParticipantExportRows(sample, {
    includeAdminReceiptLinks: true,
    origin: 'https://torneo.example.com',
  });
  assert.equal(
    adminRows[0].reciboLink,
    'https://torneo.example.com/#admin-recibo=rec_abc123'
  );

  const summary = buildTournamentExportSummary(sample, { costo: 200, cupoMaximo: 100 });
  assert.equal(summary.recaudacionConfirmada, 200);
  assert.equal(summary.totalConRecibo, 1);
  assert.equal(summary.lugaresDisponibles, 99);
});
