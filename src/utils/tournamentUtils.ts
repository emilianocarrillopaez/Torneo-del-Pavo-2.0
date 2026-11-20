import { Participant, TournamentCategory, TournamentConfig } from '../types/tournament';

export interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isStarted: boolean;
}

/**
 * Pure countdown computation to a target ISO date string.
 */
export function computeCountdown(targetIso: string, nowMs: number = Date.now()): CountdownState {
  const parsed = Date.parse(targetIso || '2026-12-19T16:30:00-06:00');
  const targetMs = Number.isNaN(parsed) ? Date.parse('2026-12-19T16:30:00-06:00') : parsed;
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
 * Calculates participant age at the tournament day (default 2026-12-19).
 */
export function calculateAgeAtTournament(
  birthdateStr: string,
  eventYear = 2026,
  eventMonthIndex = 11,
  eventDay = 19
): number | null {
  if (!birthdateStr) return null;
  const parts = birthdateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [birthYear, birthMonth, birthDay] = parts;
  if (birthYear < 1900 || birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
    return null;
  }

  let age = eventYear - birthYear;
  const targetMonth = eventMonthIndex + 1;
  if (targetMonth < birthMonth || (targetMonth === birthMonth && eventDay < birthDay)) {
    age--;
  }
  return age;
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
}

export interface RegistrationValidationErrors {
  nombre?: string;
  fechaNacimiento?: string;
  whatsapp?: string;
  correo?: string;
  categoria?: string;
  recibo?: string;
  general?: string;
}

/**
 * Pure registration validator enforcing all mandatory fields including payment receipt.
 */
export function validateRegistrationInput(
  input: RegistrationValidationInput
): RegistrationValidationErrors {
  const errors: RegistrationValidationErrors = {};

  if (!input.nombre.trim() || !input.paterno.trim()) {
    errors.nombre =
      'Esta pregunta es obligatoria. Por favor ingresa al menos apellido paterno y nombre.';
  }

  if (!input.fechaNacimiento) {
    errors.fechaNacimiento = 'Esta pregunta es obligatoria.';
  } else {
    const age = calculateAgeAtTournament(input.fechaNacimiento);
    const birthYear = Number(input.fechaNacimiento.split('-')[0]);
    if (age === null || age < 3 || birthYear < 1920) {
      errors.fechaNacimiento = 'Ingresa una fecha de nacimiento válida.';
    }
  }

  const cleanWhatsapp = input.whatsapp.replace(/\D/g, '');
  if (!input.whatsapp.trim()) {
    errors.whatsapp = 'Esta pregunta es obligatoria.';
  } else if (cleanWhatsapp.length !== 10) {
    errors.whatsapp =
      'El número de WhatsApp debe tener exactamente 10 dígitos (ej. 6181234567).';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.correo.trim()) {
    errors.correo = 'Esta pregunta es obligatoria.';
  } else if (!emailRegex.test(input.correo.trim())) {
    errors.correo = 'Ingresa un correo electrónico con formato válido (ej. usuario@gmail.com).';
  }

  if (!input.categoria) {
    errors.categoria = 'Esta pregunta es obligatoria.';
  } else if (input.fechaNacimiento) {
    const age = calculateAgeAtTournament(input.fechaNacimiento);
    if (age !== null && input.categoria === 'Juvenil' && age > 18) {
      errors.categoria = `Incoherencia de edad: Para la categoría Juvenil debes tener 18 años o menos cumplidos al 19 de diciembre de 2026 (tu edad calculada es de ${age} años). Tu categoría oficial es Libre (ranqueados y aficionados).`;
    }
  }

  if (!input.hasReceipt) {
    errors.recibo =
      'Es obligatorio subir la foto o captura de tu recibo de pago para completar la inscripción.';
  }

  return errors;
}

export const ALLOWED_RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_RAW_RECEIPT_BYTES = 8 * 1024 * 1024; // 8 MB raw file input

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

export interface ExportParticipantRow {
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
  reciboEstado: string;
  reciboLink?: string;
  fechaRegistro: string;
}

export function buildParticipantExportRows(
  participants: Participant[],
  options: { includeAdminReceiptLinks: boolean; origin?: string }
): ExportParticipantRow[] {
  return participants.map((p) => {
    const age = calculateAgeAtTournament(p.fechaNacimiento);
    const hasReceipt = Boolean(p.tieneRecibo || p.reciboId);
    const row: ExportParticipantRow = {
      folio: p.folio || 'S/F',
      nombre: p.nombre,
      categoria: p.categoria,
      edad: age !== null ? `${age} años` : '-',
      fechaNacimiento: p.fechaNacimiento || '-',
      aficionado: p.esAficionado ? 'Sí' : 'No',
      femenil: p.esFemenil ? 'Sí' : 'No',
      whatsapp: p.whatsapp,
      correo: p.correo,
      estatusPago: p.estatusPago === 'pagado' ? 'Pagado' : 'Pendiente',
      reciboEstado: hasReceipt ? 'Adjunto' : 'Sin recibo',
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

export interface TournamentExportSummary {
  totalInscritos: number;
  cupoMaximo: number;
  lugaresDisponibles: number;
  totalPagados: number;
  totalPendientes: number;
  totalConRecibo: number;
  totalJuvenil: number;
  totalLibre: number;
  totalAficionados: number;
  totalFemenil: number;
  recaudacionConfirmada: number;
  recaudacionEsperada: number;
}

export function buildTournamentExportSummary(
  participants: Participant[],
  config: Pick<TournamentConfig, 'costo' | 'cupoMaximo'>
): TournamentExportSummary {
  const totalInscritos = participants.length;
  const totalPagados = participants.filter((p) => p.estatusPago === 'pagado').length;
  const totalPendientes = totalInscritos - totalPagados;
  const totalConRecibo = participants.filter((p) => p.tieneRecibo || p.reciboId).length;
  const totalJuvenil = participants.filter(
    (p) => p.categoria === 'Juvenil' || p.categoria === 'Niños'
  ).length;
  const totalLibre = participants.filter(
    (p) =>
      p.categoria === 'Libre' ||
      p.categoria.startsWith('Libre') ||
      p.categoria === 'Aficionados' ||
      p.categoria === 'Rankeado'
  ).length;
  const totalAficionados = participants.filter(
    (p) => p.esAficionado || p.categoria === 'Aficionados' || p.categoria === 'Libre - Aficionados'
  ).length;
  const totalFemenil = participants.filter((p) => p.esFemenil).length;
  const costo = Number(config.costo) || 0;

  return {
    totalInscritos,
    cupoMaximo: config.cupoMaximo,
    lugaresDisponibles: Math.max(0, config.cupoMaximo - totalInscritos),
    totalPagados,
    totalPendientes,
    totalConRecibo,
    totalJuvenil,
    totalLibre,
    totalAficionados,
    totalFemenil,
    recaudacionConfirmada: totalPagados * costo,
    recaudacionEsperada: totalInscritos * costo,
  };
}
