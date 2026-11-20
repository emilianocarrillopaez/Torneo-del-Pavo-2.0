import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Participant,
  PaymentReceipt,
  AdminMember,
  TournamentConfig,
  Sponsor,
  DEFAULT_CONFIG,
  INITIAL_SPONSORS,
} from '../types/tournament';
import { ProcessedReceiptFile } from '../utils/receiptUtils';

const PARTICIPANTS_COLLECTION = 'participantes';
const RECEIPTS_COLLECTION = 'comprobantes';
const CONFIG_COLLECTION = 'configuracion';
const SPONSORS_COLLECTION = 'patrocinadores';
const ADMINS_BY_EMAIL_COLLECTION = 'admins_by_email';
const CONFIG_DOC_ID = 'general';

/**
 * Check if WhatsApp or Email is already registered
 */
export async function checkDuplicateRegistration(
  email: string,
  whatsapp: string
): Promise<{ isDuplicate: boolean; message?: string }> {
  try {
    const qEmail = query(
      collection(db, PARTICIPANTS_COLLECTION),
      where('correo', '==', email.trim().toLowerCase())
    );
    const snapEmail = await getDocs(qEmail);
    if (!snapEmail.empty) {
      return {
        isDuplicate: true,
        message: 'Este correo electrónico ya cuenta con un registro en el torneo.',
      };
    }

    const qWhatsapp = query(
      collection(db, PARTICIPANTS_COLLECTION),
      where('whatsapp', '==', whatsapp.trim())
    );
    const snapWhatsapp = await getDocs(qWhatsapp);
    if (!snapWhatsapp.empty) {
      return {
        isDuplicate: true,
        message: 'Este número de WhatsApp ya se encuentra registrado.',
      };
    }

    return { isDuplicate: false };
  } catch (err) {
    console.warn('Duplicate check constrained:', err);
    return { isDuplicate: false };
  }
}

/**
 * Register a new participant WITH mandatory private payment receipt.
 * The receipt image/PDF is stored in the admin-only `/comprobantes/{reciboId}` vault.
 * Only opaque metadata (`tieneRecibo`, `reciboId`, `reciboNombreArchivo`) is stored on `/participantes`.
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
  receipt: ProcessedReceiptFile
): Promise<{ id: string; folio: string; reciboId: string }> {
  if (!receipt || !receipt.dataUrl) {
    throw new Error('El comprobante de pago es obligatorio para completar la inscripción.');
  }

  const nowIso = new Date().toISOString();
  const folio = `PAVO-${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanName = data.nombre.trim();

  // Pre-generate IDs so both docs cross-reference each other cleanly
  const participantRef = doc(collection(db, PARTICIPANTS_COLLECTION));
  const receiptRef = doc(collection(db, RECEIPTS_COLLECTION));

  const receiptPayload: Omit<PaymentReceipt, 'id'> = {
    participantId: participantRef.id,
    folio,
    participantNombre: cleanName,
    fileName: receipt.fileName.slice(0, 180),
    mimeType: receipt.mimeType,
    fileSize: receipt.fileSize,
    imageDataUrl: receipt.dataUrl,
    uploadedAt: nowIso,
  };

  const participantPayload: Omit<Participant, 'id'> = {
    ...data,
    nombre: cleanName,
    correo: data.correo.trim().toLowerCase(),
    whatsapp: data.whatsapp.trim(),
    estatusPago: 'pendiente',
    fechaRegistro: nowIso,
    folio,
    tieneRecibo: true,
    reciboId: receiptRef.id,
    reciboNombreArchivo: receipt.fileName.slice(0, 160),
  };

  try {
    // 1. Store payment receipt in the admin-only vault
    await setDoc(receiptRef, receiptPayload);

    // 2. Store participant record referencing the opaque receipt ID
    await setDoc(participantRef, participantPayload);

    // 3. Increment public totalInscritos counter
    try {
      const configDocRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
      const snap = await getDoc(configDocRef);
      const currentTotal = snap.exists() ? Number(snap.data()?.totalInscritos || 0) : 0;
      await updateDoc(configDocRef, {
        totalInscritos: currentTotal + 1,
      });
    } catch {
      // Non-critical if config document doesn't exist yet
    }

    return { id: participantRef.id, folio, reciboId: receiptRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PARTICIPANTS_COLLECTION);
  }
}

/**
 * Admin-only: manually create a participant (with optional receipt upload)
 */
