import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateHeadersFileContent } from './security-headers.mjs';
import { resolveSiteUrl } from './site-config.mjs';

export { resolveSiteUrl };

const FORBIDDEN_PUBLIC_DIR_NAMES = new Set(['aistudio', 'docs']);
const FORBIDDEN_PUBLIC_EXTENSIONS = new Set(['.md', '.log']);

export function assertNoForbiddenPublicFiles(publicDir) {
  if (!fs.existsSync(publicDir)) return;

  const offenders = [];

  function walk(dir, relPrefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (FORBIDDEN_PUBLIC_DIR_NAMES.has(entry.name.toLowerCase())) {
          offenders.push(`carpeta prohibida "public/${relPath}/"`);
          continue;
        }
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (FORBIDDEN_PUBLIC_EXTENSIONS.has(ext)) {
          offenders.push(`archivo prohibido "public/${relPath}"`);
        } else if (ext === '.txt' && relPath !== 'robots.txt') {
          offenders.push(`archivo .txt no permitido "public/${relPath}" (solo robots.txt)`);
        }
      }
    }
  }

  walk(publicDir);

  if (offenders.length > 0) {
    throw new Error(
      `❌ Archivos o carpetas internas detectadas dentro de public/: ${offenders.join(', ')}. Elimínalos antes de compilar para no publicarlos en dist/.`
    );
  }
}

export function generateSeoAndHeaderFiles({ strict = true, publicDir: customPublicDir = '' } = {}) {
  const publicDir = customPublicDir || path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Bloquear archivos o carpetas internas dentro de public/ antes de generar dist/
  assertNoForbiddenPublicFiles(publicDir);

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
  // Nota de privacidad: /participantes no lleva Allow ni Disallow para que los buscadores lean
  // la cabecera HTTP X-Robots-Tag: noindex, nofollow sin quedar bloqueados en robots.txt.
  const robotsContent = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsContent, 'utf8');

  // 3. Generar public/sitemap.xml desde VITE_SITE_URL (solo la portada pública)
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.com/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
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
