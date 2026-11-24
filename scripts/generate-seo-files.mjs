import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateHeadersFileContent } from './security-headers.mjs';

function readEnvFileVar(key) {
  const candidates = ['.env.local', '.env.production', '.env'];
  for (const filename of candidates) {
    const filePath = path.resolve(process.cwd(), filename);
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

export function resolveSiteUrl({ strict = true } = {}) {
  const explicit = process.env.VITE_SITE_URL;
  const fromEnvFile = explicit === undefined ? readEnvFileVar('VITE_SITE_URL') : undefined;
  const raw = (explicit ?? fromEnvFile ?? '').trim();

  const isStrictEnv =
    strict &&
    (explicit === '' ||
      process.env.CI === 'true' ||
      process.env.CF_PAGES === '1' ||
      process.env.STRICT_SITE_URL === '1' ||
      !process.env.APPLET_ID);

  if (!raw) {
    if (isStrictEnv) {
      throw new Error(
        '❌ Error de compilación: VITE_SITE_URL no está definida. Configúrala en Cloudflare Pages / GitHub Actions / .env (ej. VITE_SITE_URL=https://torneo-del-pavo.pages.dev) antes de compilar producción.'
      );
    }
    const sandboxFallback = 'https://torneo-del-pavo.pages.dev';
    console.warn(
      `⚠️  [sandbox] VITE_SITE_URL no definida; usando respaldo temporal ${sandboxFallback} solo para validación local.`
    );
    return sandboxFallback;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `❌ Error de compilación: VITE_SITE_URL ("${raw}") no es una URL válida (debe iniciar con https://).`
    );
  }

  const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !isLocalhost) {
    throw new Error(
      `❌ Error de compilación: VITE_SITE_URL ("${raw}") debe usar protocolo https:// en producción.`
    );
  }

  return raw.replace(/\/+$/, '');
}

export function generateSeoAndHeaderFiles({ strict = true } = {}) {
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Verificar restricción SPA de Cloudflare Pages (5.3.1-3)
  const forbidden404 = path.join(publicDir, '404.html');
  if (fs.existsSync(forbidden404)) {
    throw new Error(
      '❌ No debe existir public/404.html porque desactiva el fallback SPA de Cloudflare Pages.'
    );
  }
  const redirectsPath = path.join(publicDir, '_redirects');
  if (fs.existsSync(redirectsPath)) {
    const redirectsText = fs.readFileSync(redirectsPath, 'utf8');
    if (/^\s*\/\*\s+\/index\.html\s+200\b/m.test(redirectsText)) {
      throw new Error(
        '❌ No añadas la regla genérica `/* /index.html 200` en public/_redirects; Cloudflare Pages ya resuelve rutas SPA si no hay 404.html.'
      );
    }
  }

  const siteUrl = resolveSiteUrl({ strict });

  // 1. Generar public/_headers desde la única fuente de verdad
  const headersContent = generateHeadersFileContent();
  fs.writeFileSync(path.join(publicDir, '_headers'), headersContent, 'utf8');

  // 2. Generar public/robots.txt desde VITE_SITE_URL
  const robotsContent = [
    'User-agent: *',
    'Allow: /',
    'Allow: /participantes',
    'Disallow: /admin',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsContent, 'utf8');

  // 3. Generar public/sitemap.xml desde VITE_SITE_URL
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.com/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/participantes</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
`;
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapContent, 'utf8');

  return { siteUrl };
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  const { siteUrl } = generateSeoAndHeaderFiles({ strict: true });
  console.log(`✅ SEO y cabeceras generados para ${siteUrl} (public/_headers, robots.txt, sitemap.xml)`);
}
