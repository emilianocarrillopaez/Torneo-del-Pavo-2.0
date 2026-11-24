import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch,
  query,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, AppFirestoreError } from '../lib/firebase';
import {
  COLLECTIONS,
  CONFIG_DOC_ID,
  DEFAULT_EVENT_ISO,
  PRIVACY_NOTICE_VERSION,
  PUBLIC_ROSTER_CACHE_TTL_MS,
  PUBLIC_ROSTER_QUERY_LIMIT,
  SAFE_ADMIN_BATCH_SIZE,
  SAFE_ADMIN_MULTI_OP_BATCH_SIZE,
  SAFE_ADMIN_PAIR_BATCH_SIZE,
  WAITLIST_PURGE_DAYS,
} from '../constants/tournament';
import {
  Participant,
  ParticipantHistoryEntry,
  PublicParticipant,
  WaitlistEntry,
  PaymentReceipt,
  AdminMember,
  TournamentConfig,
  Sponsor,
  DEFAULT_CONFIG,
  INITIAL_SPONSORS,
  normalizeCategory,
} from '../types/tournament';
import {
  ProcessedReceiptFile,
  isSafeReceiptDataUrl,
  sanitizeReceiptFileName,
} from '../utils/receiptUtils';
import {
  buildParticipantNames,
  generateSecureFolio,
  toPublicParticipantPayload,
  normalizeEmailKey,
  normalizeWhatsappKey,
  sha256Hex,
  calculateAgeAtTournament,
  deriveAgeCutoffs,
} from '../utils/tournamentUtils';
import { classifyAndFormatError } from '../utils/errorMessages';
import { isPlaceholderPaymentConfig } from '../utils/paymentConfig';

/**
 * Genera identificadores deterministas para garantizar idempotencia en reintentos/doble toque.
 */
export function createRegistrationAttemptIds(): {
  participantId: string;
  reciboId: string;
  folio: string;
} {
  return {
    participantId: doc(collection(db, COLLECTIONS.PARTICIPANTS)).id,
    reciboId: doc(collection(db, COLLECTIONS.RECEIPTS)).id,
    folio: generateSecureFolio(6, 'PAVO'),
  };
}

/**
 * Obtiene el conteo público de inscritos mediante agregación en servidor (Opción A: sin escritura pública a totalInscritos).
 */
export async function fetchPublicParticipantsCount(): Promise<number> {
  const snap = await getCountFromServer(collection(db, COLLECTIONS.PUBLIC_PARTICIPANTS));
  return snap.data().count;
}

// Caché breve en memoria de sesión y listener compartido para reducir lecturas en Spark (3.6)
let publicRosterCache: { data: PublicParticipant[]; updatedAt: number } | null = null;
let sharedPublicUnsub: (() => void) | null = null;
const publicRosterSubscribers = new Set<{
  onUpdate: (participants: PublicParticipant[]) => void;
  onError?: (err: unknown) => void;
}>();

export function invalidatePublicRosterCache(): void {
  publicRosterCache = null;
}

/**
 * Suscribe en tiempo real al padrón público sanitizado (/participantes_publicos)
 * usando listener compartido, consulta acotada (limit) y caché breve en memoria (60 s).
 */
export function subscribeToPublicParticipants(
  onUpdate: (participants: PublicParticipant[]) => void,
  onError?: (err: unknown) => void,
  options?: { forceRefresh?: boolean }
) {
  const subscriber = { onUpdate, onError };
  publicRosterSubscribers.add(subscriber);

  if (
    !options?.forceRefresh &&
    publicRosterCache &&
    Date.now() - publicRosterCache.updatedAt < PUBLIC_ROSTER_CACHE_TTL_MS
  ) {
    onUpdate(publicRosterCache.data);
  }

  if (!sharedPublicUnsub) {
    const ref = query(
      collection(db, COLLECTIONS.PUBLIC_PARTICIPANTS),
      orderBy('fechaRegistro', 'desc'),
      limit(PUBLIC_ROSTER_QUERY_LIMIT)
    );

    sharedPublicUnsub = onSnapshot(
      ref,
      (snapshot) => {
        const list: PublicParticipant[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PublicParticipant, 'id'>),
        }));
        publicRosterCache = { data: list, updatedAt: Date.now() };
        for (const sub of publicRosterSubscribers) {
          sub.onUpdate(list);
        }
      },
      (error) => {
        for (const sub of publicRosterSubscribers) {
          if (sub.onError) sub.onError(error);
        }
      }
    );
  }

  return () => {
    publicRosterSubscribers.delete(subscriber);
    if (publicRosterSubscribers.size === 0 && sharedPublicUnsub) {
      sharedPublicUnsub();
      sharedPublicUnsub = null;
    }
  };
}

/**
 * Registra un participante de forma atómica e idempotente (writeBatch).
 */
