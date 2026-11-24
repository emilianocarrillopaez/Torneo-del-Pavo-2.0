import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';

const PROJECT_ID = 'yogic-decoder-5lxdt';
const RULES_PATH = 'firestore.rules';

let testEnv: RulesTestEnvironment;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validReceiptPayload(participantId: string, overrides: Record<string, unknown> = {}) {
  return {
    participantId,
    folio: 'PAVO-ABC234',
    participantNombre: 'Ana García Pérez',
    fileName: 'recibo.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1200,
    imageDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/',
    uploadedAt: '2026-11-20T12:00:00.000Z',
    ...overrides,
  };
}

function validParticipantPayload(reciboId: string, overrides: Record<string, unknown> = {}) {
  return {
    nombre: 'Ana García Pérez',
    fechaNacimiento: '1998-05-10',
    whatsapp: '6181234567',
    correo: 'ana.garcia@example.com',
    categoria: 'Libre',
    estatusPago: 'pendiente',
    fechaRegistro: '2026-11-20T12:00:00.000Z',
    folio: 'PAVO-ABC234',
    esFemenil: true,
    esAficionado: false,
    tieneRecibo: true,
    reciboId,
    reciboNombreArchivo: 'recibo.jpg',
    aceptoAviso: true,
    aceptoAvisoVersion: '2026-11-v1',
    fechaConsentimiento: '2026-11-20T12:00:00.000Z',
    ...overrides,
  };
}

function validPublicParticipantPayload(overrides: Record<string, unknown> = {}) {
  return {
    folio: 'PAVO-ABC234',
    nombre: 'Ana G. P.',
    categoria: 'Libre',
    esAficionado: false,
    esFemenil: true,
    estatusPago: 'pendiente',
    rangoEdad: 'Adulto (+18)',
    edad: 28,
    fechaRegistro: '2026-11-20T12:00:00.000Z',
    ...overrides,
  };
}

function validWaitlistPayload(overrides: Record<string, unknown> = {}) {
  return {
    nombre: 'Carlos López Ruiz',
    fechaNacimiento: '1996-04-12',
    whatsapp: '6185550199',
    correo: 'carlos.lopez@example.com',
    categoria: 'Libre',
    esAficionado: true,
    esFemenil: false,
    estatus: 'en_espera',
    fechaRegistro: '2026-11-20T12:00:00.000Z',
    folio: 'ESPERA-ABC234',
    aceptoAviso: true,
    aceptoAvisoVersion: '2026-11-v1',
    fechaConsentimiento: '2026-11-20T12:00:00.000Z',
    ...overrides,
  };
}

async function seedOpenConfigAndAdmin() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'configuracion', 'general'), {
      titulo: 'Torneo del Pavo 2.0',
      fecha: 'Sábado 19 de diciembre de 2026',
      fechaIso: '2026-12-19T16:30:00-06:00',
      fechaCorteMayoriaEdad: '2008-12-19',
      fechaCorteJuvenil: '2007-12-19',
      habilitarListaEspera: true,
      costo: 200,
      cupoMaximo: 100,
      inscripcionesAbiertas: true,
      fechaLimiteIso: '2099-12-19T15:30:00-06:00',
      fechaLimiteTimestamp: Timestamp.fromDate(new Date('2099-12-19T21:30:00Z')),
    });
    await setDoc(doc(adminDb, 'admins', 'admin-uid-1'), {
      email: 'admin@example.com',
      nombre: 'Organizador Principal',
      rol: 'Dirección',
    });
    await setDoc(doc(adminDb, 'admins_by_email', 'admin-email@example.com'), {
      email: 'admin-email@example.com',
      nombre: 'Árbitro Autorizado',
      rol: 'Arbitraje',
    });
  });
}

before(async () => {
  const rules = fs.readFileSync(RULES_PATH, 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedOpenConfigAndAdmin();
});

test('V1: Anónimo no puede leer /participantes', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'participantes', 'p1'), validParticipantPayload('r1'));
  });
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'participantes', 'p1')));
  await assertFails(getDocs(collection(db, 'participantes')));
});

test('V2: Anónimo sí puede leer /participantes_publicos sin PII', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'participantes_publicos', 'p1'), validPublicParticipantPayload());
  });
  const db = testEnv.unauthenticatedContext().firestore();
  const snap = await assertSucceeds(getDoc(doc(db, 'participantes_publicos', 'p1')));
  assert.equal(snap.exists(), true);
  assert.equal(snap.data()?.correo, undefined);
  assert.equal(snap.data()?.whatsapp, undefined);
});

