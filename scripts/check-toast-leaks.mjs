#!/usr/bin/env node
/**
 * check-toast-leaks — gate estático contra vazamento de texto técnico em toasts.
 *
 * Detecta padrões frágeis em `toast.error(...)` / `toast.warning(...)` /
 * `description: …` que tendem a injetar mensagens cruas vindas de
 * `Error.message`, payloads de edges ou stack frames.
 *
 * Política:
 *  - Baseline congelada em `.toast-leaks-baseline.json` documenta as N
 *    ocorrências legadas aceitas hoje. Regressões NOVAS quebram o CI.
 *  - Mensagens técnicas que escaparem em runtime caem no patch global
 *    `installSafeToast()` (`src/lib/security/safeToast.ts`) — este gate
 *    existe para evitar novas dívidas, não substitui o patch.
 *
 * Uso:
 *   node scripts/check-toast-leaks.mjs            # gate
 *   UPDATE_BASELINE=1 node scripts/check-toast-leaks.mjs   # regrava baseline
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, '.toast-leaks-baseline.json');

/** Padrões considerados leak. Cada um é uma regex com flag g/m aplicada por linha. */
const LEAK_PATTERNS = [
  // toast.error(`...${err.message}...`)  /  toast.warning(... err.message ...)
  /toast\.(?:error|warning|message)\([^)]*\.(?:message|stack)\b/,
  // description: <expr>.message  /  description: <expr>.stack
  /description\s*:\s*[^,)\n]*\.(?:message|stack)\b/,
  // toast.error(error)  /  toast.error(err)  — passar Error nu
  /toast\.(?:error|warning|message)\(\s*(?:error|err|e)\s*\)/,
];

/** Ignora arquivos de teste/spec, mocks e o próprio safeToast/sanitize-error. */
const IGNORE_PATH_RE = /(?:\.test\.|\.spec\.|__tests__|__mocks__|safeToast\.ts|sanitize-error\.ts)/;

function listSourceFiles() {
  const out = execSync('git ls-files src', { cwd: ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !IGNORE_PATH_RE.test(f));
}

function findLeaks() {
  const files = listSourceFiles();
  const leaks = [];
  for (const file of files) {
    const abs = path.join(ROOT, file);
    let content;
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const re of LEAK_PATTERNS) {
        if (re.test(line)) {
          leaks.push({ file, line: i + 1, snippet: line.trim().slice(0, 200) });
          break;
        }
      }
    }
  }
  return leaks;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { entries: [] };
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function keyOf(entry) {
  return `${entry.file}::${entry.line}`;
}

function main() {
  const leaks = findLeaks();
  const baseline = loadBaseline();
  const baselineKeys = new Set((baseline.entries ?? []).map(keyOf));

  if (process.env.UPDATE_BASELINE === '1') {
    const payload = {
      generated_at: new Date().toISOString(),
      total: leaks.length,
      entries: leaks.map(({ file, line, snippet }) => ({ file, line, snippet })),
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n');
    console.log(`✅ Baseline regravada: ${leaks.length} ocorrência(s).`);
    return;
  }

  const newLeaks = leaks.filter((l) => !baselineKeys.has(keyOf(l)));
  if (newLeaks.length === 0) {
    console.log(`✅ Toast leaks: ${leaks.length} legado(s), 0 novo(s).`);
    return;
  }

  console.error(`❌ ${newLeaks.length} nova(s) ocorrência(s) de toast com texto técnico:`);
  for (const l of newLeaks) {
    console.error(`  ${l.file}:${l.line}  ${l.snippet}`);
  }
  console.error(
    '\nAções:\n' +
      '  - Use `sanitizeError(...)` (src/lib/security/sanitize-error.ts) ao passar payload de edge.\n' +
      '  - Substitua `toast.error(err.message)` por copy amigável + `description: sanitizeError(err)`.\n' +
      '  - Em caso intencional (painel /admin/telemetria), justifique e rode `UPDATE_BASELINE=1`.',
  );
  process.exit(1);
}

main();
