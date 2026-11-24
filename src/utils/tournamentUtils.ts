import {
  ALLOWED_RECEIPT_MIME_TYPES,
  DEFAULT_EVENT_ISO,
  EMAIL_REGEX,
  ISO_DATE_REGEX,
  JUVENIL_MAX_AGE,
  MASK_PUBLIC_LAST_NAMES,
  MAX_PARTICIPANT_AGE,
  MAX_RAW_RECEIPT_BYTES,
  MIN_PARTICIPANT_AGE,
  MINOR_CONSENT_AGE,
  PHONE_10_REGEX,
  PRIVACY_NOTICE_VERSION,
} from '../constants/tournament';
import {
  CATEGORY_DETAILS,
  Participant,
  PublicParticipant,
  TournamentCategory,
  TournamentConfig,
  normalizeCategory,
} from '../types/tournament';

export {
  PRIVACY_NOTICE_VERSION,
  MASK_PUBLIC_LAST_NAMES,
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RAW_RECEIPT_BYTES,
};

export interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isStarted: boolean;
}

const SPANISH_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export interface EventDateParts {
  year: number;
  monthIndex: number; // 0-11
  day: number;
  ymd: string;
}

/**
 * Extrae YYYY, MM (0-11) y DD sin desfases de zona horaria a partir de fechaIso.
 */
export function extractEventDateParts(fechaIso?: string): EventDateParts {
  const source = (fechaIso || DEFAULT_EVENT_ISO).trim();
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    if (year >= 2020 && monthIndex >= 0 && monthIndex <= 11 && day >= 1 && day <= 31) {
      return {
        year,
        monthIndex,
        day,
        ymd: `${match[1]}-${match[2]}-${match[3]}`,
      };
    }
  }
  return { year: 2026, monthIndex: 11, day: 19, ymd: '2026-12-19' };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYmdSpanish(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return ymd;
  return `${d} de ${SPANISH_MONTHS[m - 1]} de ${y}`;
}

export interface DerivedAgeCutoffs {
  eventYmd: string;
  eventDateSpanish: string;
  fechaCorteMayoriaEdad: string; // Cumple 18 años en el evento (> fecha = menor)
  fechaCorteJuvenil: string; // Cumple 19 años en el evento (> fecha = <= 18 años)
  juvenilMinBirthYmd: string; // Día siguiente a fechaCorteJuvenil ("nacidos a partir de...")
  juvenilMinBirthSpanish: string;
}

/**
 * Deriva automáticamente fechas de corte legales y deportivas desde config.fechaIso (H18).
 */
export function deriveAgeCutoffs(fechaIso?: string): DerivedAgeCutoffs {
  const { year, monthIndex, day, ymd } = extractEventDateParts(fechaIso);
  const majorityYear = year - MINOR_CONSENT_AGE;
  const juvenilCutoffYear = year - (JUVENIL_MAX_AGE + 1);

  const clampDay = (targetYear: number, mIdx: number, d: number) => {
    const maxDay = new Date(Date.UTC(targetYear, mIdx + 1, 0)).getUTCDate();
    return Math.min(d, maxDay);
  };

  const majorityDay = clampDay(majorityYear, monthIndex, day);
  const juvenilDay = clampDay(juvenilCutoffYear, monthIndex, day);

  const fechaCorteMayoriaEdad = `${majorityYear}-${pad2(monthIndex + 1)}-${pad2(majorityDay)}`;
  const fechaCorteJuvenil = `${juvenilCutoffYear}-${pad2(monthIndex + 1)}-${pad2(juvenilDay)}`;

  const nextDayUtc = new Date(Date.UTC(juvenilCutoffYear, monthIndex, juvenilDay + 1));
  const juvenilMinBirthYmd = nextDayUtc.toISOString().slice(0, 10);

  return {
    eventYmd: ymd,
    eventDateSpanish: formatYmdSpanish(ymd),
    fechaCorteMayoriaEdad,
    fechaCorteJuvenil,
    juvenilMinBirthYmd,
    juvenilMinBirthSpanish: formatYmdSpanish(juvenilMinBirthYmd),
  };
}

/**
 * Pure countdown computation to a target ISO date string.
 */
export function computeCountdown(targetIso: string, nowMs: number = Date.now()): CountdownState {
  const trimmed = (targetIso || '').trim();
  const parsed = trimmed ? Date.parse(trimmed) : Number.NaN;
  const fallbackMs = Date.parse(DEFAULT_EVENT_ISO);
  const targetMs = Number.isNaN(parsed) ? fallbackMs : parsed;
  const diff = targetMs - nowMs;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      isStarted: true,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalMs: diff,
    isStarted: false,
  };
}