test('V3: Anónimo crea participante válido en writeBatch completo (participante + público + comprobante + 2 llaves)', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  const pId = 'part_valid_1';
  const rId = 'rec_valid_1';
  const eHash = sha256('email:ana.garcia@example.com');
  const wHash = sha256('whatsapp:6181234567');

  batch.set(doc(db, 'comprobantes', rId), validReceiptPayload(pId));
  batch.set(doc(db, 'participantes', pId), validParticipantPayload(rId));
  batch.set(doc(db, 'participantes_publicos', pId), validPublicParticipantPayload());
  batch.set(doc(db, 'registro_llaves', eHash), {
    tipo: 'email',
    participantId: pId,
    createdAt: '2026-11-20T12:00:00.000Z',
  });
  batch.set(doc(db, 'registro_llaves', wHash), {
    tipo: 'whatsapp',
    participantId: pId,
    createdAt: '2026-11-20T12:00:00.000Z',
  });

  await assertSucceeds(batch.commit());
});

test('V4: Anónimo no puede registrarse con estatusPago: pagado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  const pId = 'part_paid';
  const rId = 'rec_paid';
  batch.set(doc(db, 'comprobantes', rId), validReceiptPayload(pId));
  batch.set(doc(db, 'participantes', pId), validParticipantPayload(rId, { estatusPago: 'pagado' }));
  batch.set(doc(db, 'participantes_publicos', pId), validPublicParticipantPayload({ estatusPago: 'pagado' }));
  await assertFails(batch.commit());
});

test('V5: Participante con campo extra no autorizado (isAdmin) o campo admin (pagadoPor) es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  const pId = 'part_extra';
  const rId = 'rec_extra';
  batch.set(doc(db, 'comprobantes', rId), validReceiptPayload(pId));
  batch.set(doc(db, 'participantes', pId), validParticipantPayload(rId, { isAdmin: true }));
  batch.set(doc(db, 'participantes_publicos', pId), validPublicParticipantPayload());
  await assertFails(batch.commit());

  const bAudit = writeBatch(db);
  bAudit.set(doc(db, 'comprobantes', 'rec_audit'), validReceiptPayload('part_audit'));
  bAudit.set(doc(db, 'participantes', 'part_audit'), validParticipantPayload('rec_audit', { pagadoPor: 'fake' }));
  bAudit.set(doc(db, 'participantes_publicos', 'part_audit'), validPublicParticipantPayload());
  await assertFails(bAudit.commit());
});

test('V6: whatsapp inválido (letras o longitud != 10) es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  const pId = 'part_bad_wa';
  const rId = 'rec_bad_wa';
  batch.set(doc(db, 'comprobantes', rId), validReceiptPayload(pId));
  batch.set(doc(db, 'participantes', pId), validParticipantPayload(rId, { whatsapp: '618abc4567' }));
  batch.set(doc(db, 'participantes_publicos', pId), validPublicParticipantPayload());
  await assertFails(batch.commit());
});

test('V7: nombre > 150 caracteres es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  const pId = 'part_long_name';
  const rId = 'rec_long_name';
  batch.set(doc(db, 'comprobantes', rId), validReceiptPayload(pId));
  batch.set(doc(db, 'participantes', pId), validParticipantPayload(rId, { nombre: 'A'.repeat(151) }));
  batch.set(doc(db, 'participantes_publicos', pId), validPublicParticipantPayload());
  await assertFails(batch.commit());
});

test('V8: categoría fuera de Juvenil/Libre es denegada', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  const pId = 'part_bad_cat';
  const rId = 'rec_bad_cat';
  batch.set(doc(db, 'comprobantes', rId), validReceiptPayload(pId));
  batch.set(doc(db, 'participantes', pId), validParticipantPayload(rId, { categoria: 'Rankeado' }));
  batch.set(doc(db, 'participantes_publicos', pId), validPublicParticipantPayload({ categoria: 'Rankeado' }));
  await assertFails(batch.commit());
});

test('V9: honeypot website con texto es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  const pId = 'part_bot';
  const rId = 'rec_bot';
  batch.set(doc(db, 'comprobantes', rId), validReceiptPayload(pId));
  batch.set(doc(db, 'participantes', pId), validParticipantPayload(rId, { website: 'https://spam.bot' }));
  batch.set(doc(db, 'participantes_publicos', pId), validPublicParticipantPayload());
  await assertFails(batch.commit());
});

test('V10: comprobante con URL https:// es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  const pId = 'part_url_rec';
  const rId = 'rec_url';
  batch.set(
    doc(db, 'comprobantes', rId),
    validReceiptPayload(pId, { imageDataUrl: 'https://evil.example/fake.jpg' })
  );
  batch.set(doc(db, 'participantes', pId), validParticipantPayload(rId));
  batch.set(doc(db, 'participantes_publicos', pId), validPublicParticipantPayload());
  await assertFails(batch.commit());
});

