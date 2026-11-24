/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_APP_ENV?: 'production' | 'staging';
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_USE_FIRESTORE_EMULATOR?: string;
  readonly VITE_FIREBASE_STAGING_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STAGING_API_KEY?: string;
  readonly VITE_FIREBASE_STAGING_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_STAGING_APP_ID?: string;
  readonly VITE_FIREBASE_STAGING_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_STAGING_DATABASE_ID?: string;
  readonly VITE_FIREBASE_STAGING_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_STAGING_RECAPTCHA_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
