#!/usr/bin/env node
/**
 * B1 — Gate estático de render de CNPJ.
 *
 * Falha (exit 1) se algum arquivo em src/**\/*.{ts,tsx} renderiza CNPJ cru
 * (sem passar por maskCnpj) em JSX ou template string "CNPJ: ${...}".
 *
 * Também audita mutações Supabase (insert/update/upsert) próximas a `cnpj:`
 * sem SSOT (assertPersistableCnpj/normalizeCnpj/cnpjOptionalSchema).
 *
 * Allowlist:
 *   - SSOT: src/utils/masks.ts, src/utils/cnpj-schema.ts
 *   - Testes: **\/*.test.ts(x), **\/*.spec.ts(x), src/utils/__tests__/**
 *   - Harness dev: src/pages/dev/CnpjFormHarness.tsx
 *   - Este script + docs/qa
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

const ALLOWLIST_FILES = new Set([
  'src/utils/masks.ts',
  'src/utils/cnpj-schema.ts',
  'src/pages/dev/CnpjFormHarness.tsx',
]);

const ALLOWLIST_PATTERNS = [
  /[\\/]__tests__[\\/]/,
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
];

const RENDER_PATTERNS = [
  // {something.cnpj} ou {x.client_cnpj} ou {x.branch_cnpj} em JSX (posição texto)
  // NÃO conta como render se for atribuição JSX (prop={x.cnpj}) — o receiver mascara.
  /(^|[^=\w])\{\s*[a-zA-Z_$][\w.?]*\.(?:cnpj|client_cnpj|branch_cnpj)\s*\}/,
  // `CNPJ: ${x.cnpj}` (template string)
  /`[^`]*CNPJ[^`]*\$\{[^}]*\.(?:cnpj|client_cnpj|branch_cnpj)[^}]*\}[^`]*`/,
  // "CNPJ: " + x.cnpj
  /["']CNPJ[^"']*["']\s*\+\s*[a-zA-Z_$][\w.?]*\.(?:cnpj|client_cnpj|branch_cnpj)/,
];

// Contextos onde `.cnpj` NÃO é render (busca, filtro, replace, disabled=...)
const CONTEXT_IGNORES = [
  /\.toLowerCase\s*\(/,
  /\.toUpperCase\s*\(/,
  /\.replace\s*\(\s*\/\\D/,
  /\.includes\s*\(/,
  /\.length\b/,
  /disabled\s*=/,
  /^\s*\/\//, // comentário de linha
  /^\s*\*/,   // comentário de bloco
];

const MUTATION_METHODS = /\.(insert|update|upsert)\s*\(/;
const CNPJ_KEY_LINE = /(^|[^a-zA-Z_])cnpj\s*:/;
const SSOT_MARKERS = /(assertPersistableCnpj|normalizeCnpj|cnpjOptionalSchema)/;
// Contextos onde `cnpj:` é declaração de tipo/select-string, não payload real:
const CNPJ_KEY_HARMLESS = [
  /select\s*:\s*['"][^'"]*cnpj/, // select: '..., cnpj, ...'
  /\bcnpj\?\s*:/,                // cnpj?: string  (tipo)
  /\bcnpj\s*:\s*(?:string|number|boolean|null|undefined|any|unknown|z\.)/, // tipo
  /interface\s+\w+/,             // linha de interface
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.(tsx?|mts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function isAllowed(relPath) {
  if (ALLOWLIST_FILES.has(relPath.split(sep).join('/'))) return true;
  return ALLOWLIST_PATTERNS.some((p) => p.test(relPath));
}

const renderViolations = [];
const mutationViolations = [];
let scannedFiles = 0;

for (const abs of walk(SRC)) {
  const rel = relative(ROOT, abs);
  scannedFiles++;
  if (isAllowed(rel)) continue;

  const src = readFileSync(abs, 'utf8');
  const lines = src.split('\n');

  // ── B1a: render cru ──
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (CONTEXT_IGNORES.some((r) => r.test(line))) continue;
    for (const p of RENDER_PATTERNS) {
      if (p.test(line)) {
        // Se maskCnpj está na MESMA linha, é ok (já foi transformado)
        if (/maskCnpj\s*\(/.test(line)) continue;
        renderViolations.push({ file: rel, line: i + 1, snippet: line.trim() });
        break;
      }
    }
  }

  // ── B6: mutação com cnpj: sem SSOT ──
  for (let i = 0; i < lines.length; i++) {
    if (!MUTATION_METHODS.test(lines[i])) continue;
    // olhar janela de 12 linhas seguintes (payload)
    const window = lines.slice(i, Math.min(i + 12, lines.length));
    const winStr = window.join('\n');
    if (!CNPJ_KEY_LINE.test(winStr)) continue;
    if (CNPJ_KEY_HARMLESS.some((r) => r.test(winStr))) continue;
    if (SSOT_MARKERS.test(winStr)) continue;
    // olhar 20 linhas anteriores (variável pré-normalizada)
    const preWin = lines.slice(Math.max(0, i - 20), i).join('\n');
    if (SSOT_MARKERS.test(preWin)) continue;
    mutationViolations.push({
      file: rel,
      line: i + 1,
      snippet: lines[i].trim(),
    });
  }
}

let failed = false;

console.log(`[cnpj-render-gate] arquivos escaneados: ${scannedFiles}`);

if (renderViolations.length > 0) {
  failed = true;
  console.error(`\n❌ B1 — render cru de CNPJ encontrado (${renderViolations.length}):`);
  for (const v of renderViolations) {
    console.error(`  ${v.file}:${v.line}  ${v.snippet}`);
  }
  console.error(
    '\n  → Use maskCnpj(...) do @/utils/masks para exibir. Persistência continua com normalizeCnpj/assertPersistableCnpj.',
  );
}

if (mutationViolations.length > 0) {
  failed = true;
  console.error(
    `\n❌ B6 — mutação (insert/update/upsert) próxima a "cnpj:" sem SSOT (${mutationViolations.length}):`,
  );
  for (const v of mutationViolations) {
    console.error(`  ${v.file}:${v.line}  ${v.snippet}`);
  }
  console.error(
    '\n  → Aplique assertPersistableCnpj(...) ou cnpjOptionalSchema antes de enviar.',
  );
}

if (failed) {
  console.error('\n[cnpj-render-gate] FAIL');
  process.exit(1);
}
console.log('[cnpj-render-gate] OK — 0 violações de render ou mutação.');
