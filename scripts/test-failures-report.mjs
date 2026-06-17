#!/usr/bin/env node
/**
 * Lê um log do vitest (passado por argv[2] ou stdin) e gera um Markdown
 * categorizado das falhas por arquivo + categoria + total de testes.
 *
 * Uso:
 *   npm run test:run > /tmp/full-test.log 2>&1 ; node scripts/test-failures-report.mjs /tmp/full-test.log > qa/TEST_FAILURES.md
 */
import fs from 'node:fs';

const path = process.argv[2];
const raw = path ? fs.readFileSync(path, 'utf8') : fs.readFileSync(0, 'utf8');
const plain = raw.replace(/\x1B\[[0-9;]*[mK]/g, '');

const lineRe = /^\s*❯\s+(\S+)\s+\((\d+)\s+tests?[^|]*\|\s+(\d+)\s+failed/gm;
const rows = new Map();
for (const m of plain.matchAll(lineRe)) {
  const [, file, total, failed] = m;
  rows.set(file, { file, total: +total, failed: +failed });
}

const categorize = (f) => {
  if (f.includes('tests/edge-functions/live/')) return 'Edge Functions (live)';
  if (f.includes('tests/rls/')) return 'RLS (live DB)';
  if (f.includes('tests/security/')) return 'Segurança / authz';
  if (f.includes('tests/admin/')) return 'Admin / snapshots';
  if (f.includes('tests/hooks/') || f.includes('hooks/')) return 'Hooks';
  if (f.includes('tests/components/') || f.includes('components/')) return 'Componentes';
  if (f.includes('tests/pages/') || f.includes('pages/')) return 'Páginas';
  if (f.includes('tests/lib/') || f.includes('lib/')) return 'Libs';
  if (f.includes('tests/observability/')) return 'Observabilidade';
  if (f.includes('tests/integration/')) return 'Integração';
  return 'Outros';
};

const PRIORITY = {
  'Segurança / authz': 'P0',
  'RLS (live DB)': 'P0',
  'Edge Functions (live)': 'P2',
  Hooks: 'P1',
  Componentes: 'P1',
  Páginas: 'P1',
  Libs: 'P1',
  Admin: 'P2',
  'Admin / snapshots': 'P2',
  Observabilidade: 'P2',
  Integração: 'P1',
  Outros: 'P2',
};

const byCat = new Map();
let totFiles = 0, totFailed = 0, totTests = 0;
for (const r of rows.values()) {
  const cat = categorize(r.file);
  if (!byCat.has(cat)) byCat.set(cat, []);
  byCat.get(cat).push(r);
  totFiles += 1; totFailed += r.failed; totTests += r.total;
}

const order = [...byCat.keys()].sort((a, b) => {
  const pa = PRIORITY[a] || 'P3', pb = PRIORITY[b] || 'P3';
  if (pa !== pb) return pa.localeCompare(pb);
  return b[1] - a[1];
});

const lines = [];
lines.push(`# Relatório de Falhas de Testes`, '');
lines.push(`Gerado em: ${new Date().toISOString()}`, '');
lines.push(`- Arquivos com falha: **${totFiles}**`);
lines.push(`- Testes falhando: **${totFailed}** / ${totTests} no escopo das suítes vermelhas`, '');
lines.push(`## Sumário por categoria`, '');
lines.push('| Prioridade | Categoria | Arquivos | Testes falhando |');
lines.push('|---|---|---:|---:|');
for (const cat of order) {
  const list = byCat.get(cat);
  const f = list.reduce((a, r) => a + r.failed, 0);
  lines.push(`| ${PRIORITY[cat] ?? 'P3'} | ${cat} | ${list.length} | ${f} |`);
}
lines.push('');

for (const cat of order) {
  const list = byCat.get(cat).sort((a, b) => b.failed - a.failed);
  lines.push(`## ${PRIORITY[cat] ?? 'P3'} — ${cat}`, '');
  lines.push('| Arquivo | Falhando | Total |');
  lines.push('|---|---:|---:|');
  for (const r of list) lines.push(`| \`${r.file}\` | ${r.failed} | ${r.total} |`);
  lines.push('');
}

process.stdout.write(lines.join('\n'));
