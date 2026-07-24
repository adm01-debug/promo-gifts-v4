#!/usr/bin/env node
/**
 * check-no-followup-frontend.mjs
 *
 * Bloqueia reintrodução acidental de "follow-up" no frontend (src/).
 * A feature `quote-followup-reminders` continua viva no backend (edge function +
 * tabela `follow_up_reminders`), mas o frontend foi expurgado dos termos
 * "follow-up", "followup" e `needsFollowUp` (em strings de UI, props, badges,
 * estados derivados). Qualquer nova ocorrência aqui deve passar por revisão.
 *
 * Exit 0 limpo; 1 se encontrar ocorrência.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = process.argv[2] || 'src';
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);
const SKIP_FILES = new Set([
  // tipo auto-gerado pelo Lovable a partir do schema (contém tabela follow_up_reminders)
  'src/integrations/supabase/types.ts',
  // teste que define o próprio guard — o arquivo contém a regex FORBIDDEN e descrições do teste
  'src/components/quotes/__tests__/QuotesStatusChips.no-followup.test.tsx',
]);

const PATTERN = /follow[-_]?up|needsFollowUp/i;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (EXTS.has(extname(entry.name)) && !SKIP_FILES.has(full.replace(/\\/g, '/'))) {
      yield full;
    }
  }
}

const hits = [];
try {
  const files = statSync(ROOT).isDirectory() ? [...walk(ROOT)] : [ROOT];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (PATTERN.test(line)) hits.push({ file: f, line: i + 1, sample: line.trim().slice(0, 120) });
    });
  }
} catch (err) {
  console.error(`❌ Falha ao escanear ${ROOT}: ${err.message}`);
  process.exit(2);
}

if (hits.length === 0) {
  console.log('✅ Nenhuma ocorrência de follow-up no frontend.');
  process.exit(0);
}

console.error(`❌ ${hits.length} ocorrência(s) de follow-up no frontend:\n`);
for (const h of hits.slice(0, 50)) {
  console.error(`  ${h.file}:${h.line}`);
  console.error(`    ${h.sample}`);
}
console.error('\n💡 O termo foi removido da UI. Use "retomar contato", "lembrete" ou similar.');
console.error('   Backend (quote-followup-reminders) permanece intocado — não migrar para o frontend.');
process.exit(1);