export async function registerParticipant(
  data: Omit<
    Participant,
    | 'id'
    | 'estatusPago'
    | 'fechaRegistro'
    | 'folio'
    | 'tieneRecibo'
    | 'reciboId'
    | 'reciboNombreArchivo'
  >,
  receipt: ProcessedReceiptFile,
  options?: {
    idempotencyIds?: { participantId: string; reciboId: string; folio: string };
    eventFechaIso?: string;
  }
): Promise<{ id: string; folio: string; reciboId: string }> {
  if (!receipt || !isSafeReceiptDataUrl(receipt.dataUrl, receipt.mimeType)) {
    throw new Error('El comprobante de pago es obligatorio y debe tener un formato válido.');
  }

  if (!data.aceptoAviso) {
    throw new Error('Debes aceptar el Aviso de Privacidad para continuar.');
  }

  const eventFechaIso = options?.eventFechaIso || DEFAULT_EVENT_ISO;
  const cleanEmail = normalizeEmailKey(data.correo);
  const cleanWhatsapp = normalizeWhatsappKey(data.whatsapp);
  const age = calculateAgeAtTournament(data.fechaNacimiento, eventFechaIso);

  if (age !== null && age < 18) {
    if (
      !data.consentimientoTutor ||
      !(data.nombreTutor || '').trim() ||
      (data.nombreTutor || '').trim().length < 3
    ) {
      throw new Error(
        'Para menores de 18 años se requiere el nombre y autorización de la madre, padre o tutor.'
      );
    }
  }

  const ids = options?.idempotencyIds || createRegistrationAttemptIds();
  const nowIso = new Date().toISOString();
  const { privateName: cleanName } = buildParticipantNames(data.nombre);
  const cleanFileName = sanitizeReceiptFileName(receipt.fileName);

  const [emailHash, whatsappHash] = await Promise.all([
    sha256Hex(`email:${cleanEmail}`),
    sha256Hex(`whatsapp:${cleanWhatsapp}`),
  ]);

  const participantRef = doc(db, COLLECTIONS.PARTICIPANTS, ids.participantId);
  const publicParticipantRef = doc(db, COLLECTIONS.PUBLIC_PARTICIPANTS, ids.participantId);
  const receiptRef = doc(db, COLLECTIONS.RECEIPTS, ids.reciboId);
  const emailKeyRef = doc(db, COLLECTIONS.REGISTRATION_KEYS, emailHash);
  const whatsappKeyRef = doc(db, COLLECTIONS.REGISTRATION_KEYS, whatsappHash);

  const receiptPayload: Omit<PaymentReceipt, 'id'> = {
    participantId: ids.participantId,
    folio: ids.folio,
    participantNombre: cleanName,
    fileName: cleanFileName,
    mimeType: receipt.mimeType,
    fileSize: receipt.fileSize,
    imageDataUrl: receipt.dataUrl,
    uploadedAt: nowIso,
  };

  const participantPayload: Omit<Participant, 'id'> = {
    nombre: cleanName,
    fechaNacimiento: data.fechaNacimiento,
    whatsapp: cleanWhatsapp,
    correo: cleanEmail,
    categoria: normalizeCategory(data.categoria),
    estatusPago: 'pendiente',
    fechaRegistro: nowIso,
    folio: ids.folio,
    esFemenil: Boolean(data.esFemenil),
    esAficionado: Boolean(data.esAficionado),
    tieneRecibo: true,
    reciboId: ids.reciboId,
    reciboNombreArchivo: cleanFileName.slice(0, 160),
    aceptoAviso: true,
    aceptoAvisoVersion: data.aceptoAvisoVersion || PRIVACY_NOTICE_VERSION,
    fechaConsentimiento: data.fechaConsentimiento || nowIso,
    ...(data.consentimientoTutor !== undefined
      ? { consentimientoTutor: Boolean(data.consentimientoTutor) }
      : {}),
    ...(data.nombreTutor?.trim() ? { nombreTutor: data.nombreTutor.trim() } : {}),
  };

  const publicPayload = toPublicParticipantPayload(participantPayload, undefined, eventFechaIso);

  try {
    const batch = writeBatch(db);
    batch.set(receiptRef, receiptPayload);
    batch.set(participantRef, participantPayload);
    batch.set(publicParticipantRef, publicPayload);
    batch.set(emailKeyRef, {
      tipo: 'email',
      participantId: ids.participantId,
      createdAt: nowIso,
    });
    batch.set(whatsappKeyRef, {
      tipo: 'whatsapp',
      participantId: ids.participantId,
      createdAt: nowIso,
    });

    await batch.commit();
    invalidatePublicRosterCache();
    return { id: ids.participantId, folio: ids.folio, reciboId: ids.reciboId };
  } catch (error: unknown) {
    const classified = classifyAndFormatError(error);
    if (classified.category === 'offline' || classified.category === 'rate-limit' || classified.category === 'app-check') {
      throw new AppFirestoreError(classified.message, classified.category);
    }

    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

    if (code === 'permission-denied' || code === 'already-exists') {
      throw new AppFirestoreError(
        'No se pudo completar el registro. Verifica que las inscripciones sigan abiertas y que no exista ya una inscripción previa con ese correo electrónico o WhatsApp.',
        code
      );
    }

    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.PARTICIPANTS);
  }
}

/**
 * Registra un interesado en la lista de espera con ID determinista (SHA-256 del correo normalizado)
 * para evitar registros repetidos con el mismo correo.
 */