test('V11: comprobante con data:text/html es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  const pId = 'part_html_rec';
  const rId = 'rec_html';
  batch.set(
    doc(db, 'comprobantes', rId),
    validReceiptPayload(pId, { imageDataUrl: 'data:text/html;base64,PHNjcmlwdD4=' })
  );
  batch.set(doc(db, 'participantes', pId), validParticipantPayload(rId));
  batch.set(doc(db, 'participantes_publicos', pId), validPublicParticipantPayload());
  await assertFails(batch.commit());
});

test('V12: comprobante > 950,000 bytes/chars es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  const pId = 'part_huge_rec';
  const rId = 'rec_huge';
  batch.set(
    doc(db, 'comprobantes', rId),
    validReceiptPayload(pId, {
      fileSize: 960000,
      imageDataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(950000),
    })
  );
  batch.set(doc(db, 'participantes', pId), validParticipantPayload(rId));
  batch.set(doc(db, 'participantes_publicos', pId), validPublicParticipantPayload());
  await assertFails(batch.commit());
});

test('V13: anónimo no puede actualizar totalInscritos en /configuracion/general', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(updateDoc(doc(db, 'configuracion', 'general'), { totalInscritos: 999 }));
});

test('V14: usuario Google autenticado NO admin no puede leer /comprobantes', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'comprobantes', 'rec_1'), validReceiptPayload('p1'));
  });
  const db = testEnv
    .authenticatedContext('random-user', { email: 'jugador@gmail.com', email_verified: true })
    .firestore();
  await assertFails(getDoc(doc(db, 'comprobantes', 'rec_1')));
});

test('V15: usuario con correo admin pero email_verified: false es rechazado', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'comprobantes', 'rec_1'), validReceiptPayload('p1'));
  });
  const db = testEnv
    .authenticatedContext('admin-uid-1', { email: 'admin@example.com', email_verified: false })
    .firestore();
  await assertFails(getDoc(doc(db, 'comprobantes', 'rec_1')));
  await assertFails(getDocs(collection(db, 'participantes')));
});

test('V16: admin legítimo lee, actualiza (con historial/pagadoPor) y elimina participante y comprobante', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'comprobantes', 'rec_1'), validReceiptPayload('p1'));
    await setDoc(doc(ctx.firestore(), 'participantes', 'p1'), validParticipantPayload('rec_1'));
    await setDoc(doc(ctx.firestore(), 'participantes_publicos', 'p1'), validPublicParticipantPayload());
  });

  const adminByUid = testEnv
    .authenticatedContext('admin-uid-1', { email: 'admin@example.com', email_verified: true })
    .firestore();
  await assertSucceeds(getDoc(doc(adminByUid, 'comprobantes', 'rec_1')));
  await assertSucceeds(
    updateDoc(doc(adminByUid, 'participantes', 'p1'), {
      estatusPago: 'pagado',
      pagadoPor: 'Organizador Principal',
      pagadoEn: '2026-11-21T10:00:00.000Z',
      historial: [{ accion: 'Pago confirmado', fecha: '2026-11-21T10:00:00.000Z', autor: 'Organizador' }],
    })
  );

  const adminByEmail = testEnv
    .authenticatedContext('other-uid', { email: 'Admin-Email@example.com', email_verified: true })
    .firestore();
  await assertSucceeds(deleteDoc(doc(adminByEmail, 'participantes', 'p1')));
  await assertSucceeds(deleteDoc(doc(adminByEmail, 'comprobantes', 'rec_1')));
});

test('V17: duplicado de correo o WhatsApp en /registro_llaves es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const eHash = sha256('email:dup@example.com');
  const wHash1 = sha256('whatsapp:6181111111');
  const wHash2 = sha256('whatsapp:6182222222');

  const b1 = writeBatch(db);
  b1.set(doc(db, 'comprobantes', 'rec_d1'), validReceiptPayload('p_d1'));
  b1.set(doc(db, 'participantes', 'p_d1'), validParticipantPayload('rec_d1', { correo: 'dup@example.com', whatsapp: '6181111111' }));
  b1.set(doc(db, 'participantes_publicos', 'p_d1'), validPublicParticipantPayload());
  b1.set(doc(db, 'registro_llaves', eHash), { tipo: 'email', participantId: 'p_d1', createdAt: '2026-11-20T12:00:00.000Z' });
  b1.set(doc(db, 'registro_llaves', wHash1), { tipo: 'whatsapp', participantId: 'p_d1', createdAt: '2026-11-20T12:00:00.000Z' });
  await assertSucceeds(b1.commit());

  const b2 = writeBatch(db);
  b2.set(doc(db, 'comprobantes', 'rec_d2'), validReceiptPayload('p_d2'));
  b2.set(doc(db, 'participantes', 'p_d2'), validParticipantPayload('rec_d2', { correo: 'dup@example.com', whatsapp: '6182222222' }));
  b2.set(doc(db, 'participantes_publicos', 'p_d2'), validPublicParticipantPayload());
  b2.set(doc(db, 'registro_llaves', eHash), { tipo: 'email', participantId: 'p_d2', createdAt: '2026-11-20T12:05:00.000Z' });
  b2.set(doc(db, 'registro_llaves', wHash2), { tipo: 'whatsapp', participantId: 'p_d2', createdAt: '2026-11-20T12:05:00.000Z' });
  await assertFails(b2.commit());
});

