import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'yogic-decoder-5lxdt';
const FIRESTORE_HOST = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').replace(/^https?:\/\//, '');
const DOC_PREFIX = `projects/${PROJECT_ID}/databases/(default)/documents`;
const BASE_URL = `http://${FIRESTORE_HOST}/v1/${DOC_PREFIX}`;

const SYNTHETIC_JPG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';

function toValue(val) {
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  return { stringValue: String(val) };
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toValue(v);
  }
  return fields;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function getCupoMaximo() {
  const res = await fetch(`${BASE_URL}/configuracion/general`);
  if (!res.ok) {
    throw new Error('No se encontró /configuracion/general en el emulador. Ejecuta `npm run seed:emulator` primero.');
  }
  const docJson = await res.json();
  const rawCupo = docJson?.fields?.cupoMaximo?.integerValue;
  return Number(rawCupo || 100);
}

async function getPublicCount() {
  const res = await fetch(`${BASE_URL}:runAggregationQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery: { from: [{ collectionId: 'participantes_publicos' }] },
        aggregations: [{ alias: 'total', count: {} }],
      },
    }),
  });
  if (!res.ok) return -1;
  const rows = await res.json();
  const countVal = rows?.[0]?.result?.aggregateFields?.total?.integerValue;
  return Number(countVal ?? -1);
}

async function submitPublicRegistration(index) {
  const pId = `load_p_${Date.now()}_${index}`;
  const rId = `load_r_${Date.now()}_${index}`;
  const folio = `PAVO-LT${String(index).padStart(4, '2')}`;
  const email = `loadtest.${index}.${Date.now()}@demo.invalid`;
  const whatsapp = `618777${String(1000 + index).slice(-4)}`;
  const nowIso = new Date().toISOString();

  const payload = {
    writes: [
      {
        update: {
          name: `${DOC_PREFIX}/comprobantes/${rId}`,
          fields: toFields({
            participantId: pId,
            folio,
            participantNombre: `Pruebas Carga ${index}`,
            fileName: `recibo_lt_${index}.jpg`,
            mimeType: 'image/jpeg',
            fileSize: 512,
            imageDataUrl: SYNTHETIC_JPG_DATA_URL,
            uploadedAt: nowIso,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DOC_PREFIX}/participantes/${pId}`,
          fields: toFields({
            nombre: `Pruebas Carga ${index}`,
            fechaNacimiento: '1997-04-15',
            whatsapp,
            correo: email,
            categoria: 'Libre',
            estatusPago: 'pendiente',
            fechaRegistro: nowIso,
            folio,
            esFemenil: index % 2 === 0,
            esAficionado: true,
            tieneRecibo: true,
            reciboId: rId,
            reciboNombreArchivo: `recibo_lt_${index}.jpg`,
            aceptoAviso: true,
            aceptoAvisoVersion: '2026-11-v1',
            fechaConsentimiento: nowIso,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DOC_PREFIX}/participantes_publicos/${pId}`,
          fields: toFields({
            folio,
            nombre: `Pruebas C. ${index}`,
            categoria: 'Libre',
            esAficionado: true,
            esFemenil: index % 2 === 0,
            estatusPago: 'pendiente',
            rangoEdad: 'Adulto (+18)',
            edad: 29,
            fechaRegistro: nowIso,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DOC_PREFIX}/registro_llaves/${sha256(`email:${email}`)}`,
          fields: toFields({ tipo: 'email', participantId: pId, createdAt: nowIso }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DOC_PREFIX}/registro_llaves/${sha256(`whatsapp:${whatsapp}`)}`,
          fields: toFields({ tipo: 'whatsapp', participantId: pId, createdAt: nowIso }),
        },
        currentDocument: { exists: false },
      },
    ],
  };

  const res = await fetch(`${BASE_URL}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

async function submitWaitlistEntry(index) {
  const email = `waitlist.lt.${index}.${Date.now()}@demo.invalid`;
  const id = sha256(`waitlist:${email}`);
  const nowIso = new Date().toISOString();
  const res = await fetch(`${BASE_URL}/lista_espera?documentId=${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: toFields({
        nombre: `Espera Carga ${index}`,
        fechaNacimiento: '1999-06-01',
        whatsapp: `618888${String(1000 + index).slice(-4)}`,
        correo: email,
        categoria: 'Libre',
        esFemenil: false,
        esAficionado: true,
        estatus: 'en_espera',
        fechaRegistro: nowIso,
        folio: `ESPERA-LT${String(index).padStart(4, '2')}`,
        aceptoAviso: true,
        aceptoAvisoVersion: '2026-11-v1',
        fechaConsentimiento: nowIso,
      }),
    }),
  });
  return res.ok;
}

async function main() {
  const targetIterations = Number(process.env.LOADTEST_COUNT || '100');
  const cupoMaximo = await getCupoMaximo();
  const initialCount = await getPublicCount();

  let registeredOk = 0;
  let waitlistOk = 0;
  let failures = 0;
  const latenciesMs = [];

  const startedAt = Date.now();
  for (let i = 1; i <= targetIterations; i++) {
    const t0 = performance.now();
    const currentCount = initialCount + registeredOk;
    const ok =
      currentCount < cupoMaximo
        ? await submitPublicRegistration(i)
        : await submitWaitlistEntry(i);
    latenciesMs.push(performance.now() - t0);

    if (ok) {
      if (currentCount < cupoMaximo) registeredOk++;
      else waitlistOk++;
    } else {
      failures++;
    }
  }

  const finalCount = await getPublicCount();
  const totalElapsedMs = Date.now() - startedAt;
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const avg = latenciesMs.reduce((a, b) => a + b, 0) / (latenciesMs.length || 1);

  console.log('=== Ensayo de carga en emulador ===');
  console.log(`Cupo configurado: ${cupoMaximo}`);
  console.log(`Conteo inicial:   ${initialCount}`);
  console.log(`Altas directas:   ${registeredOk}`);
  console.log(`Lista de espera:  ${waitlistOk}`);
  console.log(`Fallos:           ${failures}`);
  console.log(`Conteo final:     ${finalCount}`);
  console.log(`Duración total:   ${totalElapsedMs} ms (promedio ${avg.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms)`);

  if (failures > 0 || finalCount !== initialCount + registeredOk) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Error en ensayo de carga:', err);
  process.exit(1);
});
