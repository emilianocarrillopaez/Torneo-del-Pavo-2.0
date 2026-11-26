import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { getPreviewHeaders } from './scripts/security-headers.mjs';
import { resolveSiteUrl } from './scripts/site-config.mjs';

function siteUrlHtmlPlugin(siteUrl: string): Plugin {
  return {
    name: 'torneo-site-url-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replaceAll('%VITE_SITE_URL%', siteUrl);
      },
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const allowLocalEmulators = process.env.VITE_USE_FIRESTORE_EMULATOR === 'true';
  const strictSiteUrl = command === 'build' && mode === 'production' && !allowLocalEmulators;
  const resolvedSiteUrl = resolveSiteUrl({ strict: strictSiteUrl });
  process.env.VITE_SITE_URL = resolvedSiteUrl;

  return {
    plugins: [react(), tailwindcss(), siteUrlHtmlPlugin(resolvedSiteUrl)],
    define: {
      'import.meta.env.VITE_SITE_URL': JSON.stringify(resolvedSiteUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      headers: getPreviewHeaders({ allowLocalEmulators }),
    },
  };
});