/**
 * Pure unbiased Fisher-Yates shuffle returning a new array.
 */
export function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Calculates participant age at the tournament day (derived from fechaIso or explicit Y/M/D).
 */
export function calculateAgeAtTournament(
  birthdateStr: string,
  eventYearOrIso: number | string = DEFAULT_EVENT_ISO,
  eventMonthIndex = 11,
  eventDay = 19
): number | null {
  if (!birthdateStr || !ISO_DATE_REGEX.test(birthdateStr)) return null;
  const parts = birthdateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [birthYear, birthMonth, birthDay] = parts;
  if (birthYear < 1920 || birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
    return null;
  }

  const checkCalendar = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay));
  if (
    checkCalendar.getUTCFullYear() !== birthYear ||
    checkCalendar.getUTCMonth() !== birthMonth - 1 ||
    checkCalendar.getUTCDate() !== birthDay
  ) {
    return null;
  }

  let targetYear: number;
  let targetMonthIndex: number;
  let targetDay: number;

  if (typeof eventYearOrIso === 'string') {
    const parsed = extractEventDateParts(eventYearOrIso);
    targetYear = parsed.year;
    targetMonthIndex = parsed.monthIndex;
    targetDay = parsed.day;
  } else {
    targetYear = eventYearOrIso;
    targetMonthIndex = eventMonthIndex;
    targetDay = eventDay;
  }

  let age = targetYear - birthYear;
  const targetMonth = targetMonthIndex + 1;
  if (targetMonth < birthMonth || (targetMonth === birthMonth && targetDay < birthDay)) {
    age--;
  }
  return age;
}

export function getAgeRangeLabel(age: number | null): string {
  if (age === null) return 'N/D';
  if (age <= 12) return 'Infantil (≤ 12)';
  if (age <= 18) return 'Juvenil (13–18)';
  return 'Adulto (+18)';
}

export function getDynamicCategoryDetails(fechaIso?: string) {
  const cutoffs = deriveAgeCutoffs(fechaIso);
  return {
    ...CATEGORY_DETAILS,
    Juvenil: {
      ...CATEGORY_DETAILS.Juvenil,
      ageRequirement: `18 años o menos al ${cutoffs.eventDateSpanish} (nacidos a partir del ${cutoffs.juvenilMinBirthSpanish}).`,
    },
  };
}

