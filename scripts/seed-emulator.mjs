import { createHash } from 'node:crypto';
import process from 'node:process';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'yogic-decoder-5lxdt';
const FIRESTORE_HOST = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').replace(/^https?:\/\//, '');
const AUTH_HOST = (process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099').replace(/^https?:\/\//, '');
const BASE_DOC_URL = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer owner',
};

// PNG transparente 1x1 mínimo sintético (89 bytes) para pruebas sin datos reales
const SYNTHETIC_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function assertEmulatorReachable() {
  try {
    const res = await fetch(`http://${FIRESTORE_HOST}/`);
    if (!res.ok && res.status !== 404) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(
      `❌ No se detectó el emulador de Firestore en http://${FIRESTORE_HOST} (${err instanceof Error ? err.message : String(err)}).`
    );
    console.error('   Inícialo primero con: npx firebase emulators:start --project yogic-decoder-5lxdt --only firestore,auth');
    process.exit(1);
  }
}

async function putDoc(collectionPath, docId, data) {
  const url = `${BASE_DOC_URL}/${collectionPath}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: OWNER_HEADERS,
    body: JSON.stringify(toFirestoreFields(data)),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error escribiendo ${collectionPath}/${docId}: ${res.status} ${text}`);
  }
}

async function clearEmulator() {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    throw new Error(`No se pudo limpiar Firestore Emulator: ${res.status}`);
  }
  try {
    await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
      method: 'DELETE',
    });
  } catch {
    // Auth emulator es opcional si solo corre Firestore
  }
}

async function seedAuthUsers() {
  const users = [
    {
      localId: 'emu-admin-1',
      email: 'admin.torneo@example.test',
      displayName: 'Organizador Prueba',
      emailVerified: true,
    },
    {
      localId: 'emu-user-1',
      email: 'jugador.normal@example.test',
      displayName: 'Jugador Sin Permisos',
      emailVerified: true,
    },
  ];

  for (const u of users) {
    try {
      await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts?key=fake-api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner',
        },
        body: JSON.stringify({
          localId: u.localId,
          email: u.email,
          displayName: u.displayName,
          emailVerified: u.emailVerified,
          password: 'TestPassword123!',
        }),
      });
    } catch {
      // Ignorar si Auth Emulator no está activo
    }
  }
}

const SAMPLE_FIRST_NAMES = [
  'Sofía', 'Emiliano', 'Valentina', 'Mateo', 'Camila', 'Santiago', 'Lucía', 'Sebastián',
  'Mariana', 'Diego', 'Chloë', 'François', 'Ïñigo', 'Ximena', 'Leonardo',
];
const SAMPLE_PATERNO = [
  'García', 'López', 'Rodríguez', 'Martínez', 'Hernández', 'De la Cruz', 'Del Río',
  "O'Connor", 'Pérez-Soto', 'Ramírez', 'Sánchez', 'Flores', 'Castillo', 'Mora', 'Vargas',
];
const SAMPLE_MATERNO = ['Ruiz', 'Torres', 'Vega', 'Castro', 'Silva', 'Navarro', 'Ríos', 'Díaz'];

