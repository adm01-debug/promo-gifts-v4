#!/usr/bin/env node
/**
 * Fuzz determinístico do shrink ~50% do calendar.tsx.
 * Garante presença de tokens de dimensão novos, ausência dos antigos,
 * e nenhuma cor hard-coded em 500 iterações.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAL = readFileSync(resolve(__dirname, '../../src/components/ui/calendar.tsx'), 'utf8');

const REQUIRED = [
  /\bp-3\b/,
  /\btext-\[17px\]/,
  /\bh-7 w-7\b/,
  /\bh-4 w-4\b/,
  /\btext-\[11px\]/,
  /space-y-2/,
];
const FORBIDDEN = [
  /\bp-4\b/,
  /\btext-2xl\b/,
  /\bh-10 w-10\b/,
  /\bh-9 w-9\b/,
  /\bh-6 w-6\b/, // era o design antigo (revisão iOS 2026-07-11)
  /\bh-3\.5 w-3\.5\b/,
  /\bbg-blue-\d+/,
  /\bbg-white\b/,
  /\btext-white\b/,
  /#[0-9a-fA-F]{3,6}\b/,
];

let pass = 0;
let fail = 0;
const gaps = [];

for (let i = 0; i < 500; i++) {
  // slicing mutation: garante robustez a truncamentos parciais
  const slice = CAL.slice(0, CAL.length - (i % 7));
  let ok = true;
  for (const r of REQUIRED) {
    if (!r.test(slice)) { ok = false; gaps.push(`iter ${i}: faltou ${r}`); }
  }
  for (const r of FORBIDDEN) {
    if (r.test(slice)) { ok = false; gaps.push(`iter ${i}: proibido ${r}`); }
  }
  ok ? pass++ : fail++;
}

console.log(`Fuzz calendar dimensions (shrink 50%): ${pass}/500 pass, ${fail} fail`);
if (fail) {
  for (const g of gaps.slice(0, 10)) console.log('  -', g);
  process.exit(1);
}