export const PARTICIPANT_FULL_NAME_REGEX = /^[\p{L}][\p{L} .'-]{1,148}[\p{L}.]$/u;

export type NameBuildInput =
  | string
  | {
      paterno?: string;
      materno?: string;
      nombre: string;
    };

/**
 * Normaliza un nombre completo en orden oficial: Apellido Paterno + Apellido Materno + Nombre(s).
 */
export function normalizeFullName(input: NameBuildInput): string {
  if (typeof input === 'string') {
    return input.trim().replace(/\s+/g, ' ');
  }
  return [input.paterno, input.materno, input.nombre]
    .map((part) => (part || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * Formatea el nombre para el padrón público según MASK_PUBLIC_LAST_NAMES.
 * Garantiza longitud mínima >= 3 caracteres y coincidencia exacta de la primera palabra con el nombre privado.
 */
export function formatPublicParticipantName(
  fullName: string,
  maskLastNames: boolean = MASK_PUBLIC_LAST_NAMES
): string {
  const clean = normalizeFullName(fullName);
  if (!maskLastNames || !clean) return clean;
  const parts = clean.split(' ');
  if (parts.length === 1) return parts[0];
  const firstPart = parts[0];
  const initials = parts
    .slice(1)
    .map((p) => {
      const ch = Array.from(p)[0] || '';
      return ch ? `${ch.toLocaleUpperCase('es-MX')}.` : '';
    })
    .filter(Boolean)
    .join(' ');
  const masked = `${firstPart} ${initials}`.trim();
  return masked.length >= 3 ? masked : clean;
}

/**
 * Única fuente de verdad para generar nombre privado y nombre público garantizando
 * compatibilidad estricta con la regla `validatePublicRosterMatch` (misma primera palabra).
 */
export function buildParticipantNames(
  input: NameBuildInput,
  maskLastNames: boolean = MASK_PUBLIC_LAST_NAMES
): { privateName: string; publicName: string } {
  const privateName = normalizeFullName(input);
  const publicName = formatPublicParticipantName(privateName, maskLastNames);
  return { privateName, publicName };
}

/**
 * Prepara la entrada sanitizada para `/participantes_publicos`.
 * Para menores (< 18 años) omite por completo el campo `edad` (deja únicamente `rangoEdad`).
 */
export function toPublicParticipantPayload(
  participant: Omit<Participant, 'id'>,
  maskLastNames: boolean = MASK_PUBLIC_LAST_NAMES,
  eventFechaIso: string = DEFAULT_EVENT_ISO
): Omit<PublicParticipant, 'id'> {
  const age = calculateAgeAtTournament(participant.fechaNacimiento, eventFechaIso);
  const { publicName } = buildParticipantNames(participant.nombre, maskLastNames);
  const payload: Omit<PublicParticipant, 'id'> = {
    folio: participant.folio,
    nombre: publicName,
    categoria: normalizeCategory(participant.categoria),
    esAficionado: Boolean(participant.esAficionado),
    esFemenil: Boolean(participant.esFemenil),
    estatusPago: participant.estatusPago,
    rangoEdad: getAgeRangeLabel(age),
    fechaRegistro: participant.fechaRegistro,
  };
  if (age !== null && age >= MINOR_CONSENT_AGE && age <= 110) {
    payload.edad = age;
  }
  return payload;
}

const FOLIO_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Genera un folio criptográfico impredecible de 6 caracteres sin ambigüedad.
 */
export function generateSecureFolio(length = 6, prefix: 'PAVO' | 'ESPERA' = 'PAVO'): string {
  const bytes = new Uint8Array(length);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    throw new Error('Entorno sin generador criptográfico seguro para generar folio.');
  }
  let code = '';
  for (let i = 0; i < length; i++) {
    code += FOLIO_ALPHABET[bytes[i] % FOLIO_ALPHABET.length];
  }
  return `${prefix}-${code}`;
}

/**
 * Valida que una URL externa use exclusivamente https:// (opcionalmente '#' para "sin enlace").
 */
export function safeHttpUrl(
  rawUrl: string | undefined | null,
  options: { allowHash?: boolean; allowHttp?: boolean } = {}
): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (options.allowHash && trimmed === '#') return '#';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    if (options.allowHttp && parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normaliza teléfono a 10 dígitos (+52) y codifica texto con encodeURIComponent.
 */
export function formatWhatsAppUrl(
  rawPhone: string | undefined | null,
  message?: string
): string | null {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits || digits.length < 10 || /^0+$/.test(digits)) {
    return null;
  }
  const normalized = digits.length === 10 ? `52${digits}` : digits;
  const base = `https://wa.me/${normalized}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/**
 * Neutraliza inyección de fórmulas en Excel/CSV cuando una celda comienza con =, +, -, @, tab o CR.
 */
export function sanitizeSpreadsheetCell(value: unknown): string | number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }
  const str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str.trimStart())) {
    return `'${str}`;
  }
  return str;
}

export function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeWhatsappKey(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('52')) {
    return digits.slice(2);
  }
  return digits;
}

export function normalizePersonName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Calcula hash SHA-256 hexadecimal en minúsculas usando Web Crypto API.
 */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Tu navegador no soporta cifrado Web Crypto requerido para validar duplicados.');
  }
  const data = new TextEncoder().encode(input);
  const hashBuffer = await subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface RegistrationValidationInput {
  paterno: string;
  materno: string;
  nombre: string;
  fechaNacimiento: string;
  whatsapp: string;
  correo: string;
  categoria: TournamentCategory | '';
  hasReceipt: boolean;
  aceptoAviso: boolean;
  consentimientoTutor?: boolean;
  nombreTutor?: string;
  requireReceipt?: boolean;
}

export interface RegistrationValidationErrors {
  nombre?: string;
  fechaNacimiento?: string;
  whatsapp?: string;
  correo?: string;
  categoria?: string;
  recibo?: string;
  privacidad?: string;
  tutor?: string;
  general?: string;
}

/**
 * Validador puro de inscripción con cortes dinámicos desde fechaIso, verificación de fechas futuras y longitudes.
 */
