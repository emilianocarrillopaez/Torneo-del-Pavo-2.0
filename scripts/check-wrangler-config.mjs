import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_WORKER_NAME = 'torneo-del-pavo-2-0';
export const EXPECTED_ASSETS_DIRECTORY = './dist';
export const EXPECTED_NOT_FOUND_HANDLING = 'single-page-application';

/**
 * Elimina comentarios // y /* ... * / y comas finales de JSONC respetando cadenas de texto.
 */
export function stripJsonComments(input) {
  let out = '';
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (ch === '\n' || ch === '\r') {
        inLineComment = false;
        out += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    out += ch;
  }

  // Eliminar comas colgantes antes de } o ]
  return out.replace(/,\s*([}\]])/g, '$1');
}

export function validateWranglerConfig(rootDir = process.cwd()) {
  const wranglerPath = path.join(rootDir, 'wrangler.jsonc');
  if (!fs.existsSync(wranglerPath)) {
    throw new Error(
      '❌ Falta wrangler.jsonc en la raíz del repositorio. Cloudflare Workers lo necesita para publicar ./dist como SPA.'
    );
  }

  let parsed;
  try {
    const raw = fs.readFileSync(wranglerPath, 'utf8');
    parsed = JSON.parse(stripJsonComments(raw));
  } catch (err) {
    throw new Error(
      `❌ No se pudo interpretar wrangler.jsonc como JSON/JSONC válido: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('❌ wrangler.jsonc debe contener un objeto JSON en la raíz.');
  }

  if ('main' in parsed && parsed.main !== undefined) {
    throw new Error(
      '❌ wrangler.jsonc no debe definir "main": este sitio es exclusivamente estático (Static Assets).'
    );
  }

  if (parsed.name !== EXPECTED_WORKER_NAME) {
    throw new Error(
      `❌ El campo "name" en wrangler.jsonc debe ser exactamente "${EXPECTED_WORKER_NAME}" (actual: "${String(parsed.name ?? '')}").`
    );
  }

  const assets = parsed.assets;
  if (!assets || typeof assets !== 'object' || Array.isArray(assets)) {
    throw new Error('❌ Falta la sección "assets" en wrangler.jsonc.');
  }

  if (assets.directory !== EXPECTED_ASSETS_DIRECTORY) {
    throw new Error(
      `❌ "assets.directory" en wrangler.jsonc debe ser "${EXPECTED_ASSETS_DIRECTORY}" (actual: "${String(assets.directory ?? '')}").`
    );
  }

  if (assets.not_found_handling !== EXPECTED_NOT_FOUND_HANDLING) {
    throw new Error(
      `❌ "assets.not_found_handling" en wrangler.jsonc debe ser "${EXPECTED_NOT_FOUND_HANDLING}" (actual: "${String(assets.not_found_handling ?? '')}").`
    );
  }

  const forbiddenDist404 = path.join(rootDir, 'dist', '404.html');
  if (fs.existsSync(forbiddenDist404)) {
    throw new Error(
      '❌ No debe existir dist/404.html porque interfiere con not_found_handling: "single-page-application" en Cloudflare Workers.'
    );
  }

  return parsed;
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  const config = validateWranglerConfig(process.cwd());
  console.log(
    `✅ Configuración Wrangler válida (name=${config.name}, assets.directory=${config.assets.directory}, not_found_handling=${config.assets.not_found_handling})`
  );
}