test('V18: patrocinador con enlace javascript:alert(1) es denegado incluso para admin', async () => {
  const adminDb = testEnv
    .authenticatedContext('admin-uid-1', { email: 'admin@example.com', email_verified: true })
    .firestore();
  await assertFails(
    setDoc(doc(adminDb, 'patrocinadores', 'sp_xss'), {
      nombre: 'Sponsor XSS',
      logo: '',
      enlace: 'javascript:alert(1)',
      activo: true,
    })
  );
});

test('V19: anónimo no puede escribir /admins ni /admins_by_email', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(
    setDoc(doc(db, 'admins', 'hacker'), {
      email: 'hacker@example.com',
      nombre: 'Hacker',
      rol: 'Super',
    })
  );
  await assertFails(
    setDoc(doc(db, 'admins_by_email', 'hacker@example.com'), {
      email: 'hacker@example.com',
      nombre: 'Hacker',
      rol: 'Super',
    })
  );
});

test('V20: inscripción después de fechaLimiteTimestamp o con inscripcionesAbiertas == false es denegada', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'configuracion', 'general'), {
      fechaLimiteTimestamp: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
    });
  });

  const db = testEnv.unauthenticatedContext().firestore();
  const bExpired = writeBatch(db);
  bExpired.set(doc(db, 'comprobantes', 'rec_exp'), validReceiptPayload('p_exp'));
  bExpired.set(doc(db, 'participantes', 'p_exp'), validParticipantPayload('rec_exp'));
  bExpired.set(doc(db, 'participantes_publicos', 'p_exp'), validPublicParticipantPayload());
  await assertFails(bExpired.commit());
});

test('V21 (R1): comprobante huérfano sin participante nuevo es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'comprobantes', 'rec_orphan'), validReceiptPayload('p_inexistente')));
});

test('V22 (R1): comprobante colgado a un participante ya existente es denegado', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'participantes', 'p_existing'), validParticipantPayload('rec_existing'));
  });
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'comprobantes', 'rec_hijack'), validReceiptPayload('p_existing')));
});

test('V23 (R2): participante que apunta a un comprobante ajeno ya existente es denegado', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'comprobantes', 'rec_ajeno'), validReceiptPayload('p_ajeno'));
  });
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, 'participantes', 'p_new_steal'), validParticipantPayload('rec_ajeno'));
  batch.set(doc(db, 'participantes_publicos', 'p_new_steal'), validPublicParticipantPayload());
  await assertFails(batch.commit());
});

test('V24 (R3): llave en /registro_llaves sin participante nuevo en el batch es denegada', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'participantes', 'p_existing_k'), validParticipantPayload('rec_k'));
  });
  const db = testEnv.unauthenticatedContext().firestore();
  const eHash = sha256('email:otro@example.com');
  await assertFails(
    setDoc(doc(db, 'registro_llaves', eHash), {
      tipo: 'email',
      participantId: 'p_existing_k',
      createdAt: '2026-11-20T12:00:00.000Z',
    })
  );
});

test('V25 (R3): llave en /registro_llaves cuando inscripcionesAbiertas == false es denegada', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'configuracion', 'general'), { inscripcionesAbiertas: false });
  });
  const db = testEnv.unauthenticatedContext().firestore();
  const eHash = sha256('email:closed@example.com');
  await assertFails(
    setDoc(doc(db, 'registro_llaves', eHash), {
      tipo: 'email',
      participantId: 'p_closed',
      createdAt: '2026-11-20T12:00:00.000Z',
    })
  );
});

test('V26 (R4): nombre público con URL o caracteres no permitidos es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, 'comprobantes', 'rec_xss'), validReceiptPayload('p_xss'));
  batch.set(doc(db, 'participantes', 'p_xss'), validParticipantPayload('rec_xss'));
  batch.set(
    doc(db, 'participantes_publicos', 'p_xss'),
    validPublicParticipantPayload({ nombre: 'https://evil.com/' })
  );
  await assertFails(batch.commit());
});

