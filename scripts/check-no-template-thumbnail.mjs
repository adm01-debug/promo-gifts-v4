#!/usr/bin/env node
/**
 * CI gate: proíbe reintrodução do componente `TemplateThumbnail`.
 *
 * O componente foi deletado (decisão do PO — reduzir duplicidade com a
 * `PreviewSidebar` e o ruído visual do hero/DesignStep). Este gate:
 *
 *   1. Falha se o arquivo `src/pages/magazine/components/TemplateThumbnail.{ts,tsx}`
 *      voltar a existir.
 *   2. Falha se qualquer arquivo em `src/` (exceto testes que documentam a
 *      regra) importar `TemplateThumbnail` por caminho.
 *
 * Complementa o teste unitário em
 * `src/pages/magazine/components/__tests__/no-template-thumbnail.test.ts`
 * garantindo cobertura no pipeline mesmo quando a suíte unitária não roda.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const projectRoot = resolve(process.cwd());
const srcRoot = resolve(projectRoot, 'src');

const BANNED_FILES = [
  'src/pages/magazine/components/TemplateThumbnail.tsx',
  'src/pages/magazine/components/TemplateThumbnail.ts',
];

const ALLOWLIST = new Set([
  'src/pages/magazine/components/__tests__/no-template-thumbnail.test.ts',
]);

const IMPORT_RE = /from\s+['"][^'"]*TemplateThumbnail['"]/;

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const abs = join(dir, entry);
    const s = statSync(abs);
    if (s.isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(abs);
  }
  return out;
}

const errors = [];

for (const banned of BANNED_FILES) {
  if (existsSync(resolve(projectRoot, banned))) {
    errors.push(`arquivo banido reintroduzido: ${banned}`);
  }
}

for (const file of walk(srcRoot)) {
  const rel = relative(projectRoot, file).replaceAll('\\', '/');
  if (ALLOWLIST.has(rel)) continue;
  const content = readFileSync(file, 'utf8');
  if (IMPORT_RE.test(content)) {
    errors.push(`import proibido de TemplateThumbnail em: ${rel}`);
  }
}

if (errors.length > 0) {
  console.error('❌ check:no-template-thumbnail falhou:');
  for (const e of errors) console.error(`  • ${e}`);
  console.error('\nContexto: TemplateThumbnail foi removido por decisão do PO.');
  process.exit(1);
}

console.log('✅ check:no-template-thumbnail: nenhuma regressão detectada.');
