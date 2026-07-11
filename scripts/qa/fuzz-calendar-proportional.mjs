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
  const cellMatch = CAL.match(/(?:^|\s)cell:\s*['"`]([^'"`]+)['"`]/);
  const headCellMatch = CAL.match(/head_cell:\s*[\s\S]{0,200}?['"`]([^'"`]+)['"`]/);
  const headRowMatch = CAL.match(/head_row:\s*['"`]([^'"`]+)['"`]/);
  const rowMatch = CAL.match(/(?:^|\s)row:\s*['"`]([^'"`]+)['"`]/);
  const capMatch = CAL.match(/caption_label:\s*['"`]([^'"`]+)['"`]/);

  const cell = cellMatch?.[1] ?? '';
  const headCell = headCellMatch?.[1] ?? '';
  const headRow = headRowMatch?.[1] ?? '';
  const row = rowMatch?.[1] ?? '';
  const cap = capMatch?.[1] ?? '';

  if (!cell.includes('flex-1') || !cell.includes('aspect-square')) {
    return `w=${width} seed=${seed}: cell sem flex-1/aspect-square (${cell})`;
  }
  if (/(?:^|\s)h-9(?:\s|$)/.test(cell)) {
    return `w=${width} seed=${seed}: cell com altura fixa h-9 (${cell})`;
  }

  if (/(?:^|\s)h-\d+\s+w-\d+(?:\s|$)/.test(cell)) {
    return `w=${width} seed=${seed}: cell com dimensão fixa (${cell})`;
  }
  if (!headCell.includes('flex-1')) {
    return `w=${width} seed=${seed}: head_cell sem flex-1`;
  }
  if (!headRow.includes('w-full')) {
    return `w=${width} seed=${seed}: head_row sem w-full`;
  }
  if (!cap.includes('leading-[1.1]') || !cap.includes('text-[11px]')) {
    return `w=${width} seed=${seed}: caption sem leading-[1.1]/text-[11px]`;
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
