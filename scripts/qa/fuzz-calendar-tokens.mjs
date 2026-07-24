#!/usr/bin/env node
/**
 * Fuzz determinístico do calendar.tsx (iOS redesign): valida invariantes
 * de tokens semânticos e ausência de cores hard-coded em 500 iterações.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAL = readFileSync(resolve(__dirname, '../../src/components/ui/calendar.tsx'), 'utf8');

const FORBIDDEN = [
  /\bbg-white\b/,
  /\bbg-black\b/,
  /\btext-white\b/,
  /#[0-9a-fA-F]{3,6}\b/,
];
// Invariantes do design iOS Calendar (revisado 2026-07-11, shrink -20% 2027):
// - mês em vermelho (destructive) com peso bold
// - números 10px, mês 11px, weekdays 7px uppercase
// - domingos em destructive, hoje em vermelho, selecionado = círculo preenchido
// - grid proporcional (flex-1 + aspect-square), sem dimensões fixas nas células
const REQUIRED = [
  /rounded-full/,
  /text-destructive/,
  /bg-destructive/,
  /text-primary-foreground/,
  /text-\[10px\]/,
  /text-\[11px\]/,
  /text-\[7px\]/,
  // Escala responsiva mobile (tap targets ≥ 44px, fontes maiores):
  /text-\[13px\]/,
  /text-\[15px\]/,
  /h-11 w-11/,
  /font-bold/,
  /font-semibold/,
  /tracking-tight/,
  /tracking-\[0\.08em\]/,
  /hover:bg-accent/,
  /invisible/,
  /flex-1/,
  /aspect-square/,
  /(?:md:)?h-5 (?:md:)?w-5/,
  /(?:md:)?h-3 (?:md:)?w-3/,
  /(?:md:)?p-1\.5/,
  /(?:md:)?space-y-1\b/,
  /gap-0/,
  /select-none/,
  /(?:md:)?w-\[180px\]/,
];
const REQUIRED_LITERALS = [
  `cell: 'flex-1 aspect-square`,
  `row: 'flex w-full gap-0'`,
];
const FORBIDDEN_LITERALS = [
  `cell: 'flex-1 h-9`,
  `mt-1`,
  `bg-primary text-primary-foreground font-semibold hover:bg-primary`, // era o design antigo
];



let pass = 0;
let fail = 0;
const gaps = [];

for (let i = 0; i < 500; i++) {
  const slice = CAL.slice(0, CAL.length - (i % 5));
  let ok = true;
  for (const r of FORBIDDEN) {
    if (r.test(slice)) {
      ok = false;
      gaps.push(`iter ${i}: proibido ${r}`);
    }
  }
  for (const r of REQUIRED) {
    if (!r.test(slice)) {
      ok = false;
      gaps.push(`iter ${i}: faltou ${r}`);
    }
  }
  for (const lit of REQUIRED_LITERALS) {
    if (!slice.includes(lit)) {
      ok = false;
      gaps.push(`iter ${i}: literal faltando ${lit}`);
    }
  }
  for (const lit of FORBIDDEN_LITERALS) {
    if (slice.includes(lit)) {
      ok = false;
      gaps.push(`iter ${i}: literal proibido ${lit}`);
    }
  }



  ok ? pass++ : fail++;
}

console.log(`Fuzz calendar tokens (iOS): ${pass}/500 pass, ${fail} fail`);
if (fail) {
  for (const g of gaps.slice(0, 10)) console.log('  -', g);
  process.exit(1);
}
