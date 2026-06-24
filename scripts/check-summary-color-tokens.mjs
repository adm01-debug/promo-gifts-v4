#!/usr/bin/env node
/**
 * Gate: bloqueia substituição acidental dos tokens `success` por
 * `primary` / `accent` dentro do card "Resumo das Configurações".
 *
 * Modos:
 *  - CLI:    node scripts/check-summary-color-tokens.mjs
 *  - import: `import { auditSource, auditFile, TITLE } from '.../check-summary-color-tokens.mjs'`
 *
 * `SUMMARY_GATE_FILES` (CSV de paths absolutos ou relativos a ROOT) sobrescreve
 * a lista padrão — usado em fuzz tests in-process.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve ROOT de forma resiliente — sob Vitest/Vite o `import.meta.url`
// pode chegar como `http://`; nesse caso fallback para cwd.
function resolveRoot() {
  try {
    const url = new URL('..', import.meta.url);
    if (url.protocol === 'file:') return resolve(fileURLToPath(url));
  } catch {
    /* noop */
  }
  return process.cwd();
}
export const ROOT = resolveRoot();
export const TITLE = 'Resumo das Configurações';
export const WINDOW_BEFORE = 400;
export const WINDOW_AFTER = 2200;

export const REQUIRED = [
  /\bbg-success\b/,
  /\bborder-success\/\d+/,
  /\bbg-success\/\d+/,
  /\btext-success\b/,
];

// Cobre token puro (`bg-primary`) e variantes com opacidade (`bg-primary/10`)
export const FORBIDDEN = [
  { re: /\bborder-primary(\/\d+)?\b/, label: 'border-primary[/*]' },
  { re: /\bbg-primary(\/\d+)?\b/, label: 'bg-primary[/*]' },
  { re: /\btext-primary(-foreground)?\b/, label: 'text-primary*' },
  { re: /\bborder-accent(\/\d+)?\b/, label: 'border-accent[/*]' },
  { re: /\bbg-accent(\/\d+)?\b/, label: 'bg-accent[/*]' },
  { re: /\btext-accent(-foreground)?\b/, label: 'text-accent*' },
];

/**
 * Audita um source string. Retorna lista de erros (vazia ⇒ ok).
 */
export function auditSource(src, label = '<source>') {
  const errors = [];
  const idx = src.indexOf(TITLE);
  if (idx === -1) {
    errors.push(`${label}: título "${TITLE}" não encontrado — renomeou?`);
    return errors;
  }
  const block = src.slice(Math.max(0, idx - WINDOW_BEFORE), idx + WINDOW_AFTER);
  for (const re of REQUIRED) {
    if (!re.test(block))
      errors.push(`${label}: token obrigatório ausente no bloco ${TITLE}: ${re}`);
  }
  for (const { re, label: forb } of FORBIDDEN) {
    const m = block.match(re);
    if (m) errors.push(`${label}: token proibido "${forb}" no bloco ${TITLE} → "${m[0]}"`);
  }
  return errors;
}

export function auditFile(rel) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) return [`arquivo ausente: ${rel}`];
  return auditSource(readFileSync(file, 'utf8'), rel);
}

function isMain() {
  const entry = process.argv[1] && resolve(process.argv[1]);
  return entry === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const GUARDED_FILES = process.env.SUMMARY_GATE_FILES
    ? process.env.SUMMARY_GATE_FILES.split(',').map((s) => s.trim()).filter(Boolean)
    : ['src/components/products/ProductCustomizationOptions.tsx'];

  let errors = 0;
  for (const rel of GUARDED_FILES) {
    const errs = auditFile(rel);
    for (const e of errs) console.error(`❌ ${e}`);
    errors += errs.length;
  }
  if (errors > 0) {
    console.error(`\n💥 ${errors} violação(ões) de tokens no card "${TITLE}".`);
    console.error('   Use bg-success / border-success/* / text-success — nunca primary ou accent.');
    process.exit(1);
  }
  console.log(`✅ Tokens "success" preservados em ${GUARDED_FILES.length} arquivo(s).`);
}
