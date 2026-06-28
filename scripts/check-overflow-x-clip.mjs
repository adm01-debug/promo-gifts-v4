#!/usr/bin/env node
/**
 * Static gate: rejeita `overflow-x-hidden` no MainLayout e em estilos globais
 * que afetem <html>/<body>. `overflow-x: hidden` promove `overflow-y` para
 * `auto` (CSS spec) e quebra `position: sticky` da sidebar.
 *
 * Permitido: `overflow-x-clip` / `overflow-x: clip` / `overflow-x: visible`.
 *
 * Falha o CI se encontrar:
 *   - `overflow-x-hidden` em src/components/layout/MainLayout.tsx
 *   - `overflow-x: hidden` aplicado a `html` ou `body` em qualquer .css
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const violations = [];

// 1) MainLayout não pode ter overflow-x-hidden
const mainLayoutPath = 'src/components/layout/MainLayout.tsx';
const mainLayout = readFileSync(mainLayoutPath, 'utf8');
if (/overflow-x-hidden/.test(mainLayout)) {
  violations.push(
    `${mainLayoutPath}: usa "overflow-x-hidden" — substitua por "overflow-x-clip" (quebra sticky da sidebar).`,
  );
}

// 2) Varre src/**/*.css procurando html/body com overflow-x: hidden
const cssTargets = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (full.endsWith('.css')) cssTargets.push(full);
  }
}
walk('src');

const htmlBodyHiddenRx =
  /(html|body)[^{]*\{[^}]*overflow-x\s*:\s*hidden/gis;
for (const file of cssTargets) {
  const css = readFileSync(file, 'utf8');
  if (htmlBodyHiddenRx.test(css)) {
    violations.push(`${file}: html/body com "overflow-x: hidden" — use "clip" ou "visible".`);
  }
}

if (violations.length) {
  console.error('\n❌ Overflow-x gate falhou:\n');
  for (const v of violations) console.error('  • ' + v);
  console.error(
    '\nPor quê: overflow-x:hidden promove overflow-y para auto (CSS spec),\n' +
      'criando scroll container que anula position:sticky da <aside>.\n',
  );
  process.exit(1);
}

console.log('✅ Overflow-x gate OK — sticky da sidebar preservado.');