export function validateRegistrationInput(
  input: RegistrationValidationInput,
  eventFechaIso: string = DEFAULT_EVENT_ISO,
  todayYmd: string = new Date().toISOString().slice(0, 10)
): RegistrationValidationErrors {
  const errors: RegistrationValidationErrors = {};
  const cutoffs = deriveAgeCutoffs(eventFechaIso);
  const namePattern = PARTICIPANT_FULL_NAME_REGEX;

  const cleanPaterno = input.paterno.trim().replace(/\s+/g, ' ');
  const cleanMaterno = input.materno.trim().replace(/\s+/g, ' ');
  const cleanNombre = input.nombre.trim().replace(/\s+/g, ' ');
  const { privateName: combined, publicName } = buildParticipantNames({
    paterno: cleanPaterno,
    materno: cleanMaterno,
    nombre: cleanNombre,
  });

  if (!cleanNombre || !cleanPaterno) {
    errors.nombre =
      'Esta pregunta es obligatoria. Por favor ingresa al menos apellido paterno y nombre.';
  } else if (cleanPaterno.length < 2 || cleanNombre.length < 2) {
    errors.nombre = 'Nombre y apellido paterno deben tener al menos 2 caracteres cada uno.';
  } else if (!namePattern.test(combined) || !namePattern.test(publicName)) {
    errors.nombre = 'El nombre solo debe contener letras, espacios, apóstrofos, guiones o puntos.';
  } else if (combined.length > 150) {
    errors.nombre = 'El nombre completo no debe exceder 150 caracteres.';
  }

  let calculatedAge: number | null = null;
  if (!input.fechaNacimiento) {
    errors.fechaNacimiento = 'Esta pregunta es obligatoria.';
  } else if (!ISO_DATE_REGEX.test(input.fechaNacimiento) || input.fechaNacimiento > todayYmd) {
    errors.fechaNacimiento = 'La fecha de nacimiento no puede ser futura ni tener formato inválido.';
  } else {
    calculatedAge = calculateAgeAtTournament(input.fechaNacimiento, eventFechaIso);
    const birthYear = Number(input.fechaNacimiento.split('-')[0]);
    if (
      calculatedAge === null ||
      calculatedAge < MIN_PARTICIPANT_AGE ||
      calculatedAge > MAX_PARTICIPANT_AGE ||
      birthYear < 1920
    ) {
      errors.fechaNacimiento = `Ingresa una fecha de nacimiento válida (edad entre ${MIN_PARTICIPANT_AGE} y ${MAX_PARTICIPANT_AGE} años al evento).`;
    }
  }

  const cleanWhatsapp = normalizeWhatsappKey(input.whatsapp);
  if (!input.whatsapp.trim()) {
    errors.whatsapp = 'Esta pregunta es obligatoria.';
  } else if (!PHONE_10_REGEX.test(cleanWhatsapp) || /^0+$/.test(cleanWhatsapp)) {
    errors.whatsapp =
      'El número de WhatsApp debe tener exactamente 10 dígitos válidos (ej. 6181234567).';
  }

  const cleanEmail = normalizeEmailKey(input.correo);
  if (!cleanEmail) {
    errors.correo = 'Esta pregunta es obligatoria.';
  } else if (cleanEmail.length > 100 || !EMAIL_REGEX.test(cleanEmail)) {
    errors.correo = 'Ingresa un correo electrónico con formato válido (ej. usuario@gmail.com).';
  }

  if (!input.categoria) {
    errors.categoria = 'Esta pregunta es obligatoria.';
  } else if (calculatedAge !== null && input.categoria === 'Juvenil' && calculatedAge > JUVENIL_MAX_AGE) {
    errors.categoria = `Incoherencia de edad: Para la categoría Juvenil debes tener ${JUVENIL_MAX_AGE} años o menos cumplidos al ${cutoffs.eventDateSpanish} (edad calculada: ${calculatedAge} años). Tu categoría oficial es Libre.`;
  }

  const requireReceipt = input.requireReceipt !== false;
  if (requireReceipt && !input.hasReceipt) {
    errors.recibo =
      'Es obligatorio subir la foto o captura de tu recibo de pago para completar la inscripción.';
  }

  if (!input.aceptoAviso) {
    errors.privacidad =
      'Debes leer y aceptar el Aviso de Privacidad para completar la inscripción.';
  }

  if (calculatedAge !== null && calculatedAge < MINOR_CONSENT_AGE) {
    const tutorClean = (input.nombreTutor || '').trim().replace(/\s+/g, ' ');
    if (!input.consentimientoTutor || tutorClean.length < 3 || !namePattern.test(tutorClean)) {
      errors.tutor =
        'Para menores de 18 años es obligatorio indicar el nombre válido y autorización de la madre, padre o tutor.';
    }
  }

  return errors;
}

