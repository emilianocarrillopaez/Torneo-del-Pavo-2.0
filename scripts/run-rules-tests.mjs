import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const REQUIRED_JAVA_MAJOR = 21;

/**
 * Extrae la versión mayor de Java a partir de la salida de `java -version`.
 * Ejemplos válidos:
 * - openjdk version "21.0.5" 2024-10-15 -> 21
 * - java version "17.0.12" -> 17
 * - java version "1.8.0_402" -> 8
 */
export function parseJavaMajorVersion(versionOutput) {
  if (typeof versionOutput !== 'string' || !versionOutput.trim()) {
    return null;
  }
  const match = versionOutput.match(/version\s+"(\d+)(?:\.(\d+))?[^"]*"/i);
  if (!match) {
    return null;
  }
  const first = Number.parseInt(match[1], 10);
  if (!Number.isFinite(first)) return null;
  if (first === 1 && match[2]) {
    const legacy = Number.parseInt(match[2], 10);
    return Number.isFinite(legacy) ? legacy : null;
  }
  return first;
}

export function runRulesTests() {
  const javaCheck = spawnSync('java', ['-version'], { encoding: 'utf8' });
  const javaVersionRaw = `${javaCheck.stderr || ''}\n${javaCheck.stdout || ''}`;
  const javaMajor =
    javaCheck.error || javaCheck.status !== 0 ? null : parseJavaMajorVersion(javaVersionRaw);

  if (javaMajor === null || javaMajor < REQUIRED_JAVA_MAJOR) {
    console.error('');
    if (javaMajor === null) {
      console.error(
        `❌ Se requiere Java ${REQUIRED_JAVA_MAJOR} o superior para el emulador de Firestore (no se encontró \`java\`; ver README.md y docs/PASOS-MANUALES.md).`
      );
    } else {
      console.error(
        `❌ Se requiere Java ${REQUIRED_JAVA_MAJOR} o superior para el emulador de Firestore (detectado Java ${javaMajor}; ver README.md y docs/PASOS-MANUALES.md).`
      );
    }
    console.error('');
    console.error('Opciones para ejecutar las pruebas de reglas (`npm run test:rules`):');
    console.error('  1. Integración Continua (recomendado): sube tus cambios a GitHub y `.github/workflows/ci.yml` usará Java 21.');
    console.error('  2. Contenedor Docker (sin instalar Java en tu equipo):');
    console.error('       docker compose run --rm firestore-tests');
    console.error('  3. Instalación local de Java 21:');
    console.error('     • Windows (PowerShell): winget install EclipseAdoptium.Temurin.21.JRE');
    console.error('     • macOS (Homebrew):     brew install --cask temurin@21');
    console.error('     • Ubuntu/Debian:        sudo apt-get update && sudo apt-get install -y openjdk-21-jre-headless');
    console.error('');
    process.exit(1);
  }

  const isWin = process.platform === 'win32';
  const localFirebaseBin = path.resolve(
    process.cwd(),
    'node_modules',
    '.bin',
    isWin ? 'firebase.cmd' : 'firebase'
  );
  const localTsxBin = path.resolve(
    process.cwd(),
    'node_modules',
    '.bin',
    isWin ? 'tsx.cmd' : 'tsx'
  );

  if (!fs.existsSync(localFirebaseBin)) {
    console.error('❌ No se encontró el binario local de `firebase-tools`. Ejecuta `bun install --frozen-lockfile`.');
    process.exit(1);
  }

  const tsxCommand = fs.existsSync(localTsxBin)
    ? `"${localTsxBin}" --test tests/rules/firestore.rules.test.ts`
    : 'bunx --no-install tsx --test tests/rules/firestore.rules.test.ts';

  const args = [
    'emulators:exec',
    '--project',
    'yogic-decoder-5lxdt',
    '--only',
    'firestore',
    tsxCommand,
  ];

  const result = spawnSync(localFirebaseBin, args, {
    stdio: 'inherit',
    shell: isWin,
    env: {
      ...process.env,
      CI: process.env.CI || 'true',
    },
  });

  process.exit(result.status ?? 1);
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  runRulesTests();
}