export async function registerWaitlistEntry(
  data: Omit<WaitlistEntry, 'id' | 'estatus' | 'fechaRegistro' | 'folio'>,
  eventFechaIso: string = DEFAULT_EVENT_ISO
): Promise<{ id: string; folio: string }> {
  if (!data.aceptoAviso) {
    throw new Error('Debes aceptar el Aviso de Privacidad para continuar.');
  }

  const cleanEmail = normalizeEmailKey(data.correo);
  const cleanWhatsapp = normalizeWhatsappKey(data.whatsapp);
  const age = calculateAgeAtTournament(data.fechaNacimiento, eventFechaIso);
  if (age !== null && age < 18) {
    if (
      !data.consentimientoTutor ||
      !(data.nombreTutor || '').trim() ||
      (data.nombreTutor || '').trim().length < 3
    ) {
      throw new Error(
        'Para menores de 18 años se requiere el nombre y autorización de la madre, padre o tutor.'
      );
    }
  }

  const nowIso = new Date().toISOString();
  const folio = generateSecureFolio(6, 'ESPERA');
  const waitlistHash = await sha256Hex(`waitlist:${cleanEmail}`);
  const waitlistRef = doc(db, COLLECTIONS.WAITLIST, waitlistHash);
  const { privateName: cleanName } = buildParticipantNames(data.nombre);

  const payload: Omit<WaitlistEntry, 'id'> = {
    nombre: cleanName,
    fechaNacimiento: data.fechaNacimiento,
    whatsapp: cleanWhatsapp,
    correo: cleanEmail,
    categoria: normalizeCategory(data.categoria),
    esFemenil: Boolean(data.esFemenil),
    esAficionado: Boolean(data.esAficionado),
    estatus: 'en_espera',
    fechaRegistro: nowIso,
    folio,
    aceptoAviso: true,
    aceptoAvisoVersion: data.aceptoAvisoVersion || PRIVACY_NOTICE_VERSION,
    fechaConsentimiento: data.fechaConsentimiento || nowIso,
    ...(data.consentimientoTutor !== undefined
      ? { consentimientoTutor: Boolean(data.consentimientoTutor) }
      : {}),
    ...(data.nombreTutor?.trim() ? { nombreTutor: data.nombreTutor.trim() } : {}),
  };

  try {
    await setDoc(waitlistRef, payload);
    return { id: waitlistRef.id, folio };
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
    if (code === 'permission-denied' || code === 'already-exists') {
      throw new AppFirestoreError(
        'Ese correo ya se encuentra en la lista de espera o las inscripciones ya fueron cerradas.',
        code
      );
    }
    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.WAITLIST);
  }
}

export function subscribeToWaitlist(
  onUpdate: (entries: WaitlistEntry[]) => void,
  onError?: (err: unknown) => void
) {
  const ref = query(collection(db, COLLECTIONS.WAITLIST), orderBy('fechaRegistro', 'desc'));
  return onSnapshot(
    ref,
    (snapshot) => {
      const list: WaitlistEntry[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<WaitlistEntry, 'id'>),
      }));
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function updateWaitlistStatus(
  id: string,
  estatus: WaitlistEntry['estatus']
): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTIONS.WAITLIST, id), { estatus });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.WAITLIST);
  }
}

export async function deleteWaitlistEntry(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.WAITLIST, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.WAITLIST);
  }
}

/**
 * Admin-only (3.2): depura entradas de lista de espera ya convertidas o con antigüedad > daysOld días.
 */
export async function purgeOldWaitlistEntries(
  entries: WaitlistEntry[],
  daysOld: number = WAITLIST_PURGE_DAYS,
  onProgress?: (processed: number, total: number) => void
): Promise<number> {
  const cutoffMs = Date.now() - daysOld * 86_400_000;
  const targets = entries.filter((entry) => {
    if (!entry.id) return false;
    if (entry.estatus === 'convertido') return true;
    const regMs = Date.parse(entry.fechaRegistro || '');
    return !Number.isNaN(regMs) && regMs < cutoffMs;
  });
  if (targets.length === 0) return 0;

  let deleted = 0;
  try {
    for (let i = 0; i < targets.length; i += SAFE_ADMIN_BATCH_SIZE) {
      const slice = targets.slice(i, i + SAFE_ADMIN_BATCH_SIZE);
      const batch = writeBatch(db);
      for (const entry of slice) {
        if (!entry.id) continue;
        batch.delete(doc(db, COLLECTIONS.WAITLIST, entry.id));
        deleted++;
      }
      await batch.commit();
      onProgress?.(deleted, targets.length);
    }
    return deleted;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.WAITLIST);
  }
}

/**
 * Admin-only: crea un participante de forma atómica (privado + público + llaves + recibo opcional).
 */
export async function createParticipantAsAdmin(
  data: Omit<Participant, 'id' | 'fechaRegistro' | 'folio'>,
  receipt?: ProcessedReceiptFile | null,
  options?: { actorName?: string; eventFechaIso?: string }
): Promise<{ id: string; folio: string; reciboId?: string }> {
  const nowIso = new Date().toISOString();
  const folio = generateSecureFolio(6, 'PAVO');
  const { privateName: cleanName } = buildParticipantNames(data.nombre);
  const cleanEmail = normalizeEmailKey(data.correo);
  const cleanWhatsapp = normalizeWhatsappKey(data.whatsapp);
  const actor = (options?.actorName || 'Administrador').slice(0, 120);
  const eventFechaIso = options?.eventFechaIso || DEFAULT_EVENT_ISO;

  const [emailHash, whatsappHash] = await Promise.all([
    sha256Hex(`email:${cleanEmail}`),
    sha256Hex(`whatsapp:${cleanWhatsapp}`),
  ]);

  const participantRef = doc(collection(db, COLLECTIONS.PARTICIPANTS));
  const publicParticipantRef = doc(db, COLLECTIONS.PUBLIC_PARTICIPANTS, participantRef.id);
  const emailKeyRef = doc(db, COLLECTIONS.REGISTRATION_KEYS, emailHash);
  const whatsappKeyRef = doc(db, COLLECTIONS.REGISTRATION_KEYS, whatsappHash);

  let reciboId: string | undefined;
  let reciboNombreArchivo: string | undefined;

  try {
    const batch = writeBatch(db);

    if (receipt && isSafeReceiptDataUrl(receipt.dataUrl, receipt.mimeType)) {
      const receiptRef = doc(collection(db, COLLECTIONS.RECEIPTS));
      const cleanFileName = sanitizeReceiptFileName(receipt.fileName);
      reciboId = receiptRef.id;
      reciboNombreArchivo = cleanFileName.slice(0, 160);
      batch.set(receiptRef, {
        participantId: participantRef.id,
        folio,
        participantNombre: cleanName,
        fileName: cleanFileName,
        mimeType: receipt.mimeType,
        fileSize: receipt.fileSize,
        imageDataUrl: receipt.dataUrl,
        uploadedAt: nowIso,
      });
    }

    const historial: ParticipantHistoryEntry[] = [
      {
        accion: 'Registro manual en panel admin',
        fecha: nowIso,
        autor: actor,
      },
    ];

    const payload: Omit<Participant, 'id'> = {
      nombre: cleanName,
      fechaNacimiento: data.fechaNacimiento,
      whatsapp: cleanWhatsapp,
      correo: cleanEmail,
      categoria: normalizeCategory(data.categoria),
      estatusPago: data.estatusPago,
      fechaRegistro: nowIso,
      folio,
      esFemenil: Boolean(data.esFemenil),
      esAficionado: Boolean(data.esAficionado),
      tieneRecibo: Boolean(reciboId),
      aceptoAviso: data.aceptoAviso ?? true,
      aceptoAvisoVersion: data.aceptoAvisoVersion || PRIVACY_NOTICE_VERSION,
      fechaConsentimiento: data.fechaConsentimiento || nowIso,
      historial,
      ...(data.estatusPago === 'pagado' ? { pagadoPor: actor, pagadoEn: nowIso } : {}),
      ...(data.consentimientoTutor !== undefined
        ? { consentimientoTutor: Boolean(data.consentimientoTutor) }
        : {}),
      ...(data.nombreTutor?.trim() ? { nombreTutor: data.nombreTutor.trim() } : {}),
      ...(reciboId ? { reciboId, reciboNombreArchivo } : {}),
    };

    const publicPayload = toPublicParticipantPayload(payload, undefined, eventFechaIso);

    batch.set(participantRef, payload);
    batch.set(publicParticipantRef, publicPayload);
    batch.set(emailKeyRef, {
      tipo: 'email',
      participantId: participantRef.id,
      createdAt: nowIso,
    });
    batch.set(whatsappKeyRef, {
      tipo: 'whatsapp',
      participantId: participantRef.id,
      createdAt: nowIso,
    });

    await batch.commit();
    invalidatePublicRosterCache();
    return { id: participantRef.id, folio, reciboId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.PARTICIPANTS);
  }
}

