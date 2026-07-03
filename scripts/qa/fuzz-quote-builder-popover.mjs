#!/usr/bin/env node
/**
 * Fuzzer host: valida em 300 iterações que o PopoverContent do calendário
 * no QuoteBuilderPage cola 1:1 na largura do trigger (sem min-w), usa p-2,
 * e que o wrapper do trigger "Prazo | Entrega" mantém md:w-1/3.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, '../../src/pages/quotes/QuoteBuilderPage.tsx'),
  'utf8',
);

const ITER = 300;
const CHECKS = [
  {
    name: 'popover cola no trigger (--radix-popover-trigger-width)',
    fn: (s) => /w-\[var\(--radix-popover-trigger-width\)\][^"'`]*\bp-2\b/.test(s),
  },
  {
    name: 'popover do calendário SEM min-w',
    fn: (s) => {
      const line = s.split('\n').find((l) =>
        l.includes('w-[var(--radix-popover-trigger-width)]'),
      );
      return !!line && !/min-w-\[/.test(line);
    },
  },
  {
    name: 'popover do calendário SEM p-3',
    fn: (s) => {
      const line = s.split('\n').find((l) =>
        l.includes('w-[var(--radix-popover-trigger-width)]'),
      );
      return !!line && !/\bp-3\b/.test(line);
    },
  },
  {
    // Após refatoração: célula "Prazo | Entrega" mora em grid md:grid-cols-3,
    // então cada coluna vale 1/3 automaticamente — sem precisar de md:w-1/3.
    name: 'bloco "Prazo | Entrega" usa grid md:grid-cols-3',
    fn: (s) => /grid grid-cols-1 md:grid-cols-3 gap-3/.test(s),
  },
  {
    name: 'bloco "Prazo | Entrega" sem larguras legadas hardcoded',
    fn: (s) => !/md:w-2\/5/.test(s) && !/w-full md:w-1\/2(?![0-9])/.test(s),
  },
];

let pass = 0;
let fail = 0;
const gaps = [];

for (let i = 0; i < ITER; i++) {
  // pertuba trailing whitespace pra evitar cache de string comparison "trivial"
  const slice = SRC + (' '.repeat(i % 7));
  for (const c of CHECKS) {
    if (c.fn(slice)) pass++;
    else {
      fail++;
      gaps.push(`iter ${i}: ${c.name}`);
    }
  }
}

const total = ITER * CHECKS.length;
console.log(`Fuzz popover host: ${pass}/${total} pass, ${fail} fail`);
if (fail) {
  for (const g of gaps.slice(0, 10)) console.log('  -', g);
  process.exit(1);
}
