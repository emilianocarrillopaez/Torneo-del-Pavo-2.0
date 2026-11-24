import fs from 'node:fs';
import path from 'node:path';

export const CLOUDFLARE_MAX_LINE_LENGTH = 2000;
export const CLOUDFLARE_MAX_HEADER_RULES = 100;

function readAuthDomain() {
  const fromEnv = (process.env.VITE_FIREBASE_STAGING_AUTH_DOMAIN || '').trim();
  const isStaging = (process.env.VITE_APP_ENV || '').trim() === 'staging';
  if (isStaging && fromEnv) {
    return fromEnv;
  }
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.authDomain === 'string' && parsed.authDomain.trim()) {
      return parsed.authDomain.trim();
    }
  } catch {
    // Fallback seguro si no existe el archivo en entorno aislado
  }
  return 'yogic-decoder-5lxdt.firebaseapp.com';
}

export function buildCspDirectives({
  upgradeInsecureRequests = true,
  includeFrameAncestors = true,
  allowLocalEmulators = false,
} = {}) {
  const authDomain = readAuthDomain();
  const localConnect = allowLocalEmulators
    ? ' http://127.0.0.1:8080 http://localhost:8080 http://127.0.0.1:9099 http://localhost:9099'
    : '';
  const localFrame = allowLocalEmulators ? ' http://127.0.0.1:9099 http://localhost:9099' : '';

  const directives = [
    "default-src 'self'",
    "script-src 'self' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseappcheck.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.googleapis.com https://www.google.com${localConnect}`,
    `frame-src 'self' blob: https://accounts.google.com https://${authDomain} https://www.google.com https://recaptcha.google.com${localFrame}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  if (includeFrameAncestors) {
    directives.push("frame-ancestors 'none'");
  }
  if (upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

export function getProductionSecurityHeaders() {
  return {
    'Content-Security-Policy': buildCspDirectives({
      upgradeInsecureRequests: true,
      includeFrameAncestors: true,
      allowLocalEmulators: false,
    }),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

export function getPreviewHeaders({ allowLocalEmulators = false } = {}) {
  return {
    'Content-Security-Policy': buildCspDirectives({
      upgradeInsecureRequests: false,
      includeFrameAncestors: true,
      allowLocalEmulators,
    }),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
}

export function generateHeadersFileContent() {
  const sec = getProductionSecurityHeaders();
  const blocks = [
    [
      '/*',
      ...Object.entries(sec).map(([k, v]) => `  ${k}: ${v}`),
    ].join('\n'),
    [
      '/assets/*',
      '  Cache-Control: public, max-age=31536000, immutable',
    ].join('\n'),
    [
      '/index.html',
      '  Cache-Control: no-cache',
    ].join('\n'),
    [
      '/favicon.png',
      '  Cache-Control: public, max-age=604800',
    ].join('\n'),
    [
      '/apple-touch-icon.png',
      '  Cache-Control: public, max-age=604800',
    ].join('\n'),
    [
      '/icon-192.png',
      '  Cache-Control: public, max-age=604800',
    ].join('\n'),
    [
      '/icon-512.png',
      '  Cache-Control: public, max-age=604800',
    ].join('\n'),
    [
      '/admin',
      '  X-Robots-Tag: noindex, nofollow',
    ].join('\n'),
    [
      '/admin/*',
      '  X-Robots-Tag: noindex, nofollow',
    ].join('\n'),
  ];

  const content = `${blocks.join('\n\n')}\n`;
  assertCloudflareHeaderLimits(content);
  return content;
}

export function assertCloudflareHeaderLimits(content) {
  const lines = content.split('\n');
  let ruleCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > CLOUDFLARE_MAX_LINE_LENGTH) {
      throw new Error(
        `La línea ${i + 1} de _headers (${line.length} caracteres) excede el límite de ${CLOUDFLARE_MAX_LINE_LENGTH} caracteres de Cloudflare Pages.`
      );
    }
    if (/^\s*Cross-Origin-Opener-Policy\s*:\s*same-origin/i.test(line)) {
      throw new Error(
        'Prohibido usar Cross-Origin-Opener-Policy: same-origin porque rompe el popup de Google Sign-In.'
      );
    }
    if (/^\s+[^#\s][^:]*:/.test(line)) {
      ruleCount++;
    }
  }

  if (ruleCount > CLOUDFLARE_MAX_HEADER_RULES) {
    throw new Error(
      `El archivo _headers contiene ${ruleCount} reglas y excede el máximo de ${CLOUDFLARE_MAX_HEADER_RULES} permitido por Cloudflare Pages.`
    );
  }

  return { lineCount: lines.length, ruleCount, maxLineLength: Math.max(...lines.map((l) => l.length)) };
}
