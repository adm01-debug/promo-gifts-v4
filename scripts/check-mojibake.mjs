#!/usr/bin/env node
/**
 * check-mojibake.mjs
 *
 * Detecta sequências de bytes típicas de mojibake (UTF-8 decodificado como
 * Latin-1 e re-encodado como UTF-8) em arquivos do repositório.
 *
 * Causa-raiz histórica: editor/ferramenta gravando arquivo já em UTF-8 como
 * se fosse Latin-1, gerando double-encoding. PR #294 corrigiu 22 arquivos;
 * em maio/2026 voltaram 12 arquivos via merge de branches paralelas. Este
 * guard impede nova regressão.
 *
 * Exit code 0 se limpo, 1 se encontrou mojibake.
 */
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const MOJIBAKE_RE =
  /Ã[§£ª©¡­³º¢´¨ ‡‰ƒŠš]|â€[¢""''""–—]|Â[°¡¿²³]|âˆ[ž∑∏]/;

const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html']);
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.vercel',
  'coverage', '.turbo', 'supabase/.branches', '.husky',
]);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (EXTS.has(extname(entry.name))) {
      yield full;
    }
  }
}

const ROOT = process.argv[2] || 'src';
const hits = [];

try {
  const stat = statSync(ROOT);
  const files = stat.isDirectory() ? [...walk(ROOT)] : [ROOT];

  for (const f of files) {
    try {
      const content = readFileSync(f, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (MOJIBAKE_RE.test(line)) {
          const sample = line.length > 100 ? line.slice(0, 100) + '…' : line;
          hits.push({ file: f, line: i + 1, sample: sample.trim() });
        }
      });
    } catch (err) { /* segue */ }
  }
} catch (err) {
  console.error(`❌ Falha ao acessar ${ROOT}: ${err.message}`);
  process.exit(2);
}

if (hits.length === 0) {
  console.log('✅ Nenhum mojibake encontrado.');
  process.exit(0);
}

console.error(`❌ Mojibake detectado em ${hits.length} ocorrência(s):\n`);
for (const h of hits.slice(0, 50)) {
  console.error(`  ${h.file}:${h.line}`);
  console.error(`    ${h.sample}`);
}
if (hits.length > 50) {
  console.error(`\n  ... e mais ${hits.length - 50} ocorrência(s)`);
}
console.error('\n💡 Correção: editor abrindo arquivo como Latin-1 e salvando como UTF-8.');
process.exit(1);