test('V27 (R4): menor en padrón público con edad exacta es denegado; sin edad exacta y con tutor es permitido', async () => {
  const db = testEnv.unauthenticatedContext().firestore();

  const bWithAge = writeBatch(db);
  bWithAge.set(doc(db, 'comprobantes', 'rec_m1'), validReceiptPayload('p_m1', { participantNombre: 'Leo Ruiz' }));
  bWithAge.set(
    doc(db, 'participantes', 'p_m1'),
    validParticipantPayload('rec_m1', {
      nombre: 'Leo Ruiz',
      fechaNacimiento: '2012-03-10',
      categoria: 'Juvenil',
      consentimientoTutor: true,
      nombreTutor: 'Laura Ruiz',
    })
  );
  bWithAge.set(
    doc(db, 'participantes_publicos', 'p_m1'),
    validPublicParticipantPayload({
      nombre: 'Leo R.',
      categoria: 'Juvenil',
      rangoEdad: 'Infantil (≤ 12)',
      edad: 14,
    })
  );
  await assertFails(bWithAge.commit());

  const bRedacted = writeBatch(db);
  bRedacted.set(doc(db, 'comprobantes', 'rec_m2'), validReceiptPayload('p_m2', { participantNombre: 'Leo Ruiz' }));
  bRedacted.set(
    doc(db, 'participantes', 'p_m2'),
    validParticipantPayload('rec_m2', {
      nombre: 'Leo Ruiz',
      fechaNacimiento: '2012-03-10',
      categoria: 'Juvenil',
      consentimientoTutor: true,
      nombreTutor: 'Laura Ruiz',
    })
  );
  const publicMinor = validPublicParticipantPayload({
    nombre: 'Leo R.',
    categoria: 'Juvenil',
    rangoEdad: 'Juvenil (13–18)',
  });
  delete (publicMinor as { edad?: number }).edad;
  bRedacted.set(doc(db, 'participantes_publicos', 'p_m2'), publicMinor);
  await assertSucceeds(bRedacted.commit());
});

test('V28 (R5): adulto intentando registrarse como Juvenil es denegado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, 'comprobantes', 'rec_adult_juv'), validReceiptPayload('p_adult_juv'));
  batch.set(
    doc(db, 'participantes', 'p_adult_juv'),
    validParticipantPayload('rec_adult_juv', {
      fechaNacimiento: '2000-01-01',
      categoria: 'Juvenil',
    })
  );
  batch.set(
    doc(db, 'participantes_publicos', 'p_adult_juv'),
    validPublicParticipantPayload({ categoria: 'Juvenil' })
  );
  await assertFails(batch.commit());
});

test('V29 (3.1): bordes de fechaCorteMayoriaEdad (en el corte, un día antes, un día después)', async () => {
  const db = testEnv.unauthenticatedContext().firestore();

  // Nacido el 2008-12-19 -> cumple 18 el 2026-12-19 (mayor de edad, NO requiere tutor)
  const bOnCutoff = writeBatch(db);
  bOnCutoff.set(doc(db, 'comprobantes', 'rec_c1'), validReceiptPayload('p_c1', { participantNombre: 'Luis Mora' }));
  bOnCutoff.set(
    doc(db, 'participantes', 'p_c1'),
    validParticipantPayload('rec_c1', {
      nombre: 'Luis Mora',
      fechaNacimiento: '2008-12-19',
      categoria: 'Juvenil',
    })
  );
  bOnCutoff.set(
    doc(db, 'participantes_publicos', 'p_c1'),
    validPublicParticipantPayload({ nombre: 'Luis M.', categoria: 'Juvenil', edad: 18, rangoEdad: 'Adulto (+18)' })
  );
  await assertSucceeds(bOnCutoff.commit());

  // Nacido el 2008-12-20 -> un día después del corte (menor, sin tutor = denegado)
  const bAfterNoTutor = writeBatch(db);
  bAfterNoTutor.set(doc(db, 'comprobantes', 'rec_c2'), validReceiptPayload('p_c2', { participantNombre: 'Sofía Mora' }));
  bAfterNoTutor.set(
    doc(db, 'participantes', 'p_c2'),
    validParticipantPayload('rec_c2', {
      nombre: 'Sofía Mora',
      fechaNacimiento: '2008-12-20',
      categoria: 'Juvenil',
    })
  );
  const pubC2 = validPublicParticipantPayload({ nombre: 'Sofía M.', categoria: 'Juvenil', rangoEdad: 'Juvenil (13–18)' });
  delete (pubC2 as { edad?: number }).edad;
  bAfterNoTutor.set(doc(db, 'participantes_publicos', 'p_c2'), pubC2);
  await assertFails(bAfterNoTutor.commit());

  // Nacido el 2008-12-18 -> un día antes del corte (mayor de edad, permitido sin tutor)
  const bBefore = writeBatch(db);
  bBefore.set(doc(db, 'comprobantes', 'rec_c3'), validReceiptPayload('p_c3', { participantNombre: 'Mario Mora' }));
  bBefore.set(
    doc(db, 'participantes', 'p_c3'),
    validParticipantPayload('rec_c3', {
      nombre: 'Mario Mora',
      fechaNacimiento: '2008-12-18',
      categoria: 'Juvenil',
    })
  );
  bBefore.set(
    doc(db, 'participantes_publicos', 'p_c3'),
    validPublicParticipantPayload({ nombre: 'Mario M.', categoria: 'Juvenil', edad: 18, rangoEdad: 'Adulto (+18)' })
  );
  await assertSucceeds(bBefore.commit());
});