async function main() {
  const totalCount = Number(process.env.SEED_COUNT || '50');
  await assertEmulatorReachable();
  await clearEmulator();
  await seedAuthUsers();

  // Configuración de prueba sintética (CLABE ficticia válida de 18 dígitos para habilitar el formulario en emulador)
  await putDoc('configuracion', 'general', {
    titulo: 'Torneo del Pavo 2.0',
    edicion: '2da Edición',
    slogan: 'Convivencia familiar de fin de año',
    club: 'Club de Ajedrez Don Gonzalo',
    fecha: 'Sábado 19 de diciembre de 2026',
    fechaIso: '2026-12-19T16:30:00-06:00',
    hora: '16:30 hrs',
    lugar: 'Corredor Constitución, Durango, Dgo.',
    referencia: 'Frente a Plaza de Armas',
    mapaUrl: 'https://maps.google.com/?q=Durango',
    costo: 200,
    cupoMaximo: 100,
    totalInscritos: totalCount,
    fechaLimite: 'Sábado 19 de diciembre de 2026, 15:30 hrs',
    fechaLimiteIso: '2026-12-19T15:30:00-06:00',
    fechaLimiteTimestamp: new Date('2099-12-19T21:30:00Z'),
    fechaCorteMayoriaEdad: '2008-12-19',
    fechaCorteJuvenil: '2007-12-19',
    habilitarListaEspera: true,
    politicaDevolucionTexto:
      'Las cuotas pagadas no son reembolsables salvo cancelación oficial del torneo.',
    inscripcionesAbiertas: true,
    clabe: '012190001234567890',
    banco: 'BBVA Prueba Emulador',
    titular: 'Comité Organizador Demo',
    whatsappContacto: '6185550100',
    bolsaPremios: '$10,000 MXN en premios y pavos navideños',
    primerLugarEfectivo: '$2,500 MXN',
    presidente: 'Eduardo Roqueta',
    vicepresidente: 'Emiliano Carrillo',
  });

  // Administradores de prueba
  await putDoc('admins', 'emu-admin-1', {
    email: 'admin.torneo@example.test',
    nombre: 'Organizador Prueba',
    rol: 'Dirección',
    agregadoEn: '2026-11-20T10:00:00.000Z',
  });
  await putDoc('admins_by_email', 'admin.torneo@example.test', {
    email: 'admin.torneo@example.test',
    nombre: 'Organizador Prueba',
    rol: 'Dirección',
    agregadoEn: '2026-11-20T10:00:00.000Z',
  });

  // Patrocinadores sintéticos
  const sponsors = [
    { id: 'sp-1', nombre: 'Café Durango Demo', logo: '', enlace: 'https://example.test', activo: true, orden: 1 },
    { id: 'sp-2', nombre: 'Ajedrez Escolar Demo', logo: '', enlace: '#', activo: true, orden: 2 },
  ];
  for (const sp of sponsors) {
    await putDoc('patrocinadores', sp.id, sp);
  }

  // Sembrar N participantes sintéticos (adultos y menores, pagados y pendientes, con recibos pequeños)
  for (let i = 1; i <= totalCount; i++) {
    const isMinor = i % 3 === 0;
    const birthYear = isMinor ? 2011 : 1995 + (i % 10);
    const fechaNacimiento = `${birthYear}-05-${String((i % 28) + 1).padStart(2, '0')}`;
    const categoria = isMinor ? 'Juvenil' : 'Libre';
    const paterno = SAMPLE_PATERNO[i % SAMPLE_PATERNO.length];
    const materno = SAMPLE_MATERNO[i % SAMPLE_MATERNO.length];
    const given = SAMPLE_FIRST_NAMES[i % SAMPLE_FIRST_NAMES.length];
    const fullName = `${paterno} ${materno} ${given}`;
    const firstWord = fullName.split(' ')[0];
    const publicName = `${firstWord} ${Array.from(materno)[0]}. ${Array.from(given)[0]}.`;

    const pId = `seed_p_${String(i).padStart(3, '0')}`;
    const rId = `seed_r_${String(i).padStart(3, '0')}`;
    const folio = `PAVO-SD${String(i).padStart(4, '0')}`;
    const email = `jugador${i}@demo.invalid`;
    const whatsapp = `618555${String(1000 + i).slice(-4)}`;
    const isPaid = i % 2 === 0;
    const createdIso = new Date(Date.UTC(2026, 10, 1 + (i % 20), 12, i % 60)).toISOString();

    await putDoc('comprobantes', rId, {
      participantId: pId,
      folio,
      participantNombre: fullName,
      fileName: `recibo_${i}.png`,
      mimeType: 'image/png',
      fileSize: 96,
      imageDataUrl: SYNTHETIC_PNG_DATA_URL,
      uploadedAt: createdIso,
    });

    await putDoc('participantes', pId, {
      nombre: fullName,
      fechaNacimiento,
      whatsapp,
      correo: email,
      categoria,
      estatusPago: isPaid ? 'pagado' : 'pendiente',
      fechaRegistro: createdIso,
      folio,
      esFemenil: i % 4 === 0,
      esAficionado: !isMinor && i % 5 === 0,
      tieneRecibo: true,
      reciboId: rId,
      reciboNombreArchivo: `recibo_${i}.png`,
      aceptoAviso: true,
      aceptoAvisoVersion: '2026-11-v1',
      fechaConsentimiento: createdIso,
      ...(isMinor ? { consentimientoTutor: true, nombreTutor: `Tutor Demo ${i}` } : {}),
      ...(isPaid ? { pagadoPor: 'Organizador Prueba', pagadoEn: createdIso } : {}),
    });

    const publicPayload = {
      folio,
      nombre: publicName,
      categoria,
      esAficionado: !isMinor && i % 5 === 0,
      esFemenil: i % 4 === 0,
      estatusPago: isPaid ? 'pagado' : 'pendiente',
      rangoEdad: isMinor ? 'Juvenil (13–18)' : 'Adulto (+18)',
      fechaRegistro: createdIso,
    };
    if (!isMinor) {
      publicPayload.edad = 2026 - birthYear;
    }
    await putDoc('participantes_publicos', pId, publicPayload);

    await putDoc('registro_llaves', sha256(`email:${email}`), {
      tipo: 'email',
      participantId: pId,
      createdAt: createdIso,
    });
    await putDoc('registro_llaves', sha256(`whatsapp:${whatsapp}`), {
      tipo: 'whatsapp',
      participantId: pId,
      createdAt: createdIso,
    });
  }

  // Lista de espera de ejemplo (convertida + vigente)
  const waitlistSamples = [
    {
      email: 'espera.antigua@demo.invalid',
      nombre: 'Torres Vega Laura',
      fechaNacimiento: '1999-03-14',
      whatsapp: '6185559001',
      categoria: 'Libre',
      estatus: 'convertido',
      fechaRegistro: '2026-09-01T10:00:00.000Z',
      folio: 'ESPERA-OLD001',
    },
    {
      email: 'espera.activa@demo.invalid',
      nombre: 'Méndez Ríos Daniel',
      fechaNacimiento: '2011-08-22',
      whatsapp: '6185559002',
      categoria: 'Juvenil',
      estatus: 'en_espera',
      fechaRegistro: new Date().toISOString(),
      folio: 'ESPERA-ACT002',
      consentimientoTutor: true,
      nombreTutor: 'Ríos Ana',
    },
  ];
  for (const w of waitlistSamples) {
    const id = sha256(`waitlist:${w.email}`);
    await putDoc('lista_espera', id, {
      nombre: w.nombre,
      fechaNacimiento: w.fechaNacimiento,
      whatsapp: w.whatsapp,
      correo: w.email,
      categoria: w.categoria,
      esFemenil: false,
      esAficionado: true,
      estatus: w.estatus,
      fechaRegistro: w.fechaRegistro,
      folio: w.folio,
      aceptoAviso: true,
      aceptoAvisoVersion: '2026-11-v1',
      fechaConsentimiento: w.fechaRegistro,
      ...(w.consentimientoTutor
        ? { consentimientoTutor: true, nombreTutor: w.nombreTutor }
        : {}),
    });
  }

  await putDoc('test', 'connection', { ok: true });

  console.log(
    `✅ Emulador sembrado con ${totalCount} inscritos sintéticos, ${sponsors.length} patrocinadores, ${waitlistSamples.length} en lista de espera y usuario admin (admin.torneo@example.test).`
  );
}

main().catch((err) => {
  console.error('❌ Error al sembrar emulador:', err);
  process.exit(1);
});
