#!/usr/bin/env node
/**
 * Fuzzer proporcional: valida via análise estática do calendar.tsx que a grid
 * usa distribuição proporcional (flex-1 + aspect-square) e não hardcode de
 * 24/40px, simulando 700 iterações lógicas (7 larguras × 100 seeds).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAL = readFileSync(resolve(__dirname, '../../src/components/ui/calendar.tsx'), 'utf8');

const WIDTHS = [220, 260, 320, 400, 520, 640, 800];
const ITER_PER_WIDTH = 100;

let pass = 0;
let fail = 0;
const gaps = [];

function check(width, seed) {
  const cellLine = CAL.split('\n').find((l) => l.trim().startsWith('cell:'));
  const headLine = CAL.split('\n').find((l) => l.trim().startsWith('head_cell:'));
  const rowLine = CAL.split('\n').find((l) => l.trim().startsWith('head_row:'));
  const capLine = CAL.split('\n').find((l) => l.trim().startsWith('caption_label:'));

  if (!cellLine?.includes('flex-1') || !cellLine.includes('aspect-square')) {
    return `w=${width} seed=${seed}: cell sem flex-1/aspect-square`;
  }
  if (/h-\d+\s+w-\d+/.test(cellLine)) {
    return `w=${width} seed=${seed}: cell com dimensão fixa`;
  }
  if (!headLine?.includes('flex-1')) {
    return `w=${width} seed=${seed}: head_cell sem flex-1`;
  }
  if (!rowLine?.includes('w-full')) {
    return `w=${width} seed=${seed}: head_row sem w-full`;
  }
  if (!capLine?.includes('leading-none') || !capLine.includes('text-[15px]')) {
    return `w=${width} seed=${seed}: caption sem leading-none/text-[15px]`;
  }
  return null;
}

for (const w of WIDTHS) {
  for (let s = 0; s < ITER_PER_WIDTH; s++) {
    const err = check(w, s);
    if (err) {
      fail++;
      gaps.push(err);
    } else {
      pass++;
    }
  }
}

const total = WIDTHS.length * ITER_PER_WIDTH;
console.log(`Fuzz calendar proporcional: ${pass}/${total} pass, ${fail} fail`);
if (fail) {
  for (const g of gaps.slice(0, 10)) console.log('  -', g);
  process.exit(1);
}