/**
 * Admin-only: obtiene un comprobante individual desde `/comprobantes`.
 */
export async function getReceiptById(reciboId: string): Promise<PaymentReceipt | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.RECEIPTS, reciboId));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...(snap.data() as Omit<PaymentReceipt, 'id'>),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, COLLECTIONS.RECEIPTS);
  }
}

/**
 * Admin-only: adjunta o reemplaza un comprobante en forma atómica.
 */
export async function attachReceiptToParticipant(
  participant: Participant,
  receipt: ProcessedReceiptFile
): Promise<string> {
  if (!participant.id) {
    throw new Error('Participante sin identificador válido.');
  }
  if (!isSafeReceiptDataUrl(receipt.dataUrl, receipt.mimeType)) {
    throw new Error('El comprobante no tiene un formato seguro permitido.');
  }

  const nowIso = new Date().toISOString();
  const receiptRef = participant.reciboId
    ? doc(db, COLLECTIONS.RECEIPTS, participant.reciboId)
    : doc(collection(db, COLLECTIONS.RECEIPTS));
  const cleanFileName = sanitizeReceiptFileName(receipt.fileName);

  try {
    const batch = writeBatch(db);
    batch.set(receiptRef, {
      participantId: participant.id,
      folio: participant.folio || 'S/F',
      participantNombre: participant.nombre,
      fileName: cleanFileName,
      mimeType: receipt.mimeType,
      fileSize: receipt.fileSize,
      imageDataUrl: receipt.dataUrl,
      uploadedAt: nowIso,
    });
    batch.update(doc(db, COLLECTIONS.PARTICIPANTS, participant.id), {
      tieneRecibo: true,
      reciboId: receiptRef.id,
      reciboNombreArchivo: cleanFileName.slice(0, 160),
    });

    await batch.commit();
    return receiptRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.RECEIPTS);
  }
}

/**
 * Subscribe to tournament configuration with fallback to default
 */
export function subscribeToConfig(
  onUpdate: (config: TournamentConfig) => void,
  onError?: (err: unknown) => void
) {
  const docRef = doc(db, COLLECTIONS.CONFIG, CONFIG_DOC_ID);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate({ ...DEFAULT_CONFIG, ...(snapshot.data() as Partial<TournamentConfig>) });
      } else {
        onUpdate(DEFAULT_CONFIG);
      }
    },
    (error) => {
      onUpdate(DEFAULT_CONFIG);
      if (onError) onError(error);
    }
  );
}

/**
 * Save / Update tournament configuration (Admin only), syncing dynamic age cutoffs and deadline timestamp.
 */
export async function updateTournamentConfig(config: Partial<TournamentConfig>) {
  const docRef = doc(db, COLLECTIONS.CONFIG, CONFIG_DOC_ID);
  const payload: Record<string, unknown> = { ...config };

  if (typeof config.fechaLimiteIso === 'string' && config.fechaLimiteIso.trim()) {
    const parsed = Date.parse(config.fechaLimiteIso);
    if (!Number.isNaN(parsed)) {
      payload.fechaLimiteTimestamp = Timestamp.fromMillis(parsed);
    }
  }

  if (typeof config.fechaIso === 'string' && config.fechaIso.trim()) {
    const cutoffs = deriveAgeCutoffs(config.fechaIso);
    payload.fechaCorteMayoriaEdad = cutoffs.fechaCorteMayoriaEdad;
    payload.fechaCorteJuvenil = cutoffs.fechaCorteJuvenil;
  }

  try {
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.CONFIG);
  }
}

/**
 * Admin-only explicit action (H17): restaura configuración base y patrocinadores iniciales con IDs fijos.
 * Nunca sobreescribe datos reales de pago existentes (CLABE, banco, titular, WhatsApp).
 */
