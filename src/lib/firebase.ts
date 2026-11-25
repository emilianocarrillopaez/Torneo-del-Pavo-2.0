import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, AppCheck } from 'firebase/app-check';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import prodConfig from '../../firebase-applet-config.json';

const appEnv = (import.meta.env.VITE_APP_ENV || 'production').trim();
const useEmulator = import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true';

function resolveFirebaseConfig() {
  if (appEnv === 'staging') {
    const stagingProjectId = import.meta.env.VITE_FIREBASE_STAGING_PROJECT_ID?.trim();
    const stagingApiKey = import.meta.env.VITE_FIREBASE_STAGING_API_KEY?.trim();
    const stagingAuthDomain = import.meta.env.VITE_FIREBASE_STAGING_AUTH_DOMAIN?.trim();
    const stagingAppId = import.meta.env.VITE_FIREBASE_STAGING_APP_ID?.trim();

    if (stagingProjectId && stagingApiKey && stagingAuthDomain && stagingAppId) {
      return {
        projectId: stagingProjectId,
        apiKey: stagingApiKey,
        authDomain: stagingAuthDomain,
        appId: stagingAppId,
        messagingSenderId:
          import.meta.env.VITE_FIREBASE_STAGING_MESSAGING_SENDER_ID?.trim() || '',
        storageBucket:
          import.meta.env.VITE_FIREBASE_STAGING_STORAGE_BUCKET?.trim() ||
          `${stagingProjectId}.firebasestorage.app`,
        firestoreDatabaseId:
          import.meta.env.VITE_FIREBASE_STAGING_DATABASE_ID?.trim() || '(default)',
        recaptchaSiteKey:
          import.meta.env.VITE_FIREBASE_STAGING_RECAPTCHA_SITE_KEY?.trim() || '',
      };
    }

    if (import.meta.env.DEV) {
      console.warn(
        'VITE_APP_ENV=staging sin credenciales staging completas; se usará el emulador o la configuración base según corresponda.'
      );
    }
  }

  return prodConfig;
}

const activeConfig = resolveFirebaseConfig();
const app = initializeApp(activeConfig);

export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  useEmulator ? '(default)' : activeConfig.firestoreDatabaseId
);

export const auth = getAuth(app);

if (useEmulator && typeof window !== 'undefined') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

// Inicializar Firebase App Check si existe clave de sitio reCAPTCHA configurada y no estamos en emulador local
let appCheckInstance: AppCheck | null = null;
const configuredSiteKey =
  (activeConfig as { recaptchaSiteKey?: string }).recaptchaSiteKey?.trim() ||
  import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() ||
  '';

if (!useEmulator && typeof window !== 'undefined' && configuredSiteKey) {
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(configuredSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    if (import.meta.env.DEV) {
      console.warn('No se pudo inicializar Firebase App Check en este entorno.');
    }
  }
} else if (!useEmulator && import.meta.env.DEV) {
  console.info(
    'App Check en espera: configura recaptchaSiteKey en firebase-applet-config.json o VITE_RECAPTCHA_SITE_KEY para activar enforcement.'
  );
}

export { appCheckInstance, appEnv };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export class AppFirestoreError extends Error {
  code: string;

  constructor(message: string, code = 'unknown') {
    super(message);
    this.name = 'AppFirestoreError';
    this.code = code;
  }
}

export function mapFirestoreErrorToSpanish(error: unknown): { code: string; message: string } {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || 'unknown')
      : 'unknown';

  switch (code) {
    case 'permission-denied':
      return {
        code,
        message:
          'No fue posible completar la operación. Verifica tus datos o permisos e intenta nuevamente.',
      };
    case 'already-exists':
      return {
        code,
        message: 'Ya existe un registro previo con esos datos.',
      };
    case 'resource-exhausted':
      return {
        code,
        message: 'Estamos recibiendo muchas solicitudes en este momento. Intenta en unos minutos.',
      };
    case 'unavailable':
    case 'deadline-exceeded':
      return {
        code,
        message:
          'No pudimos conectarnos con el servidor en este momento. Revisa tu conexión e intenta de nuevo.',
      };
    case 'unauthenticated':
      return {
        code,
        message: 'Tu sesión no está autenticada o expiró. Inicia sesión nuevamente.',
      };
    case 'failed-precondition':
      return {
        code,
        message: 'La operación requiere una condición previa que no se cumplió. Recarga la página.',
      };
    default:
      return {
        code,
        message: 'Ocurrió un inconveniente al procesar tu solicitud. Intenta de nuevo en unos momentos.',
      };
  }
}

/**
 * Maneja errores de Firestore sin exponer UID, correo, proveedor ni rutas internas.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  _path: string | null
): never {
  const mapped = mapFirestoreErrorToSpanish(error);

  if (import.meta.env.DEV) {
    console.warn(`[Firestore:${operationType}] code=${mapped.code}`);
  }

  throw new AppFirestoreError(mapped.message, mapped.code);
}

// Comprobación inicial de conectividad contra /test/connection
export async function testConnection() {
  try {
    const testPromise = getDocFromServer(doc(db, 'test', 'connection'));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timeout')), 3000)
    );
    await Promise.race([testPromise, timeoutPromise]);
  } catch {
    // Silencioso en producción para no saturar la consola del navegador
  }
}
