import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const REPORT_ARTIFACT_PREFIX = 'reportes-';

/**
 * Filtra artefactos antiguos para eliminar ÚNICAMENTE los de este prefijo (`reportes-`)
 * que pertenezcan a ejecuciones completadas anteriores a la ejecución actual.
 * @param {{
 *   artifacts?: Array<{ id?: number; name?: string; created_at?: string; workflow_run?: { id?: number } }>;
 *   currentRunId?: string | number;
 *   currentRunStartedAt?: string;
 *   activeRunIds?: Set<string>;
 *   prefix?: string;
 * }} options
 */
export function selectArtifactsToDelete({
  artifacts = [],
  currentRunId,
  currentRunStartedAt,
  activeRunIds = new Set(),
  prefix = REPORT_ARTIFACT_PREFIX,
}) {
  const currentIdStr = String(currentRunId ?? '');
  const currentStartMs = currentRunStartedAt ? Date.parse(String(currentRunStartedAt)) : Number.NaN;

  return artifacts.filter((artifact) => {
    if (!artifact || typeof artifact !== 'object') return false;
    const name = String(artifact.name || '');
    if (!name.startsWith(prefix)) return false;

    const runId = artifact.workflow_run?.id;
    const runIdStr = runId !== undefined && runId !== null ? String(runId) : '';

    // Nunca borrar artefactos de la ejecución actual ni de ejecuciones sin runId identificable
    if (!runIdStr || runIdStr === currentIdStr) return false;

    // Nunca tocar ejecuciones en curso
    if (activeRunIds.has(runIdStr)) return false;

    const createdMs = artifact.created_at ? Date.parse(String(artifact.created_at)) : Number.NaN;
    if (Number.isFinite(currentStartMs) && Number.isFinite(createdMs) && createdMs >= currentStartMs) {
      return false;
    }

    return true;
  });
}

/**
 * Selecciona ejecuciones antiguas del workflow (opcional, solo cuando CLEANUP_OLD_RUNS=true),
 * conservando siempre la ejecución actual, cualquier ejecución en curso y la última completada.
 * @param {{
 *   runs?: Array<{ id?: number | string; status?: string; created_at?: string }>;
 *   currentRunId?: string | number;
 * }} options
 */
export function selectRunsToDelete({ runs = [], currentRunId }) {
  const currentIdStr = String(currentRunId ?? '');
  const completedOtherRuns = runs
    .filter(
      (r) =>
        r &&
        String(r.id) !== currentIdStr &&
        String(r.status || '').toLowerCase() === 'completed'
    )
    .sort((a, b) => {
      const tb = Date.parse(String(b.created_at || 0)) || Number(b.id || 0);
      const ta = Date.parse(String(a.created_at || 0)) || Number(a.id || 0);
      return tb - ta;
    });

  // Conservar siempre la última completada además de la actual
  const keepLatestCompletedId = completedOtherRuns.length > 0 ? String(completedOtherRuns[0].id) : null;

  return completedOtherRuns.filter((r) => String(r.id) !== keepLatestCompletedId);
}

async function githubApiRequest(url, { method = 'GET', token } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'torneo-del-pavo-ci-cleanup',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, { method, headers });
  return response;
}

async function fetchAllPages(baseUrl, arrayKey, token) {
  const items = [];
  let page = 1;
  while (true) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const res = await githubApiRequest(`${baseUrl}${sep}per_page=100&page=${page}`, { token });
    if (!res.ok) {
      return { ok: false, status: res.status, items };
    }
    const data = await res.json();
    const batch = Array.isArray(data?.[arrayKey]) ? data[arrayKey] : [];
    items.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return { ok: true, status: 200, items };
}

function appendStepSummary(text) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    fs.appendFileSync(summaryFile, `${text}\n`, 'utf8');
  }
}