export async function restoreDefaultConfigAndSponsors(): Promise<{
  configRestored: boolean;
  sponsorsSeeded: number;
}> {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIG, CONFIG_DOC_ID);
    const existingConfigSnap = await getDoc(configRef);
    const cutoffs = deriveAgeCutoffs(DEFAULT_CONFIG.fechaIso);

    if (!existingConfigSnap.exists()) {
      await setDoc(configRef, {
        ...DEFAULT_CONFIG,
        fechaCorteMayoriaEdad: cutoffs.fechaCorteMayoriaEdad,
        fechaCorteJuvenil: cutoffs.fechaCorteJuvenil,
        fechaLimiteTimestamp: Timestamp.fromDate(new Date(DEFAULT_CONFIG.fechaLimiteIso!)),
      });
    } else {
      const current = existingConfigSnap.data() as Partial<TournamentConfig>;
      const hasRealPayment = !isPlaceholderPaymentConfig({
        clabe: current.clabe || '',
        banco: current.banco || '',
        titular: current.titular || '',
        whatsappContacto: current.whatsappContacto || '',
      });
      const safeMerge: Partial<TournamentConfig> = {
        ...DEFAULT_CONFIG,
        ...current,
        ...(hasRealPayment
          ? {
              clabe: current.clabe,
              banco: current.banco,
              titular: current.titular,
              whatsappContacto: current.whatsappContacto,
            }
          : {}),
      };
      await setDoc(configRef, safeMerge, { merge: true });
    }

    const batch = writeBatch(db);
    let sponsorsSeeded = 0;
    for (const sp of INITIAL_SPONSORS) {
      const fixedId = sp.id || `sponsor-${String(sp.orden || sponsorsSeeded + 1).padStart(2, '0')}`;
      const { id: _ignored, ...rest } = sp;
      batch.set(doc(db, COLLECTIONS.SPONSORS, fixedId), rest, { merge: true });
      sponsorsSeeded++;
    }
    await batch.commit();

    return { configRestored: true, sponsorsSeeded };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.CONFIG);
  }
}

/**
 * Subscribe to sponsors (Public & Admin)
 */
export function subscribeToSponsors(
  onUpdate: (sponsors: Sponsor[]) => void,
  onError?: (err: unknown) => void
) {
  const sponsorsRef = collection(db, COLLECTIONS.SPONSORS);

  return onSnapshot(
    sponsorsRef,
    (snapshot) => {
      if (!snapshot.empty) {
        const list: Sponsor[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Sponsor, 'id'>),
        }));
        onUpdate(list);
      } else {
        onUpdate(INITIAL_SPONSORS);
      }
    },
    (error) => {
      onUpdate(INITIAL_SPONSORS);
      if (onError) onError(error);
    }
  );
}

/**
 * Add or update sponsor (Admin only)
 */
export async function saveSponsor(sponsor: Sponsor) {
  try {
    const { id, ...raw } = sponsor;
    const data = {
      nombre: raw.nombre.trim(),
      logo: raw.logo || '',
      enlace: raw.enlace?.trim() || '#',
      activo: raw.activo !== false,
      ...(raw.orden !== undefined ? { orden: Number(raw.orden) } : {}),
      ...(raw.categoriaSponsor ? { categoriaSponsor: raw.categoriaSponsor.trim() } : {}),
    };
    if (id) {
      await setDoc(doc(db, COLLECTIONS.SPONSORS, id), data, { merge: true });
    } else {
      await addDoc(collection(db, COLLECTIONS.SPONSORS), data);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.SPONSORS);
  }
}

/**
 * Delete sponsor (Admin only)
 */
export async function deleteSponsor(sponsorId: string) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.SPONSORS, sponsorId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.SPONSORS);
  }
}

/**
 * Admin-only: Subscribe to private participants list ordered by newest registration first
 */
export function subscribeToParticipants(
  onUpdate: (participants: Participant[]) => void,
  onError?: (err: unknown) => void
) {
  const participantsRef = query(
    collection(db, COLLECTIONS.PARTICIPANTS),
    orderBy('fechaRegistro', 'desc')
  );

  return onSnapshot(
    participantsRef,
    (snapshot) => {
      const list: Participant[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Participant, 'id'>),
      }));
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

/**
 * Admin-only: actualiza participante con historial, auditoría de pago y sincronización a `/participantes_publicos`.
 */
export async function updateParticipant(
  id: string,
  updates: Partial<Participant>,
  actorName = 'Administrador',
  eventFechaIso = DEFAULT_EVENT_ISO
) {
  try {
    const privRef = doc(db, COLLECTIONS.PARTICIPANTS, id);
    const pubRef = doc(db, COLLECTIONS.PUBLIC_PARTICIPANTS, id);
    const currentSnap = await getDoc(privRef);
    if (!currentSnap.exists()) {
      throw new Error('Participante no encontrado.');
    }

    const nowIso = new Date().toISOString();
    const actor = actorName.trim().slice(0, 120) || 'Administrador';
    const current = currentSnap.data() as Omit<Participant, 'id'>;

    const merged: Omit<Participant, 'id'> = {
      ...current,
      ...updates,
      nombre: buildParticipantNames(updates.nombre ?? current.nombre).privateName,
      correo: normalizeEmailKey(updates.correo ?? current.correo),
      whatsapp: normalizeWhatsappKey(updates.whatsapp ?? current.whatsapp),
      categoria: normalizeCategory(updates.categoria ?? current.categoria),
      esAficionado: Boolean(updates.esAficionado ?? current.esAficionado),
      esFemenil: Boolean(updates.esFemenil ?? current.esFemenil),
    };

    const existingHistory = Array.isArray(current.historial) ? [...current.historial] : [];
    const changesDesc: string[] = [];
    if (updates.estatusPago && updates.estatusPago !== current.estatusPago) {
      changesDesc.push(
        updates.estatusPago === 'pagado' ? 'Pago confirmado' : 'Pago revertido a pendiente'
      );
    } else {
      changesDesc.push('Datos actualizados');
    }

    const nextHistory: ParticipantHistoryEntry[] = [
      ...existingHistory,
      {
        accion: changesDesc.join(', '),
        fecha: nowIso,
        autor: actor,
      },
    ].slice(-50);

    const privPatch: Record<string, unknown> = {
      nombre: merged.nombre,
      fechaNacimiento: merged.fechaNacimiento,
      whatsapp: merged.whatsapp,
      correo: merged.correo,
      categoria: merged.categoria,
      estatusPago: merged.estatusPago,
      esAficionado: merged.esAficionado,
      esFemenil: merged.esFemenil,
      historial: nextHistory,
    };

    if (updates.estatusPago === 'pagado' && current.estatusPago !== 'pagado') {
      privPatch.pagadoPor = actor;
      privPatch.pagadoEn = nowIso;
    }

    const batch = writeBatch(db);
    batch.update(privRef, privPatch);
    if (!merged.eliminado) {
      batch.set(pubRef, toPublicParticipantPayload(merged, undefined, eventFechaIso));
    }
    await batch.commit();
    invalidatePublicRosterCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.PARTICIPANTS);
  }
}

