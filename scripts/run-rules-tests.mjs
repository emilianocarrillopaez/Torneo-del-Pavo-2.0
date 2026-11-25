import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const javaCheck = spawnSync('java', ['-version'], { encoding: 'utf8' });

if (javaCheck.error || javaCheck.status !== 0) {
  console.error('');
  console.error('❌ No se pudo ejecutar la suite de reglas porque no se encontró Java (JRE/JDK 17+).');
  console.error('   El emulador de Cloud Firestore requiere Java para arrancar localmente.');
  console.error('');
  console.error('Opciones para ejecutar `npm run test:rules`:');
  console.error('  1. Integración Continua (recomendado, sin instalar nada): sube tus cambios a GitHub y el workflow `.github/workflows/ci.yml` ejecutará las pruebas automáticamente con Java 17.');
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