export async function runCleanup({
  dryRun = process.argv.includes('--dry-run') ||
    process.env.DRY_RUN === '1' ||
    !process.env.GITHUB_TOKEN,
} = {}) {
  const repo = (process.env.GITHUB_REPOSITORY || '').trim();
  const runId = (process.env.GITHUB_RUN_ID || '').trim();
  const token = (process.env.GITHUB_TOKEN || '').trim();
  const cleanupOldRuns = (process.env.CLEANUP_OLD_RUNS || '').trim() === 'true';

  if (dryRun || !repo || !runId || !token) {
    const reason = !token
      ? 'sin GITHUB_TOKEN'
      : !repo || !runId
        ? 'sin GITHUB_REPOSITORY / GITHUB_RUN_ID'
        : 'bandera --dry-run / DRY_RUN=1';
    console.log(`ℹ️  Limpieza en modo dry-run (${reason}): no se realizarán borrados en GitHub.`);
    appendStepSummary('### Limpieza de reportes antiguos\n- Modo simulación (`dry-run`): **Reportes anteriores eliminados: 0**\n');
    return { deletedArtifacts: 0, deletedRuns: 0, dryRun: true };
  }

  const apiBase = `https://api.github.com/repos/${repo}`;

  // 1. Obtener hora de inicio y workflow_id de la ejecución actual
  const runRes = await githubApiRequest(`${apiBase}/actions/runs/${runId}`, { token });
  if (runRes.status === 403 || runRes.status === 404) {
    console.warn(`⚠️  La API de GitHub respondió ${runRes.status} al consultar la ejecución actual; se omite la limpieza sin fallar.`);
    appendStepSummary(`### Limpieza de reportes antiguos\n- ⚠️ La API de GitHub respondió ${runRes.status}; **Reportes anteriores eliminados: 0**\n`);
    return { deletedArtifacts: 0, deletedRuns: 0, dryRun: false, status: runRes.status };
  }
  if (!runRes.ok) {
    throw new Error(`Error HTTP ${runRes.status} al consultar la ejecución ${runId}`);
  }
  const currentRun = await runRes.json();
  const currentRunStartedAt = currentRun.run_started_at || currentRun.created_at;
  const workflowId = currentRun.workflow_id;

  // 2. Identificar ejecuciones en curso para no tocar sus artefactos
  const activeRunIds = new Set();
  for (const statusFilter of ['in_progress', 'queued', 'waiting', 'requested']) {
    const activeRes = await fetchAllPages(
      `${apiBase}/actions/runs?status=${statusFilter}`,
      'workflow_runs',
      token
    );
    if (activeRes.ok) {
      for (const r of activeRes.items) {
        if (r?.id !== undefined) activeRunIds.add(String(r.id));
      }
    }
  }

  // 3. Listar artefactos con paginación y filtrar
  const artifactsRes = await fetchAllPages(`${apiBase}/actions/artifacts`, 'artifacts', token);
  if (artifactsRes.status === 403 || artifactsRes.status === 404) {
    console.warn(`⚠️  La API de GitHub respondió ${artifactsRes.status} al listar artefactos; se omite la limpieza.`);
    appendStepSummary(`### Limpieza de reportes antiguos\n- ⚠️ La API de GitHub respondió ${artifactsRes.status}; **Reportes anteriores eliminados: 0**\n`);
    return { deletedArtifacts: 0, deletedRuns: 0, dryRun: false, status: artifactsRes.status };
  }
  if (!artifactsRes.ok) {
    throw new Error(`Error HTTP ${artifactsRes.status} al listar artefactos`);
  }

  const toDelete = selectArtifactsToDelete({
    artifacts: artifactsRes.items,
    currentRunId: runId,
    currentRunStartedAt,
    activeRunIds,
  });

  let deletedArtifacts = 0;
  for (const artifact of toDelete) {
    const delRes = await githubApiRequest(`${apiBase}/actions/artifacts/${artifact.id}`, {
      method: 'DELETE',
      token,
    });
    if (delRes.status === 403 || delRes.status === 404) {
      console.warn(`⚠️  No se pudo borrar artefacto ${artifact.id} (${delRes.status}).`);
      continue;
    }
    if (delRes.ok) {
      deletedArtifacts++;
    }
  }

  let deletedRuns = 0;
  if (cleanupOldRuns && workflowId) {
    const runsRes = await fetchAllPages(
      `${apiBase}/actions/workflows/${workflowId}/runs`,
      'workflow_runs',
      token
    );
    if (runsRes.ok) {
      const runsToDelete = selectRunsToDelete({ runs: runsRes.items, currentRunId: runId });
      for (const r of runsToDelete) {
        const delRunRes = await githubApiRequest(`${apiBase}/actions/runs/${r.id}`, {
          method: 'DELETE',
          token,
        });
        if (delRunRes.ok) deletedRuns++;
      }
    }
  }

  console.log(`Reportes anteriores eliminados: ${deletedArtifacts}`);
  if (cleanupOldRuns) {
    console.log(`Ejecuciones antiguas eliminadas: ${deletedRuns}`);
  }

  const summaryLines = [
    '### Limpieza automática de reportes anteriores',
    `- **Reportes anteriores eliminados: ${deletedArtifacts}**`,
  ];
  if (cleanupOldRuns) {
    summaryLines.push(`- **Ejecuciones antiguas eliminadas (CLEANUP_OLD_RUNS=true): ${deletedRuns}**`);
  }
  appendStepSummary(`${summaryLines.join('\n')}\n`);

  return { deletedArtifacts, deletedRuns, dryRun: false };
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  runCleanup().catch((err) => {
    console.error(`⚠️  Limpieza de artefactos finalizada con aviso: ${err instanceof Error ? err.message : String(err)}`);
    appendStepSummary('### Limpieza automática de reportes anteriores\n- ⚠️ No se pudo completar la limpieza; **Reportes anteriores eliminados: 0**\n');
    process.exit(0);
  });
}
