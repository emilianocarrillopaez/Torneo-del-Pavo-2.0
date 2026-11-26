import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const DEFAULT_REPORTS_DIR = 'reports';
export const MAX_SUMMARY_BYTES = 95 * 1024;
export const MAX_ERROR_TAIL_LINES = 40;

export function cleanReportsDir(reportsDir = path.resolve(process.cwd(), DEFAULT_REPORTS_DIR)) {
  fs.rmSync(reportsDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(reportsDir, 'playwright'), { recursive: true });
  fs.mkdirSync(path.join(reportsDir, 'lighthouse'), { recursive: true });
  return reportsDir;
}

export function ensureReportsDirs(reportsDir = path.resolve(process.cwd(), DEFAULT_REPORTS_DIR)) {
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.mkdirSync(path.join(reportsDir, 'playwright'), { recursive: true });
  fs.mkdirSync(path.join(reportsDir, 'lighthouse'), { recursive: true });
  return reportsDir;
}

export function writeStepOutput({
  stepName,
  outputFile,
  content,
  reportsDir = path.resolve(process.cwd(), DEFAULT_REPORTS_DIR),
  echo = true,
}) {
  ensureReportsDirs(reportsDir);
  const safeName = path.basename(outputFile);
  const targetPath = path.join(reportsDir, safeName);
  const body = String(content ?? '');
  fs.writeFileSync(targetPath, body, 'utf8');
  if (echo && body) {
    process.stdout.write(body.endsWith('\n') ? body : `${body}\n`);
  }
  return { stepName, targetPath, bytes: Buffer.byteLength(body, 'utf8') };
}

/**
 * @param {{
 *   stepName: string;
 *   outputFile: string;
 *   command: string;
 *   args?: string[];
 *   reportsDir?: string;
 *   env?: NodeJS.ProcessEnv;
 *   echo?: boolean;
 * }} options
 */
export function runCommandWithReport({
  stepName,
  outputFile,
  command,
  args = [],
  reportsDir = path.resolve(process.cwd(), DEFAULT_REPORTS_DIR),
  env = process.env,
  echo = true,
}) {
  ensureReportsDirs(reportsDir);
  const targetPath = path.join(reportsDir, path.basename(outputFile));
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env,
    shell: process.platform === 'win32',
  });

  const combined = [result.stdout || '', result.stderr || ''].filter(Boolean).join('');
  fs.writeFileSync(targetPath, combined, 'utf8');

  if (echo) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return { stepName, targetPath, exitCode, output: combined };
}

