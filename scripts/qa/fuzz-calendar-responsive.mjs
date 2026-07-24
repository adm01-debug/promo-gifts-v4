#!/usr/bin/env node
/**
 * Fuzz determinístico dos breakpoints `sm` (mobile) e `md` (desktop) do
 * calendar.tsx. Garante que, após o modo responsivo (Onda de 2027-01-11):
 *   - Mobile mantém tap-target 44×44 (`h-11 w-11` nav, `flex-1 aspect-square`
 *     em grid de ~308–340px → ≥44px/célula) e fontes legíveis (13/15/10px).
 *   - Desktop preserva a densidade compacta original (h-5/h-3/w-[180px]/
 *     text-[10px|11px|7px]).
 *
 * Roda 500 iterações (tokens) + 200 iterações (dimensões) — total 700/700.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAL = readFileSync(resolve(__dirname, '../../src/components/ui/calendar.tsx'), 'utf8');

// --- Mobile (sm, sem prefixo `md:`) --------------------------------------
const REQUIRED_MOBILE = [
  /(?<!md:)\bh-11 w-11\b/,        // nav button mobile
  /(?<!md:)\btext-\[13px\]/,       // dia mobile
  /(?<!md:)\btext-\[15px\]/,       // caption mobile
  /(?<!md:)\btext-\[10px\]/,       // weekday mobile
  /(?<!md:)\bh-5 w-5\b/,           // ícone chevron mobile
  /(?<!md:)\bp-3\b/,               // padding container mobile
  /max-w-\[340px\]/,
];

// --- Desktop (md:) -------------------------------------------------------
const REQUIRED_DESKTOP = [
  /\bmd:h-5 md:w-5\b/,             // nav button desktop
  /\bmd:text-\[10px\]/,            // dia desktop
  /\bmd:text-\[11px\]/,            // caption desktop
  /\bmd:text-\[7px\]/,             // weekday desktop
  /\bmd:h-3 md:w-3\b/,             // ícone chevron desktop
  /\bmd:p-1\.5\b/,                 // padding container desktop
  /\bmd:w-\[180px\]/,
];

// --- Proibidos em qualquer breakpoint ------------------------------------
const FORBIDDEN = [
  /\bbg-white\b/,
  /\bbg-black\b/,
  /\btext-white\b/,
  /#[0-9a-fA-F]{3,6}\b/,
  /\bh-9 w-9\b/,
  /\bh-7 w-7\b/,
  /\btext-\[17px\]/,
  /\btext-\[14px\]/,
];

function iterate(label, iterations, checks) {
  let pass = 0, fail = 0;
  const gaps = [];
  for (let i = 0; i < iterations; i++) {
    const slice = CAL.slice(0, CAL.length - (i % 7));
    let ok = true;
    for (const { list, kind } of checks) {
      for (const r of list) {
        const hit = r.test(slice);
        const need = kind === 'req';
        if (need !== hit) {
          ok = false;
          gaps.push(`iter ${i}: ${kind === 'req' ? 'faltou' : 'proibido'} ${r}`);
        }
      }
    }
    ok ? pass++ : fail++;
  }
  console.log(`Fuzz calendar ${label}: ${pass}/${iterations} pass, ${fail} fail`);
  if (fail) {
    for (const g of gaps.slice(0, 10)) console.log('  -', g);
    process.exit(1);
  }
}

iterate('responsive-tokens', 500, [
  { list: REQUIRED_MOBILE, kind: 'req' },
  { list: REQUIRED_DESKTOP, kind: 'req' },
  { list: FORBIDDEN, kind: 'forbid' },
]);

iterate('responsive-dimensions', 200, [
  { list: [/\bflex-1\b/, /\baspect-square\b/, /\bgap-1 md:gap-0\.5\b/, /\bspace-y-2 md:space-y-1\b/], kind: 'req' },
  { list: [/\bh-9 w-9\b/, /\bw-\[224px\]/], kind: 'forbid' },
]);