test('V30 (R6): admin puede purgar comprobantes y anonimizar participante post-torneo', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'comprobantes', 'rec_purge'), validReceiptPayload('p_purge'));
    await setDoc(doc(ctx.firestore(), 'participantes', 'p_purge'), validParticipantPayload('rec_purge'));
    await setDoc(doc(ctx.firestore(), 'participantes_publicos', 'p_purge'), validPublicParticipantPayload());
  });

  const adminDb = testEnv
    .authenticatedContext('admin-uid-1', { email: 'admin@example.com', email_verified: true })
    .firestore();

  const bPurge = writeBatch(adminDb);
  bPurge.delete(doc(adminDb, 'comprobantes', 'rec_purge'));
  bPurge.update(doc(adminDb, 'participantes', 'p_purge'), {
    tieneRecibo: false,
    reciboId: deleteField(),
    reciboNombreArchivo: deleteField(),
    notas: 'Comprobante purgado post-torneo',
  });
  await assertSucceeds(bPurge.commit());

  const bAnon = writeBatch(adminDb);
  bAnon.update(doc(adminDb, 'participantes', 'p_purge'), {
    nombre: 'Participante PAVO-ABC234',
    fechaNacimiento: '1970-01-01',
    whatsapp: '0000000000',
    correo: 'pavo-abc234@anonimo.invalid',
    nombreTutor: deleteField(),
    notas: 'Anonimizado post-torneo',
  });
  bAnon.update(doc(adminDb, 'participantes_publicos', 'p_purge'), {
    nombre: 'Participante PAVO-ABC234',
    rangoEdad: 'Reservado',
    edad: deleteField(),
  });
  await assertSucceeds(bAnon.commit());
});

test('V31 (3.3): admin puede editar registro heredado sin campos de consentimiento', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'participantes', 'p_legacy'), {
      nombre: 'Jugador Legado',
      fechaNacimiento: '1990-01-01',
      whatsapp: '618 123 4567',
      correo: 'LEGADO@example.com',
      categoria: 'Libre - Aficionados',
      estatusPago: 'pendiente',
      fechaRegistro: '2026-10-01T10:00:00.000Z',
      folio: 'PAVO-1234',
    });
  });

  const adminDb = testEnv
    .authenticatedContext('admin-uid-1', { email: 'admin@example.com', email_verified: true })
    .firestore();
  await assertSucceeds(updateDoc(doc(adminDb, 'participantes', 'p_legacy'), { estatusPago: 'pagado' }));
});

test('V32 (5.4 / 3.2): lista de espera exige ID SHA-256, bloquea duplicados/menores sin tutor/adulto en Juvenil, bloquea lectura pública y permite gestión admin', async () => {
  const pubDb = testEnv.unauthenticatedContext().firestore();
  const validEmail = 'carlos.lopez@example.com';
  const validId = sha256(`waitlist:${validEmail}`);

  // ID no-hash debe ser rechazado
  await assertFails(setDoc(doc(pubDb, 'lista_espera', 'w_plain_id'), validWaitlistPayload()));

  // Creación pública válida con ID determinista 64-hex
  await assertSucceeds(setDoc(doc(pubDb, 'lista_espera', validId), validWaitlistPayload()));

  // Mismo correo (mismo doc ID) en reintento público debe fallar porque ya existe
  await assertFails(setDoc(doc(pubDb, 'lista_espera', validId), validWaitlistPayload()));

  // Menor en lista de espera sin consentimiento de tutor debe fallar
  const minorEmail = 'menor.espera@example.com';
  const minorId = sha256(`waitlist:${minorEmail}`);
  await assertFails(
    setDoc(
      doc(pubDb, 'lista_espera', minorId),
      validWaitlistPayload({
        correo: minorEmail,
        fechaNacimiento: '2012-03-10',
        categoria: 'Juvenil',
      })
    )
  );

  // Adulto intentando lista de espera en categoría Juvenil debe fallar
  const adultEmail = 'adulto.juv@example.com';
  const adultId = sha256(`waitlist:${adultEmail}`);
  await assertFails(
    setDoc(
      doc(pubDb, 'lista_espera', adultId),
      validWaitlistPayload({
        correo: adultEmail,
        fechaNacimiento: '2000-01-01',
        categoria: 'Juvenil',
      })
    )
  );

  // Lectura pública denegada
  await assertFails(getDoc(doc(pubDb, 'lista_espera', validId)));

  // Gestión admin permitida
  const adminDb = testEnv
    .authenticatedContext('admin-uid-1', { email: 'admin@example.com', email_verified: true })
    .firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'lista_espera', validId)));
  await assertSucceeds(updateDoc(doc(adminDb, 'lista_espera', validId), { estatus: 'contactado' }));
  await assertSucceeds(deleteDoc(doc(adminDb, 'lista_espera', validId)));
});

