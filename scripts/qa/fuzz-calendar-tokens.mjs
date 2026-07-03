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
const REQUIRED = [
  /rounded-full/,
  /bg-primary/,
  /text-primary-foreground/,
  /bg-foreground/,
  /text-background/,
  /text-destructive/,
  /text-\[15px\]/,
  /text-\[11px\]/,
  /text-\[10px\]/,
  /font-bold/,
  /tracking-tight/,
  /hover:bg-accent/,
  /invisible/,
  /flex-1/,
  /aspect-square/,
  /h-6 w-6/,
  /h-3\.5 w-3\.5/,
  /p-1\.5/,
  /space-y-1\.5/,
  /gap-0/,

];
const REQUIRED_LITERALS = [`cell: 'flex-1 aspect-square`];


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

  ok ? pass++ : fail++;
}

console.log(`Fuzz calendar tokens (iOS): ${pass}/500 pass, ${fail} fail`);
if (fail) {
  for (const g of gaps.slice(0, 10)) console.log('  -', g);
  process.exit(1);
}