export function parseTapCounts(tapText) {
  if (typeof tapText !== 'string' || !tapText.trim()) return null;
  const testsMatch = tapText.match(/^#\s*tests\s+(\d+)/m);
  const passMatch = tapText.match(/^#\s*pass\s+(\d+)/m);
  const failMatch = tapText.match(/^#\s*fail\s+(\d+)/m);
  if (!testsMatch && !passMatch && !failMatch) return null;
  return {
    total: testsMatch ? Number.parseInt(testsMatch[1], 10) : 0,
    passed: passMatch ? Number.parseInt(passMatch[1], 10) : 0,
    failed: failMatch ? Number.parseInt(failMatch[1], 10) : 0,
  };
}

export function parsePlaywrightCounts(jsonText) {
  if (typeof jsonText !== 'string' || !jsonText.trim()) return null;
  try {
    const data = JSON.parse(jsonText);
    const stats = data?.stats;
    if (stats && typeof stats === 'object') {
      const passed = Number(stats.expected || 0);
      const failed = Number(stats.unexpected || 0);
      const flaky = Number(stats.flaky || 0);
      const skipped = Number(stats.skipped || 0);
      return {
        total: passed + failed + flaky + skipped,
        passed: passed + flaky,
        failed,
        skipped,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function parseLighthouseScores(reportsDir) {
  const lhDir = path.join(reportsDir, 'lighthouse');
  if (!fs.existsSync(lhDir)) return [];

  const manifestPath = path.join(lhDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (Array.isArray(manifest)) {
        return manifest
          .filter((entry) => entry && typeof entry.summary === 'object')
          .map((entry) => ({
            url: String(entry.url || ''),
            performance: Math.round(Number(entry.summary.performance || 0) * 100),
            accessibility: Math.round(Number(entry.summary.accessibility || 0) * 100),
            bestPractices: Math.round(Number(entry.summary['best-practices'] || 0) * 100),
            seo: Math.round(Number(entry.summary.seo || 0) * 100),
          }));
      }
    } catch {
      return [];
    }
  }
  return [];
}

export function parseAuditSummary(auditText) {
  if (typeof auditText !== 'string' || !auditText.trim()) return null;
  const lines = auditText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const summaryLine =
    lines.find((l) => /vulnerabilit|no vulnerabilities/i.test(l)) || lines[lines.length - 1];
  return summaryLine || null;
}

export function sanitizeErrorTail(rawText, maxLines = MAX_ERROR_TAIL_LINES) {
  if (typeof rawText !== 'string' || !rawText.trim()) return '';
  const allLines = rawText.trimEnd().split(/\r?\n/);
  const lines = allLines
    .slice(-maxLines)
    .map((line) =>
      line
        .replace(/\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]+\b/g, '[TOKEN_REDACTADO]')
        .replace(/Bearer\s+[A-Za-z0-9._\-=]+/gi, 'Bearer [REDACTADO]')
        .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL)[A-Z0-9_]*)=([^\s]+)/gi, '$1=[REDACTADO]')
    );
  return lines.join('\n').trim();
}

export function assertSafeReportsDir(reportsDir = path.resolve(process.cwd(), DEFAULT_REPORTS_DIR)) {
  if (!fs.existsSync(reportsDir)) return { filesChecked: 0 };

  const offenders = [];
  let filesChecked = 0;

  function walk(dir, relPrefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        filesChecked++;
        const lower = entry.name.toLowerCase();
        if (
          lower.startsWith('.env') ||
          /\.(pem|key|p12|pfx)$/i.test(lower) ||
          lower.includes('service-account')
        ) {
          offenders.push(`archivo sensible "${relPath}"`);
          continue;
        }
        if (/\.(txt|md|log|json)$/i.test(lower)) {
          const text = fs.readFileSync(fullPath, 'utf8');
          if (/(ghp_|github_pat_[A-Za-z0-9_]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i.test(text)) {
            offenders.push(`posible secreto o llave privada en "${relPath}"`);
          }
          if (/data:image\/(?:jpeg|png|webp);base64,|data:application\/pdf;base64,/i.test(text)) {
            offenders.push(`posible comprobante base64 embebido en "${relPath}"`);
          }
        }
      }
    }
  }

  walk(reportsDir);
  if (offenders.length > 0) {
    throw new Error(
      `❌ Se detectó contenido sensible en ${DEFAULT_REPORTS_DIR}/ antes de subir artefactos: ${offenders.join(', ')}`
    );
  }
  return { filesChecked };
}

export function buildJobSummaryMarkdown({
  jobName,
  status = 'success',
  reportsDir = path.resolve(process.cwd(), DEFAULT_REPORTS_DIR),
}) {
  const isSuccess = String(status).toLowerCase() === 'success';
  const badge = isSuccess ? '✅ Éxito' : '❌ Falló';
  const lines = [
    `## ${isSuccess ? '✅' : '❌'} ${jobName}`,
    '',
    `- **Resultado del trabajo:** ${badge}`,
  ];

  const unitPath = path.join(reportsDir, 'unit-tests.txt');
  const unitText = fs.existsSync(unitPath) ? fs.readFileSync(unitPath, 'utf8') : '';
  const unitCounts = parseTapCounts(unitText);
  if (unitCounts) {
    lines.push(
      `- **Pruebas unitarias:** ${unitCounts.passed}/${unitCounts.total} aprobadas (${unitCounts.failed} fallidas)`
    );
  }

  const rulesPath = path.join(reportsDir, 'rules-tests.txt');
  const rulesText = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : '';
  const rulesCounts = parseTapCounts(rulesText);
  if (rulesCounts) {
    lines.push(
      `- **Pruebas de reglas Firestore:** ${rulesCounts.passed}/${rulesCounts.total} aprobadas (${rulesCounts.failed} fallidas)`
    );
  }

  const pwJsonPath = path.join(reportsDir, 'playwright', 'results.json');
  const pwJsonText = fs.existsSync(pwJsonPath) ? fs.readFileSync(pwJsonPath, 'utf8') : '';
  const pwCounts = parsePlaywrightCounts(pwJsonText);
  if (pwCounts) {
    lines.push(
      `- **Pruebas E2E (Playwright):** ${pwCounts.passed}/${pwCounts.total} aprobadas (${pwCounts.failed} fallidas, ${pwCounts.skipped} omitidas)`
    );
  }

  const auditPath = path.join(reportsDir, 'audit.txt');
  const auditText = fs.existsSync(auditPath) ? fs.readFileSync(auditPath, 'utf8') : '';
  const auditSummary = parseAuditSummary(auditText);
  if (auditSummary) {
    lines.push(`- **Auditoría (\`bun audit\`):** ${auditSummary}`);
  }

  const lhScores = parseLighthouseScores(reportsDir);
  if (lhScores.length > 0) {
    lines.push('');
    lines.push('### Puntajes Lighthouse');
    lines.push('| Ruta | Rendimiento | Accesibilidad | Buenas prácticas | SEO |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const s of lhScores) {
      let pathname = s.url;
      try {
        pathname = new URL(s.url).pathname || '/';
      } catch {
        // Mantener texto tal cual
      }
      lines.push(
        `| \`${pathname}\` | ${s.performance} | ${s.accessibility} | ${s.bestPractices} | ${s.seo} |`
      );
    }
  }

  if (!isSuccess) {
    const candidateLogs = [
      'lint.txt',
      'rules-lint.txt',
      'audit.txt',
      'unit-tests.txt',
      'rules-tests.txt',
      'e2e.txt',
      'lighthouse.txt',
      'build.txt',
    ];
    let errorTail = '';
    let sourceName = '';
    for (const filename of candidateLogs) {
      const candidatePath = path.join(reportsDir, filename);
      if (!fs.existsSync(candidatePath)) continue;
      const content = fs.readFileSync(candidatePath, 'utf8');
      if (/\b(error|failed|fail\s+[1-9]|ERR_)\b/i.test(content)) {
        errorTail = sanitizeErrorTail(content, MAX_ERROR_TAIL_LINES);
        sourceName = filename;
      }
    }
    if (!errorTail) {
      for (const filename of candidateLogs) {
        const candidatePath = path.join(reportsDir, filename);
        if (!fs.existsSync(candidatePath)) continue;
        const tail = sanitizeErrorTail(fs.readFileSync(candidatePath, 'utf8'), MAX_ERROR_TAIL_LINES);
        if (tail) {
          errorTail = tail;
          sourceName = filename;
        }
      }
    }
    if (errorTail) {
      lines.push('');
      lines.push(`### Últimas líneas del error (\`${sourceName}\`)`);
      lines.push('```text');
      lines.push(errorTail);
      lines.push('```');
    }
  }

  let markdown = `${lines.join('\n')}\n`;
  if (Buffer.byteLength(markdown, 'utf8') > MAX_SUMMARY_BYTES) {
    markdown = `${markdown.slice(0, MAX_SUMMARY_BYTES - 60)}\n\n*(Resumen recortado para respetar el límite de 100 KB)*\n`;
  }
  return markdown;
}

export function writeJobSummary({
  jobName,
  status = 'success',
  reportsDir = path.resolve(process.cwd(), DEFAULT_REPORTS_DIR),
  stepSummaryPath = process.env.GITHUB_STEP_SUMMARY,
}) {
  ensureReportsDirs(reportsDir);
  const markdown = buildJobSummaryMarkdown({ jobName, status, reportsDir });
  const resumenPath = path.join(reportsDir, 'resumen.md');
  fs.writeFileSync(resumenPath, markdown, 'utf8');
  if (stepSummaryPath) {
    fs.appendFileSync(stepSummaryPath, `${markdown}\n`, 'utf8');
  }
  return { resumenPath, markdown };
}

function parseCliArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') {
      rest.push(...argv.slice(i + 1));
      break;
    }
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return { flags, rest };
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  const { flags, rest } = parseCliArgs(process.argv.slice(2));

  if (flags.clean) {
    const dir = cleanReportsDir();
    console.log(`✅ Carpeta de reportes reiniciada: ${dir}`);
  } else if (flags.run) {
    const [cmd, ...cmdArgs] = rest;
    if (!cmd || !flags.out) {
      console.error('Uso: node scripts/ci-report.mjs --run --step "<nombre>" --out <archivo.txt> -- <comando>');
      process.exit(1);
    }
    const res = runCommandWithReport({
      stepName: String(flags.step || cmd),
      outputFile: String(flags.out),
      command: cmd,
      args: cmdArgs,
    });
    process.exit(res.exitCode);
  } else if (flags.write) {
    if (!flags.out) {
      console.error('Uso: node scripts/ci-report.mjs --write --step "<nombre>" --out <archivo.txt> [--text "..."]');
      process.exit(1);
    }
    const content =
      typeof flags.text === 'string'
        ? flags.text
        : fs.readFileSync(0, 'utf8');
    writeStepOutput({
      stepName: String(flags.step || flags.out),
      outputFile: String(flags.out),
      content,
    });
  } else if (flags.summary) {
    const { resumenPath } = writeJobSummary({
      jobName: String(flags.job || 'Ejecución CI'),
      status: String(flags.status || 'success'),
    });
    assertSafeReportsDir();
    console.log(`✅ Resumen generado en ${resumenPath}`);
  } else if (flags['verify-safe']) {
    const { filesChecked } = assertSafeReportsDir();
    console.log(`✅ Verificación de seguridad en reports/ superada (${filesChecked} archivos revisados).`);
  } else {
    console.error('Indica una acción: --clean | --run | --write | --summary | --verify-safe');
    process.exit(1);
  }
}