export async function createParticipantAsAdmin(
  data: Omit<Participant, 'id' | 'fechaRegistro' | 'folio'>,
  receipt?: ProcessedReceiptFile | null
): Promise<{ id: string; folio: string; reciboId?: string }> {
  const nowIso = new Date().toISOString();
  const folio = `PAVO-${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanName = data.nombre.trim();
  const participantRef = doc(collection(db, PARTICIPANTS_COLLECTION));

  let reciboId: string | undefined;
  let reciboNombreArchivo: string | undefined;

  try {
    if (receipt && receipt.dataUrl) {
      const receiptRef = doc(collection(db, RECEIPTS_COLLECTION));
      reciboId = receiptRef.id;
      reciboNombreArchivo = receipt.fileName.slice(0, 160);
      await setDoc(receiptRef, {
        participantId: participantRef.id,
        folio,
        participantNombre: cleanName,
        fileName: receipt.fileName.slice(0, 180),
        mimeType: receipt.mimeType,
        fileSize: receipt.fileSize,
        imageDataUrl: receipt.dataUrl,
        uploadedAt: nowIso,
      });
    }

    const payload: Omit<Participant, 'id'> = {
      ...data,
      nombre: cleanName,
      correo: data.correo.trim().toLowerCase(),
      whatsapp: data.whatsapp.trim(),
      fechaRegistro: nowIso,
      folio,
      tieneRecibo: Boolean(reciboId),
      ...(reciboId ? { reciboId, reciboNombreArchivo } : {}),
    };

    await setDoc(participantRef, payload);

    try {
      const configDocRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
      const snap = await getDoc(configDocRef);
      const currentTotal = snap.exists() ? Number(snap.data()?.totalInscritos || 0) : 0;
      await updateDoc(configDocRef, { totalInscritos: currentTotal + 1 });
    } catch {
      // ignore
    }

    return { id: participantRef.id, folio, reciboId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PARTICIPANTS_COLLECTION);
  }
}

/**
 * Admin-only: Fetch a single payment receipt from the private `/comprobantes` vault
 */
export async function getReceiptById(reciboId: string): Promise<PaymentReceipt | null> {
  try {
    const snap = await getDoc(doc(db, RECEIPTS_COLLECTION, reciboId));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...(snap.data() as Omit<PaymentReceipt, 'id'>),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${RECEIPTS_COLLECTION}/${reciboId}`);
  }
}

/**
 * Admin-only: Attach or replace a payment receipt for an existing participant
 */
export async function attachReceiptToParticipant(
  participant: Participant,
  receipt: ProcessedReceiptFile
): Promise<string> {
  if (!participant.id) {
    throw new Error('Participante sin identificador válido.');
  }

  const nowIso = new Date().toISOString();
  const receiptRef = participant.reciboId
    ? doc(db, RECEIPTS_COLLECTION, participant.reciboId)
    : doc(collection(db, RECEIPTS_COLLECTION));

  try {
    await setDoc(receiptRef, {
      participantId: participant.id,
      folio: participant.folio || 'S/F',
      participantNombre: participant.nombre,
      fileName: receipt.fileName.slice(0, 180),
      mimeType: receipt.mimeType,
      fileSize: receipt.fileSize,
      imageDataUrl: receipt.dataUrl,
      uploadedAt: nowIso,
    });

    await updateDoc(doc(db, PARTICIPANTS_COLLECTION, participant.id), {
      tieneRecibo: true,
      reciboId: receiptRef.id,
      reciboNombreArchivo: receipt.fileName.slice(0, 160),
    });

    return receiptRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${RECEIPTS_COLLECTION}/${receiptRef.id}`);
  }
}

/**
 * Admin-only: Delete a payment receipt document
 */
export async function deleteReceipt(reciboId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, RECEIPTS_COLLECTION, reciboId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${RECEIPTS_COLLECTION}/${reciboId}`);
  }
}

/**
 * Subscribe to tournament configuration with fallback to default
 */
export function subscribeToConfig(
  onUpdate: (config: TournamentConfig) => void,
  onError?: (err: unknown) => void
) {
  const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);

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
      console.warn('Error reading config snapshot, using default config:', error);
      onUpdate(DEFAULT_CONFIG);
      if (onError) onError(error);
    }
  );
}

