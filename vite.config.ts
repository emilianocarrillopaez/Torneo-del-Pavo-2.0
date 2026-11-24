import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { getPreviewHeaders } from './scripts/security-headers.mjs';
import { resolveSiteUrl } from './scripts/generate-seo-files.mjs';

function siteUrlHtmlPlugin(mode: string): Plugin {
  const siteUrl = resolveSiteUrl({ strict: mode === 'production' });
  return {
    name: 'torneo-site-url-html',
    transformIndexHtml(html) {
      return html.replaceAll('%VITE_SITE_URL%', siteUrl);
    },
  };
}

export default defineConfig(({ mode }) => {
  const allowLocalEmulators = process.env.VITE_USE_FIRESTORE_EMULATOR === 'true';

  return {
    plugins: [react(), tailwindcss(), siteUrlHtmlPlugin(mode)],
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