/**
 * Admin-only: marca en lote múltiples participantes como pagados con tamaño de lote seguro y progreso.
 */
export async function batchMarkParticipantsPaid(
  participants: Participant[],
  actorName = 'Administrador',
  eventFechaIso = DEFAULT_EVENT_ISO,
  onProgress?: (processed: number, total: number) => void
): Promise<number> {
  const targets = participants.filter((p) => p.id && !p.eliminado && p.estatusPago !== 'pagado');
  if (targets.length === 0) return 0;

  const nowIso = new Date().toISOString();
  const actor = actorName.trim().slice(0, 120) || 'Administrador';
  let updated = 0;

  try {
    for (let i = 0; i < targets.length; i += SAFE_ADMIN_PAIR_BATCH_SIZE) {
      const slice = targets.slice(i, i + SAFE_ADMIN_PAIR_BATCH_SIZE);
      const batch = writeBatch(db);
      for (const p of slice) {
        if (!p.id) continue;
        const history = [
          ...(Array.isArray(p.historial) ? p.historial : []),
          { accion: 'Pago confirmado (lote)', fecha: nowIso, autor: actor },
        ].slice(-50);

        batch.update(doc(db, COLLECTIONS.PARTICIPANTS, p.id), {
          estatusPago: 'pagado',
          pagadoPor: actor,
          pagadoEn: nowIso,
          historial: history,
        });
        batch.set(
          doc(db, COLLECTIONS.PUBLIC_PARTICIPANTS, p.id),
          toPublicParticipantPayload({ ...p, estatusPago: 'pagado' }, undefined, eventFechaIso)
        );
        updated++;
      }
      await batch.commit();
      onProgress?.(updated, targets.length);
    }
    invalidatePublicRosterCache();
    return updated;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.PARTICIPANTS);
  }
}

/**
 * Admin-only: Check-in rápido el día del torneo.
 */
export async function toggleParticipantAttendance(
  participant: Participant,
  actorName = 'Administrador'
): Promise<void> {
  if (!participant.id) return;
  const nowIso = new Date().toISOString();
  const actor = actorName.trim().slice(0, 120) || 'Administrador';
  const nextValue = !participant.asistencia;

  const history = [
    ...(Array.isArray(participant.historial) ? participant.historial : []),
    {
      accion: nextValue ? 'Check-in confirmado' : 'Check-in desmarcado',
      fecha: nowIso,
      autor: actor,
    },
  ].slice(-50);

  try {
    await updateDoc(doc(db, COLLECTIONS.PARTICIPANTS, participant.id), {
      asistencia: nextValue,
      asistenciaEn: nextValue ? nowIso : deleteField(),
      historial: history,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.PARTICIPANTS);
  }
}

/**
 * Admin-only: borrado suave (envía a papelera recuperable y quita del padrón público).
 */
export async function softDeleteParticipant(
  participant: Participant,
  actorName = 'Administrador'
): Promise<void> {
  if (!participant.id) return;
  const nowIso = new Date().toISOString();
  const actor = actorName.trim().slice(0, 120) || 'Administrador';

  const history = [
    ...(Array.isArray(participant.historial) ? participant.historial : []),
    { accion: 'Movido a papelera', fecha: nowIso, autor: actor },
  ].slice(-50);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.PARTICIPANTS, participant.id), {
      eliminado: true,
      eliminadoEn: nowIso,
      eliminadoPor: actor,
      historial: history,
    });
    batch.delete(doc(db, COLLECTIONS.PUBLIC_PARTICIPANTS, participant.id));
    await batch.commit();
    invalidatePublicRosterCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.PARTICIPANTS);
  }
}

/**
 * Admin-only: restaura participante desde papelera y lo republica en `/participantes_publicos`.
 */
export async function restoreParticipant(
  participant: Participant,
  actorName = 'Administrador',
  eventFechaIso = DEFAULT_EVENT_ISO
): Promise<void> {
  if (!participant.id) return;
  const nowIso = new Date().toISOString();
  const actor = actorName.trim().slice(0, 120) || 'Administrador';

  const history = [
    ...(Array.isArray(participant.historial) ? participant.historial : []),
    { accion: 'Restaurado de papelera', fecha: nowIso, autor: actor },
  ].slice(-50);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.PARTICIPANTS, participant.id), {
      eliminado: false,
      eliminadoEn: deleteField(),
      eliminadoPor: deleteField(),
      historial: history,
    });
    batch.set(
      doc(db, COLLECTIONS.PUBLIC_PARTICIPANTS, participant.id),
      toPublicParticipantPayload(participant, undefined, eventFechaIso)
    );
    await batch.commit();
    invalidatePublicRosterCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.PARTICIPANTS);
  }
}