/**
 * Save / Update tournament configuration (Admin only)
 */
export async function updateTournamentConfig(config: Partial<TournamentConfig>) {
  const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
  try {
    await setDoc(docRef, config, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${CONFIG_COLLECTION}/${CONFIG_DOC_ID}`);
  }
}

/**
 * Subscribe to sponsors (Public & Admin)
 */
export function subscribeToSponsors(
  onUpdate: (sponsors: Sponsor[]) => void,
  onError?: (err: unknown) => void
) {
  const sponsorsRef = collection(db, SPONSORS_COLLECTION);

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
      console.warn('Error reading sponsors, using initial:', error);
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
    if (sponsor.id) {
      const docRef = doc(db, SPONSORS_COLLECTION, sponsor.id);
      const { id, ...data } = sponsor;
      await setDoc(docRef, data, { merge: true });
    } else {
      const { id, ...data } = sponsor;
      await addDoc(collection(db, SPONSORS_COLLECTION), data);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, SPONSORS_COLLECTION);
  }
}

/**
 * Delete sponsor (Admin only)
 */
export async function deleteSponsor(sponsorId: string) {
  try {
    await deleteDoc(doc(db, SPONSORS_COLLECTION, sponsorId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SPONSORS_COLLECTION}/${sponsorId}`);
  }
}

/**
 * Subscribe to participants list ordered by newest registration first
 */
export function subscribeToParticipants(
  onUpdate: (participants: Participant[]) => void,
  onError?: (err: unknown) => void
) {
  const participantsRef = query(
    collection(db, PARTICIPANTS_COLLECTION),
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
      console.error('Error reading participants snapshot:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Update participant (Admin only)
 */
export async function updateParticipant(id: string, updates: Partial<Participant>) {
  try {
    const docRef = doc(db, PARTICIPANTS_COLLECTION, id);
    await updateDoc(docRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PARTICIPANTS_COLLECTION}/${id}`);
  }
}

/**
 * Delete participant & its private payment receipt if present (Admin only)
 */
export async function deleteParticipant(id: string, reciboId?: string) {
  try {
    await deleteDoc(doc(db, PARTICIPANTS_COLLECTION, id));
    if (reciboId) {
      try {
        await deleteDoc(doc(db, RECEIPTS_COLLECTION, reciboId));
      } catch {
        // Non-fatal if receipt was already removed
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PARTICIPANTS_COLLECTION}/${id}`);
  }
}

/**
 * Admin-only: Subscribe to dynamically added admin emails in `/admins_by_email`
 */
export function subscribeToAdminMembers(
  onUpdate: (members: AdminMember[]) => void,
  onError?: (err: unknown) => void
) {
  const ref = collection(db, ADMINS_BY_EMAIL_COLLECTION);
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
 * Admin-only: Add an authorized admin email (grants Google Sign-In admin access immediately)
 */
export async function addAdminMember(member: Omit<AdminMember, 'id' | 'agregadoEn'>) {
  const cleanEmail = member.email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Ingresa un correo electrónico válido.');
  }

  try {
    await setDoc(doc(db, ADMINS_BY_EMAIL_COLLECTION, cleanEmail), {
      email: cleanEmail,
      nombre: member.nombre.trim() || 'Administrador',
      rol: member.rol.trim() || 'Comité Organizador',
      agregadoEn: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ADMINS_BY_EMAIL_COLLECTION}/${cleanEmail}`);
  }
}

/**
 * Admin-only: Remove a dynamically authorized admin email
 */
export async function removeAdminMember(emailId: string) {
  try {
    await deleteDoc(doc(db, ADMINS_BY_EMAIL_COLLECTION, emailId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ADMINS_BY_EMAIL_COLLECTION}/${emailId}`);
  }
}

/**
 * Seed initial config and sponsors if collection is empty
 */
export async function seedInitialDataIfEmpty() {
  try {
    const configDoc = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID));
    if (!configDoc.exists()) {
      await setDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID), DEFAULT_CONFIG);
    }

    const sponsorsSnap = await getDocs(collection(db, SPONSORS_COLLECTION));
    if (sponsorsSnap.empty) {
      for (const sp of INITIAL_SPONSORS) {
        await addDoc(collection(db, SPONSORS_COLLECTION), sp);
      }
    }
  } catch (err) {
    console.info('Initial data seeding note:', err);
  }
}