export function validateReceiptFileMeta(mimeType: string, fileSize: number): string | null {
  if (!ALLOWED_RECEIPT_MIME_TYPES.includes(mimeType as (typeof ALLOWED_RECEIPT_MIME_TYPES)[number])) {
    return 'Formato no permitido. Sube una foto JPG, PNG, WEBP o archivo PDF de tu comprobante.';
  }
  if (fileSize <= 0) {
    return 'El archivo seleccionado está vacío.';
  }
  if (fileSize > MAX_RAW_RECEIPT_BYTES) {
    return 'El archivo supera los 8 MB permitidos. Intenta con una captura más ligera.';
  }
  return null;
}

export function buildAdminReceiptLink(reciboId: string, origin = ''): string {
  const cleanOrigin = origin.replace(/\/$/, '');
  return `${cleanOrigin}/#admin-recibo=${encodeURIComponent(reciboId)}`;
}

/**
 * Heurística admin para detectar posibles duplicados por correo, WhatsApp o nombre muy similar (Sección 3.7).
 */
export function findPossibleDuplicates(
  participants: Participant[]
): Map<string, string[]> {
  const active = participants.filter((p) => !p.eliminado && p.id);
  const byEmail = new Map<string, string[]>();
  const byPhone = new Map<string, string[]>();
  const byName = new Map<string, string[]>();

  for (const p of active) {
    const id = p.id!;
    const email = normalizeEmailKey(p.correo || '');
    if (email && !email.endsWith('@eliminado.local')) {
      byEmail.set(email, [...(byEmail.get(email) || []), id]);
    }
    const phone = normalizeWhatsappKey(p.whatsapp || '');
    if (phone && !/^0+$/.test(phone)) {
      byPhone.set(phone, [...(byPhone.get(phone) || []), id]);
    }
    const nameKey = normalizePersonName(p.nombre || '');
    if (nameKey && !nameKey.startsWith('participante pavo-')) {
      byName.set(nameKey, [...(byName.get(nameKey) || []), id]);
    }
  }

  const reasons = new Map<string, string[]>();
  const pushReason = (ids: string[], label: string) => {
    if (ids.length < 2) return;
    for (const id of ids) {
      const current = reasons.get(id) || [];
      if (!current.includes(label)) {
        reasons.set(id, [...current, label]);
      }
    }
  };

  for (const ids of byEmail.values()) pushReason(ids, 'Mismo correo');
  for (const ids of byPhone.values()) pushReason(ids, 'Mismo WhatsApp');
  for (const ids of byName.values()) pushReason(ids, 'Nombre coincidente');

  return reasons;
}

export interface AdminExportParticipantRow {
  folio: string;
  nombre: string;
  categoria: string;
  edad: string;
  fechaNacimiento: string;
  aficionado: string;
  femenil: string;
  whatsapp: string;
  correo: string;
  estatusPago: string;
  asistencia: string;
  reciboEstado: string;
  reciboLink?: string;
  fechaRegistro: string;
}

export interface PublicExportParticipantRow {
  folio: string;
  nombre: string;
  categoria: string;
  edad: string;
  aficionado: string;
  femenil: string;
  estatusPago: string;
  fechaRegistro: string;
}