test('V33 (3.1): flujo completo del cliente con nombres compuestos, partículas, apóstrofos, guiones, diéresis y cedilla', async () => {
  const { buildParticipantNames } = await import('../../src/utils/tournamentUtils');
  const db = testEnv.unauthenticatedContext().firestore();

  const nameCases = [
    { paterno: 'De la Cruz', materno: 'Del Río', nombre: 'María José', email: 'maria.jose@example.com', wa: '6181000001' },
    { paterno: "O'Connor", materno: 'Pérez-Soto', nombre: 'Chloë', email: 'chloe.oconnor@example.com', wa: '6181000002' },
    { paterno: 'Muñoz', materno: '', nombre: 'François', email: 'francois.munoz@example.com', wa: '6181000003' },
    { paterno: 'Íñiguez', materno: 'Núñez', nombre: 'Ïñigo', email: 'inigo.iniguez@example.com', wa: '6181000004' },
  ];

  for (let i = 0; i < nameCases.length; i++) {
    const c = nameCases[i];
    const { privateName, publicName } = buildParticipantNames(c, true);
    const pId = `p_uni_${i}`;
    const rId = `r_uni_${i}`;
    const folio = `PAVO-UN${String(i).padStart(4, '2')}`;
    const batch = writeBatch(db);

    batch.set(
      doc(db, 'comprobantes', rId),
      validReceiptPayload(pId, { participantNombre: privateName, folio })
    );
    batch.set(
      doc(db, 'participantes', pId),
      validParticipantPayload(rId, {
        nombre: privateName,
        correo: c.email,
        whatsapp: c.wa,
        folio,
      })
    );
    batch.set(
      doc(db, 'participantes_publicos', pId),
      validPublicParticipantPayload({
        nombre: publicName,
        folio,
      })
    );
    batch.set(doc(db, 'registro_llaves', sha256(`email:${c.email}`)), {
      tipo: 'email',
      participantId: pId,
      createdAt: '2026-11-20T12:00:00.000Z',
    });
    batch.set(doc(db, 'registro_llaves', sha256(`whatsapp:${c.wa}`)), {
      tipo: 'whatsapp',
      participantId: pId,
      createdAt: '2026-11-20T12:00:00.000Z',
    });

    await assertSucceeds(batch.commit());
  }
});

