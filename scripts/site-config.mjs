import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const DEFAULT_SITE_CONFIG_PATH = path.resolve(process.cwd(), 'site.config.json');

function readEnvFileVar(key, cwd = process.cwd()) {
  const candidates = ['.env.local', '.env.production', '.env'];
  for (const filename of candidates) {
    const filePath = path.resolve(cwd, filename);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const k = trimmed.slice(0, eqIdx).trim();
      if (k !== key) continue;
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  return undefined;
}

/**
 * @param {string} [configPath]
 * @returns {string | undefined}
 */
export function readSiteConfigUrl(configPath = DEFAULT_SITE_CONFIG_PATH) {
  if (!configPath || !fs.existsSync(configPath)) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(
      `❌ Error de configuración: "${path.basename(configPath)}" no contiene JSON válido.`,
      { cause: err }
    );
  }
  return typeof parsed?.siteUrl === 'string' ? parsed.siteUrl : undefined;
}

/**
 * Valida la URL canónica del sitio.
 * En modo estricto debe iniciar con https://, no terminar en "/" y no contener
 * valores de marcador o heredados (PEGA_AQUI, example, localhost, torneo-del-pavo.pages.dev).
 * @param {string} rawUrl
 * @param {{ strict?: boolean }} [options]
 * @returns {{ valid: boolean; url: string; reason?: string }}
 */
export function validateSiteUrl(rawUrl, { strict = true } = {}) {
  const value = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!value) {
    return { valid: false, url: '', reason: 'está vacía' };
  }
  if (/\/$/.test(value)) {
    return { valid: false, url: '', reason: 'no debe terminar con barra final (/)' };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { valid: false, url: '', reason: 'no tiene formato de URL válido' };
  }

  const lower = value.toLowerCase();
  const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

  if (strict) {
    if (!value.startsWith('https://') || parsed.protocol !== 'https:') {
      return { valid: false, url: '', reason: 'debe iniciar con https://' };
    }
    if (lower.includes('pega_aqui')) {
      return { valid: false, url: '', reason: 'contiene el marcador PEGA_AQUI' };
    }
    if (lower.includes('example')) {
      return { valid: false, url: '', reason: 'contiene un dominio de ejemplo ("example")' };
    }
    if (lower.includes('localhost') || parsed.hostname === '127.0.0.1') {
      return { valid: false, url: '', reason: 'no puede apuntar a localhost/127.0.0.1 en producción' };
    }
    if (lower.includes('torneo-del-pavo.pages.dev')) {
      return { valid: false, url: '', reason: 'contiene el dominio antiguo torneo-del-pavo.pages.dev' };
    }
  } else {
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalHost)) {
      return { valid: false, url: '', reason: 'debe usar https:// o http://localhost en desarrollo' };
    }
    if (lower.includes('pega_aqui')) {
      return { valid: false, url: '', reason: 'contiene el marcador PEGA_AQUI' };
    }
  }

  return { valid: true, url: value };
}

/**
 * Resuelve la URL pública del sitio siguiendo el orden de prioridad:
 * 1. VITE_SITE_URL del entorno (opcional), si existe y es válida;
 * 2. siteUrl de site.config.json en la raíz;
 * 3. En modo estricto falla con mensaje claro explicando ambas opciones.
 * @param {{
 *   strict?: boolean;
 *   envSiteUrl?: string;
 *   configPath?: string;
 *   allowEnvFiles?: boolean;
 *   env?: NodeJS.ProcessEnv;
 * }} [options]
 */
export function resolveSiteUrl(options = {}) {
  const {
    strict = true,
    envSiteUrl,
    configPath = DEFAULT_SITE_CONFIG_PATH,
    allowEnvFiles = true,
    env = process.env,
  } = options;

  const isEmulatorStaging =
    env?.VITE_USE_FIRESTORE_EMULATOR === 'true' && env?.VITE_APP_ENV === 'staging';
  const isStrictMode = Boolean(strict) && !isEmulatorStaging;

  const hasExplicitArg = Object.prototype.hasOwnProperty.call(options, 'envSiteUrl');
  const rawFromEnv = hasExplicitArg ? envSiteUrl : env?.VITE_SITE_URL;
  const rawEnvOrFile =
    rawFromEnv !== undefined
      ? rawFromEnv
      : allowEnvFiles
        ? readEnvFileVar('VITE_SITE_URL')
        : undefined;
  const trimmedEnv = typeof rawEnvOrFile === 'string' ? rawEnvOrFile.trim() : '';

  if (trimmedEnv) {
    const checkEnv = validateSiteUrl(trimmedEnv, { strict: isStrictMode });
    if (!checkEnv.valid) {
      throw new Error(
        `❌ Error de compilación: VITE_SITE_URL ("${trimmedEnv}") es inválida (${checkEnv.reason}). Debe comenzar con https://, no terminar en "/" y no contener PEGA_AQUI, example, localhost ni torneo-del-pavo.pages.dev.`
      );
    }
    return checkEnv.url;
  }

  const rawFromConfig = readSiteConfigUrl(configPath);
  const trimmedConfig = typeof rawFromConfig === 'string' ? rawFromConfig.trim() : '';
  if (trimmedConfig) {
    const checkConfig = validateSiteUrl(trimmedConfig, { strict: isStrictMode });
    if (!checkConfig.valid) {
      throw new Error(
        `❌ Error de compilación: "siteUrl" en site.config.json ("${trimmedConfig}") es inválida (${checkConfig.reason}). Corrígela para iniciar con https:// y sin barra final.`
      );
    }
    return checkConfig.url;
  }

  const isStrictEnv =
    isStrictMode &&
    (rawFromEnv === '' ||
      strict === true ||
      env?.CI === 'true' ||
      env?.CF_PAGES === '1' ||
      env?.WORKERS_CI === '1' ||
      env?.STRICT_SITE_URL === '1');

  if (isStrictEnv) {
    throw new Error(
      '❌ Error de compilación: No se encontró una URL pública válida. Define "siteUrl" en site.config.json (raíz del repositorio) o configura la variable opcional VITE_SITE_URL (con https:// y sin barra final).'
    );
  }

  const devFallback = 'http://localhost:3000';
  console.warn(
    `⚠️  Ni VITE_SITE_URL ni site.config.json tienen URL definida; usando respaldo local de desarrollo ${devFallback}.`
  );
  return devFallback;
}