export function buildPublicExportRows(
  participants: PublicParticipant[]
): PublicExportParticipantRow[] {
  return participants.map((p) => ({
    folio: p.folio || 'S/F',
    nombre: p.nombre,
    categoria: normalizeCategory(p.categoria),
    edad: p.edad ? `${p.edad} años` : p.rangoEdad || '-',
    aficionado: p.esAficionado ? 'Sí' : 'No',
    femenil: p.esFemenil ? 'Sí' : 'No',
    estatusPago: p.estatusPago === 'pagado' ? 'Pagado' : 'Pendiente',
    fechaRegistro: p.fechaRegistro
      ? new Date(p.fechaRegistro).toLocaleString('es-MX', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : '-',
  }));
}

export function buildParticipantExportRows(
  participants: Participant[],
  options: { includeAdminReceiptLinks: boolean; origin?: string; eventFechaIso?: string }
): AdminExportParticipantRow[] {
  const fechaIso = options.eventFechaIso || DEFAULT_EVENT_ISO;
  return participants.map((p) => {
    const age = calculateAgeAtTournament(p.fechaNacimiento, fechaIso);
    const hasReceipt = Boolean(p.tieneRecibo || p.reciboId);
    const row: AdminExportParticipantRow = {
      folio: p.folio || 'S/F',
      nombre: options.includeAdminReceiptLinks
        ? p.nombre
        : formatPublicParticipantName(p.nombre),
      categoria: normalizeCategory(p.categoria),
      edad: age !== null ? `${age} años` : '-',
      fechaNacimiento: options.includeAdminReceiptLinks ? p.fechaNacimiento || '-' : '-',
      aficionado: p.esAficionado ? 'Sí' : 'No',
      femenil: p.esFemenil ? 'Sí' : 'No',
      whatsapp: options.includeAdminReceiptLinks ? p.whatsapp : '',
      correo: options.includeAdminReceiptLinks ? p.correo : '',
      estatusPago: p.estatusPago === 'pagado' ? 'Pagado' : 'Pendiente',
      asistencia: p.asistencia ? 'Presente' : 'Pendiente',
      reciboEstado: options.includeAdminReceiptLinks
        ? hasReceipt
          ? 'Adjunto'
          : 'Sin recibo'
        : '-',
      fechaRegistro: p.fechaRegistro
        ? new Date(p.fechaRegistro).toLocaleString('es-MX', {
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : '-',
    };

    if (options.includeAdminReceiptLinks) {
      row.reciboLink = p.reciboId
        ? buildAdminReceiptLink(p.reciboId, options.origin || '')
        : 'Sin comprobante';
    }

    return row;
  });
}

/**
 * Construye filas compatibles con software de emparejamiento suizo (Swiss-Manager / Vega / Tornelo).
 */
export function buildSwissPairingRows(participants: Participant[]): Array<{
  num: number;
  name: string;
  fed: string;
  sex: string;
  birthYear: string;
  category: TournamentCategory;
  folio: string;
  paid: string;
}> {
  return participants
    .filter((p) => !p.eliminado)
    .map((p, idx) => ({
      num: idx + 1,
      name: p.nombre.trim(),
      fed: 'MEX',
      sex: p.esFemenil ? 'F' : '',
      birthYear: (p.fechaNacimiento || '').slice(0, 4),
      category: normalizeCategory(p.categoria),
      folio: p.folio || '',
      paid: p.estatusPago === 'pagado' ? 'SI' : 'NO',
    }));
}

export interface TournamentExportSummary {
  totalInscritos: number;
  cupoMaximo: number;
  lugaresDisponibles: number;
  totalPagados: number;
  totalPendientes: number;
  totalConRecibo: number;
  totalAsistencias: number;
  totalJuvenil: number;
  totalLibre: number;
  totalAficionados: number;
  totalFemenil: number;
  recaudacionConfirmada: number;
  recaudacionEsperada: number;
}

export function buildTournamentExportSummary(
  participants: Array<Participant | PublicParticipant>,
  config: Pick<TournamentConfig, 'costo' | 'cupoMaximo'>
): TournamentExportSummary {
  const active = participants.filter((p) => !('eliminado' in p && p.eliminado));
  const totalInscritos = active.length;
  const totalPagados = active.filter((p) => p.estatusPago === 'pagado').length;
  const totalPendientes = totalInscritos - totalPagados;
  const totalConRecibo = active.filter(
    (p) => 'tieneRecibo' in p && Boolean(p.tieneRecibo || p.reciboId)
  ).length;
  const totalAsistencias = active.filter(
    (p) => 'asistencia' in p && Boolean(p.asistencia)
  ).length;
  const totalJuvenil = active.filter(
    (p) => normalizeCategory(p.categoria) === 'Juvenil'
  ).length;
  const totalLibre = active.filter(
    (p) => normalizeCategory(p.categoria) === 'Libre'
  ).length;
  const totalAficionados = active.filter(
    (p) =>
      p.esAficionado ||
      p.categoria === 'Aficionados' ||
      p.categoria === 'Libre - Aficionados'
  ).length;
  const totalFemenil = active.filter((p) => p.esFemenil).length;
  const costo = Number(config.costo) || 0;

  return {
    totalInscritos,
    cupoMaximo: config.cupoMaximo,
    lugaresDisponibles: Math.max(0, config.cupoMaximo - totalInscritos),
    totalPagados,
    totalPendientes,
    totalConRecibo,
    totalAsistencias,
    totalJuvenil,
    totalLibre,
    totalAficionados,
    totalFemenil,
    recaudacionConfirmada: totalPagados * costo,
    recaudacionEsperada: totalInscritos * costo,
  };
}