/**
 * Admin-only: elimina definitivamente participante, padrón público, comprobante y llaves de duplicado.
 */
export async function deleteParticipant(
  participant: Participant | string,
  reciboIdFallback?: string
) {
  const pObj = typeof participant === 'string' ? null : participant;
  const id = typeof participant === 'string' ? participant : participant.id;
  if (!id) return;

  const reciboId = pObj?.reciboId || reciboIdFallback;

  try {
    let email = pObj?.correo;
    let whatsapp = pObj?.whatsapp;
    if (!email || !whatsapp) {
      const snap = await getDoc(doc(db, COLLECTIONS.PARTICIPANTS, id));
      if (snap.exists()) {
        const d = snap.data() as Partial<Participant>;
        email = email || d.correo;
        whatsapp = whatsapp || d.whatsapp;
      }
    }

    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.PARTICIPANTS, id));
    batch.delete(doc(db, COLLECTIONS.PUBLIC_PARTICIPANTS, id));
    if (reciboId) {
      batch.delete(doc(db, COLLECTIONS.RECEIPTS, reciboId));
    }
    if (email) {
      const eHash = await sha256Hex(`email:${normalizeEmailKey(email)}`);
      batch.delete(doc(db, COLLECTIONS.REGISTRATION_KEYS, eHash));
    }
    if (whatsapp) {
      const wHash = await sha256Hex(`whatsapp:${normalizeWhatsappKey(whatsapp)}`);
      batch.delete(doc(db, COLLECTIONS.REGISTRATION_KEYS, wHash));
    }
    await batch.commit();
    invalidatePublicRosterCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.PARTICIPANTS);
  }
}

/**
 * Admin-only (R3): libera manualmente llaves SHA-256 en `/registro_llaves` si un correo o WhatsApp quedó bloqueado.
 */
export async function releaseRegistrationKey(input: {
  correo?: string;
  whatsapp?: string;
}): Promise<number> {
  const cleanEmail = input.correo ? normalizeEmailKey(input.correo) : '';
  const cleanWhatsapp = input.whatsapp ? normalizeWhatsappKey(input.whatsapp) : '';

  if (!cleanEmail && !cleanWhatsapp) {
    throw new Error('Ingresa un correo electrónico o un número de WhatsApp a liberar.');
  }

  try {
    const batch = writeBatch(db);
    let ops = 0;

    if (cleanEmail) {
      const eHash = await sha256Hex(`email:${cleanEmail}`);
      batch.delete(doc(db, COLLECTIONS.REGISTRATION_KEYS, eHash));
      ops++;
    }
    if (cleanWhatsapp && cleanWhatsapp.length === 10) {
      const wHash = await sha256Hex(`whatsapp:${cleanWhatsapp}`);
      batch.delete(doc(db, COLLECTIONS.REGISTRATION_KEYS, wHash));
      ops++;
    }

    if (ops === 0) {
      throw new Error('Proporciona un correo válido o un WhatsApp de 10 dígitos.');
    }

    await batch.commit();
    return ops;
  } catch (error) {
    if (error instanceof Error && !(error instanceof AppFirestoreError) && !('code' in error)) {
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.REGISTRATION_KEYS);
  }
}

/**
 * Admin-only: obtiene los IDs actuales del padrón público para calcular registros faltantes por migrar.
 */
export async function fetchPublicRosterIds(): Promise<Set<string>> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.PUBLIC_PARTICIPANTS));
    return new Set(snap.docs.map((d) => d.id));
  } catch {
    return new Set();
  }
}

/**
 * Admin-only: purga todos los comprobantes de la bóveda privada tras concluir el torneo,
 * fragmentado en lotes seguros con progreso.
 */
export async function purgeAllReceipts(
  participants: Participant[],
  onProgress?: (processed: number, total: number) => void
): Promise<number> {
  let purged = 0;
  const targets = participants.filter((p) => p.id && p.reciboId);
  if (targets.length === 0) return 0;

  try {
    for (let i = 0; i < targets.length; i += SAFE_ADMIN_PAIR_BATCH_SIZE) {
      const slice = targets.slice(i, i + SAFE_ADMIN_PAIR_BATCH_SIZE);
      const batch = writeBatch(db);
      for (const p of slice) {
        if (!p.id || !p.reciboId) continue;
        batch.delete(doc(db, COLLECTIONS.RECEIPTS, p.reciboId));
        batch.update(doc(db, COLLECTIONS.PARTICIPANTS, p.id), {
          tieneRecibo: false,
          reciboId: deleteField(),
          reciboNombreArchivo: deleteField(),
        });
        purged++;
      }
      await batch.commit();
      onProgress?.(purged, targets.length);
    }
    return purged;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.RECEIPTS);
  }
}

/**
 * Admin-only: anonimiza datos personales tras el evento y elimina comprobantes/llaves,
 * fragmentado en lotes seguros (máx. 5 operaciones por participante <= 20 por lote).
 */