test('V34 (3.3): operaciones admin fragmentadas en lotes seguros (10, 25, 50 y 100 registros)', async () => {
  const {
    SAFE_ADMIN_BATCH_SIZE,
    SAFE_ADMIN_PAIR_BATCH_SIZE,
    SAFE_ADMIN_MULTI_OP_BATCH_SIZE,
  } = await import('../../src/constants/tournament');

  const TOTAL = 100;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const seedDb = ctx.firestore();
    for (let batchStart = 0; batchStart < TOTAL; batchStart += 25) {
      const b = writeBatch(seedDb);
      for (let i = batchStart; i < Math.min(TOTAL, batchStart + 25); i++) {
        const pId = `batch_p_${i}`;
        const rId = `batch_r_${i}`;
        const folio = `PAVO-B${String(i).padStart(5, '0')}`;
        const email = `batch${i}@example.com`;
        const wa = `618200${String(1000 + i).slice(-4)}`;
        b.set(doc(seedDb, 'comprobantes', rId), validReceiptPayload(pId, { folio }));
        b.set(
          doc(seedDb, 'participantes', pId),
          validParticipantPayload(rId, { folio, correo: email, whatsapp: wa })
        );
        b.set(doc(seedDb, 'participantes_publicos', pId), validPublicParticipantPayload({ folio }));
      }
      await b.commit();
    }
  });

  const adminDb = testEnv
    .authenticatedContext('admin-uid-1', { email: 'admin@example.com', email_verified: true })
    .firestore();

  // Probar tamaños 10, 25, 50 y 100 para sync público, pagos en lote, purga y anonimización
  for (const size of [10, 25, 50, 100]) {
    // 1) Sincronizar padrón público fragmentado por SAFE_ADMIN_BATCH_SIZE
    for (let i = 0; i < size; i += SAFE_ADMIN_BATCH_SIZE) {
      const b = writeBatch(adminDb);
      for (let j = i; j < Math.min(size, i + SAFE_ADMIN_BATCH_SIZE); j++) {
        b.set(
          doc(adminDb, 'participantes_publicos', `batch_p_${j}`),
          validPublicParticipantPayload({ folio: `PAVO-B${String(j).padStart(5, '0')}` })
        );
      }
      await assertSucceeds(b.commit());
    }

    // 2) Marcar pagados en lote fragmentado por SAFE_ADMIN_PAIR_BATCH_SIZE
    for (let i = 0; i < size; i += SAFE_ADMIN_PAIR_BATCH_SIZE) {
      const b = writeBatch(adminDb);
      for (let j = i; j < Math.min(size, i + SAFE_ADMIN_PAIR_BATCH_SIZE); j++) {
        b.update(doc(adminDb, 'participantes', `batch_p_${j}`), {
          estatusPago: 'pagado',
          pagadoPor: 'Admin Batch',
          pagadoEn: '2026-11-22T10:00:00.000Z',
        });
        b.set(
          doc(adminDb, 'participantes_publicos', `batch_p_${j}`),
          validPublicParticipantPayload({
            folio: `PAVO-B${String(j).padStart(5, '0')}`,
            estatusPago: 'pagado',
          })
        );
      }
      await assertSucceeds(b.commit());
    }
    // 3) Enviar a papelera (soft delete) y restaurar en lotes seguros
    for (let i = 0; i < size; i += SAFE_ADMIN_PAIR_BATCH_SIZE) {
      const bTrash = writeBatch(adminDb);
      for (let j = i; j < Math.min(size, i + SAFE_ADMIN_PAIR_BATCH_SIZE); j++) {
        bTrash.update(doc(adminDb, 'participantes', `batch_p_${j}`), {
          eliminado: true,
          eliminadoEn: '2026-11-22T11:00:00.000Z',
          eliminadoPor: 'Admin Batch',
        });
        bTrash.delete(doc(adminDb, 'participantes_publicos', `batch_p_${j}`));
      }
      await assertSucceeds(bTrash.commit());

      const bRestore = writeBatch(adminDb);
      for (let j = i; j < Math.min(size, i + SAFE_ADMIN_PAIR_BATCH_SIZE); j++) {
        bRestore.update(doc(adminDb, 'participantes', `batch_p_${j}`), {
          eliminado: false,
          eliminadoEn: deleteField(),
          eliminadoPor: deleteField(),
        });
        bRestore.set(
          doc(adminDb, 'participantes_publicos', `batch_p_${j}`),
          validPublicParticipantPayload({
            folio: `PAVO-B${String(j).padStart(5, '0')}`,
            estatusPago: 'pagado',
          })
        );
      }
      await assertSucceeds(bRestore.commit());
    }
  }

  // 4) Purga de comprobantes en 100 registros fragmentada por SAFE_ADMIN_PAIR_BATCH_SIZE
  for (let i = 0; i < TOTAL; i += SAFE_ADMIN_PAIR_BATCH_SIZE) {
    const b = writeBatch(adminDb);
    for (let j = i; j < Math.min(TOTAL, i + SAFE_ADMIN_PAIR_BATCH_SIZE); j++) {
      b.delete(doc(adminDb, 'comprobantes', `batch_r_${j}`));
      b.update(doc(adminDb, 'participantes', `batch_p_${j}`), {
        tieneRecibo: false,
        reciboId: deleteField(),
        reciboNombreArchivo: deleteField(),
      });
    }
    await assertSucceeds(b.commit());
  }

  // 4) Anonimización post-evento en 100 registros fragmentada por SAFE_ADMIN_MULTI_OP_BATCH_SIZE
  for (let i = 0; i < TOTAL; i += SAFE_ADMIN_MULTI_OP_BATCH_SIZE) {
    const b = writeBatch(adminDb);
    for (let j = i; j < Math.min(TOTAL, i + SAFE_ADMIN_MULTI_OP_BATCH_SIZE); j++) {
      const folio = `PAVO-B${String(j).padStart(5, '0')}`;
      b.delete(doc(adminDb, 'registro_llaves', sha256(`email:batch${j}@example.com`)));
      b.delete(doc(adminDb, 'registro_llaves', sha256(`whatsapp:618200${String(1000 + j).slice(-4)}`)));
      b.update(doc(adminDb, 'participantes', `batch_p_${j}`), {
        nombre: `Participante ${folio}`,
        fechaNacimiento: '1970-01-01',
        whatsapp: '0000000000',
        correo: `anon-${folio.toLowerCase()}@eliminado.local`,
        nombreTutor: deleteField(),
        notas: 'Anonimizado en lote',
      });
      b.set(
        doc(adminDb, 'participantes_publicos', `batch_p_${j}`),
        validPublicParticipantPayload({
          folio,
          nombre: `Participante ${folio}`,
          estatusPago: 'pagado',
        })
      );
    }
    await assertSucceeds(b.commit());
  }
});

