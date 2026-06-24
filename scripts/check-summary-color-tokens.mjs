#!/usr/bin/env node
/**
 * Gate: bloqueia substituição acidental dos tokens `success` por
 * `primary` / `accent` dentro do card "Resumo das Configurações".
 *
 * Escopo: arquivos registrados em GUARDED_FILES (atualmente só
 * `ProductCustomizationOptions.tsx`). Para cada arquivo, isola o bloco
 * que contém o título canônico e verifica:
 *   - presença obrigatória de tokens success (bg-success, border-success,
 *     text-success)
 *   - ausência de tokens forbidden (border-primary/, bg-primary/,
 *     text-primary, border-accent/, bg-accent/, text-accent*) no MESMO bloco
 *
 * Uso: node scripts/check-summary-color-tokens.mjs
 * CI:  step "🎨 Resumo das Configurações color tokens gate"
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

const TITLE = 'Resumo das Configurações';
const WINDOW_BEFORE = 400;
const WINDOW_AFTER = 2200;

const GUARDED_FILES = process.env.SUMMARY_GATE_FILES
  ? process.env.SUMMARY_GATE_FILES.split(',').map((s) => s.trim()).filter(Boolean)
  : ['src/components/products/ProductCustomizationOptions.tsx'];

const REQUIRED = [
  /\bbg-success\b/,
  /\bborder-success\/\d+/,
  /\bbg-success\/\d+/,
  /\btext-success\b/,
];

// Cobre token puro (`bg-primary`) e variantes com opacidade (`bg-primary/10`)
const FORBIDDEN = [
  { re: /\bborder-primary(\/\d+)?\b/, label: 'border-primary[/*]' },
  { re: /\bbg-primary(\/\d+)?\b/, label: 'bg-primary[/*]' },
  { re: /\btext-primary(-foreground)?\b/, label: 'text-primary*' },
  { re: /\bborder-accent(\/\d+)?\b/, label: 'border-accent[/*]' },
  { re: /\bbg-accent(\/\d+)?\b/, label: 'bg-accent[/*]' },
  { re: /\btext-accent(-foreground)?\b/, label: 'text-accent*' },
];

let errors = 0;

for (const rel of GUARDED_FILES) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) {
    console.error(`❌ arquivo ausente: ${rel}`);
    errors++;
    continue;
  }
  const src = readFileSync(file, 'utf8');
  const idx = src.indexOf(TITLE);
  if (idx === -1) {
    console.error(`❌ ${rel}: título "${TITLE}" não encontrado — renomeou?`);
    errors++;
    continue;
  }
  const block = src.slice(Math.max(0, idx - WINDOW_BEFORE), idx + WINDOW_AFTER);

  for (const re of REQUIRED) {
    if (!re.test(block)) {
      console.error(`❌ ${rel}: token obrigatório ausente no bloco ${TITLE}: ${re}`);
      errors++;
    }
  }
  for (const { re, label } of FORBIDDEN) {
    const m = block.match(re);
    if (m) {
      console.error(`❌ ${rel}: token proibido "${label}" encontrado no bloco ${TITLE} → "${m[0]}"`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n💥 ${errors} violação(ões) de tokens no card "${TITLE}".`);
  console.error('   Use bg-success / border-success/* / text-success — nunca primary ou accent.');
  process.exit(1);
}

console.log(`✅ Tokens "success" preservados em ${GUARDED_FILES.length} arquivo(s).`);