export async function anonymizeAllParticipantsPostEvent(
  participants: Participant[],
  onProgress?: (processed: number, total: number) => void
): Promise<number> {
  const validTargets = participants.filter((p) => Boolean(p.id));
  if (validTargets.length === 0) return 0;
  let processed = 0;

  try {
    for (let i = 0; i < validTargets.length; i += SAFE_ADMIN_MULTI_OP_BATCH_SIZE) {
      const slice = validTargets.slice(i, i + SAFE_ADMIN_MULTI_OP_BATCH_SIZE);
      const batch = writeBatch(db);
      for (const p of slice) {
        if (!p.id) continue;
        const anonFolio = p.folio || `PAVO-${p.id.slice(0, 6).toUpperCase()}`;
        if (p.reciboId) {
          batch.delete(doc(db, COLLECTIONS.RECEIPTS, p.reciboId));
        }
        if (p.correo && !p.correo.endsWith('@eliminado.local')) {
          const eHash = await sha256Hex(`email:${normalizeEmailKey(p.correo)}`);
          batch.delete(doc(db, COLLECTIONS.REGISTRATION_KEYS, eHash));
        }
        if (p.whatsapp && !/^0+$/.test(p.whatsapp)) {
          const wHash = await sha256Hex(`whatsapp:${normalizeWhatsappKey(p.whatsapp)}`);
          batch.delete(doc(db, COLLECTIONS.REGISTRATION_KEYS, wHash));
        }
        batch.update(doc(db, COLLECTIONS.PARTICIPANTS, p.id), {
          nombre: `Participante ${anonFolio}`,
          fechaNacimiento: '1970-01-01',
          whatsapp: '0000000000',
          correo: `anon-${anonFolio.toLowerCase()}@eliminado.local`,
          tieneRecibo: false,
          reciboId: deleteField(),
          reciboNombreArchivo: deleteField(),
          nombreTutor: deleteField(),
          consentimientoTutor: deleteField(),
          notas: 'Datos personales anonimizados post-torneo',
        });
        if (!p.eliminado) {
          batch.set(doc(db, COLLECTIONS.PUBLIC_PARTICIPANTS, p.id), {
            folio: anonFolio,
            nombre: `Participante ${anonFolio}`,
            categoria: normalizeCategory(p.categoria),
            esAficionado: Boolean(p.esAficionado),
            esFemenil: Boolean(p.esFemenil),
            estatusPago: p.estatusPago,
            fechaRegistro: p.fechaRegistro,
          });
        }
        processed++;
      }
      await batch.commit();
      onProgress?.(processed, validTargets.length);
    }
    invalidatePublicRosterCache();
    return processed;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.PARTICIPANTS);
  }
}

/**
 * Admin-only: sincroniza registros activos hacia `/participantes_publicos` (idempotente),
 * fragmentado en lotes seguros con progreso.
 */
export async function syncPublicRosterFromPrivate(
  participants: Participant[],
  eventFechaIso = DEFAULT_EVENT_ISO,
  onProgress?: (processed: number, total: number) => void
): Promise<number> {
  const active = participants.filter((p) => p.id && !p.eliminado);
  if (active.length === 0) return 0;

  try {
    let synced = 0;
    for (let i = 0; i < active.length; i += SAFE_ADMIN_BATCH_SIZE) {
      const slice = active.slice(i, i + SAFE_ADMIN_BATCH_SIZE);
      const batch = writeBatch(db);
      for (const p of slice) {
        if (!p.id) continue;
        batch.set(
          doc(db, COLLECTIONS.PUBLIC_PARTICIPANTS, p.id),
          toPublicParticipantPayload(p, undefined, eventFechaIso)
        );
        synced++;
      }
      await batch.commit();
      onProgress?.(synced, active.length);
    }
    invalidatePublicRosterCache();
    return synced;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.PUBLIC_PARTICIPANTS);
  }
}

/**
 * Admin-only: Subscribe to dynamically added admin emails in `/admins_by_email`
 */
export function subscribeToAdminMembers(
  onUpdate: (members: AdminMember[]) => void,
  onError?: (err: unknown) => void
) {
  const ref = collection(db, COLLECTIONS.ADMINS_BY_EMAIL);
  return onSnapshot(
    ref,
    (snapshot) => {
      const list: AdminMember[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AdminMember, 'id'>),
      }));
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

/**
 * Admin-only: Add an authorized admin email (grants Google Sign-In admin access)
 */
export async function addAdminMember(member: Omit<AdminMember, 'id' | 'agregadoEn'>) {
  const cleanEmail = member.email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Ingresa un correo electrónico válido.');
  }

  try {
    await setDoc(doc(db, COLLECTIONS.ADMINS_BY_EMAIL, cleanEmail), {
      email: cleanEmail,
      nombre: member.nombre.trim() || 'Administrador',
      rol: member.rol.trim() || 'Comité Organizador',
      agregadoEn: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.ADMINS_BY_EMAIL);
  }
}

/**
 * Admin-only: Remove an authorized admin email, preventing self-lockout of the last remaining admin.
 */
export async function removeAdminMember(emailId: string, currentUserEmail?: string | null) {
  const cleanTarget = emailId.trim().toLowerCase();
  const cleanSelf = (currentUserEmail || '').trim().toLowerCase();

  try {
    const [adminsUidSnap, adminsEmailSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.ADMINS)),
      getDocs(collection(db, COLLECTIONS.ADMINS_BY_EMAIL)),
    ]);

    const remainingEmailAdmins = adminsEmailSnap.docs.filter((d) => d.id !== cleanTarget);
    const totalRemaining = adminsUidSnap.size + remainingEmailAdmins.length;

    if (totalRemaining === 0) {
      throw new Error('No puedes eliminar al último administrador autorizado del sistema.');
    }
    if (cleanSelf && cleanSelf === cleanTarget && adminsUidSnap.size === 0) {
      throw new Error('Por seguridad no puedes revocar tu propio último acceso activo.');
    }

    await deleteDoc(doc(db, COLLECTIONS.ADMINS_BY_EMAIL, cleanTarget));
  } catch (error) {
    if (
      error instanceof Error &&
      !(error instanceof AppFirestoreError) &&
      error.message.includes('último')
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.ADMINS_BY_EMAIL);
  }
}
