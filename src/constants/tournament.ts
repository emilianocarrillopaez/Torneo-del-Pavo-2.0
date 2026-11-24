export const COLLECTIONS = {
  PARTICIPANTS: 'participantes',
  PUBLIC_PARTICIPANTS: 'participantes_publicos',
  WAITLIST: 'lista_espera',
  REGISTRATION_KEYS: 'registro_llaves',
  RECEIPTS: 'comprobantes',
  CONFIG: 'configuracion',
  SPONSORS: 'patrocinadores',
  ADMINS: 'admins',
  ADMINS_BY_EMAIL: 'admins_by_email',
  TEST: 'test',
} as const;

export const CONFIG_DOC_ID = 'general';

export const PRIVACY_NOTICE_VERSION = '2026-11-v1';

/**
 * Cambia a `false` si el comité organizador decide mostrar nombres completos en el padrón público.
 * Con `true`, se almacena el nombre abreviado en `/participantes_publicos` para mayor privacidad.
 */
export const MASK_PUBLIC_LAST_NAMES = true;

export const DEFAULT_EVENT_ISO = '2026-12-19T16:30:00-06:00';
export const DEFAULT_DEADLINE_ISO = '2026-12-19T15:30:00-06:00';

export const ALLOWED_RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_RAW_RECEIPT_BYTES = 8 * 1024 * 1024; // 8 MB antes de comprimir
export const MAX_FIRESTORE_DATA_URL_LENGTH = 850_000;

export const MIN_PARTICIPANT_AGE = 3;
export const MAX_PARTICIPANT_AGE = 100;
export const JUVENIL_MAX_AGE = 18;
export const MINOR_CONSENT_AGE = 18;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_10_REGEX = /^[0-9]{10}$/;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const CLABE_18_REGEX = /^[0-9]{18}$/;

export const PLACEHOLDER_PAYMENT_VALUES = {
  CLABE: '000000000000000000',
  BANCO: 'Configurar en Panel Admin',
  TITULAR: 'Comité Organizador (Configurar en Panel Admin)',
  WHATSAPP: '0000000000',
} as const;

export const SESSION_DRAFT_STORAGE_KEY = 'torneo_pavo_form_draft_v1';

// Límites conservadores para operaciones administrativas en lote (reglas Firestore <= 20 accesos/solicitud)
export const SAFE_ADMIN_BATCH_SIZE = 10; // 1 escritura por registro (sync padrón, limpieza espera)
export const SAFE_ADMIN_PAIR_BATCH_SIZE = 8; // 2 escrituras por registro (pagos, purga recibos)
export const SAFE_ADMIN_MULTI_OP_BATCH_SIZE = 4; // hasta 5 escrituras por registro (anonimización)

// Optimización de lecturas en padrón público (Spark free tier)
export const PUBLIC_ROSTER_QUERY_LIMIT = 500;
export const PUBLIC_ROSTER_CACHE_TTL_MS = 60_000;
export const WAITLIST_PURGE_DAYS = 30;

