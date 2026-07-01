#!/usr/bin/env node
/**
 * build-drafts-pr-comment.mjs
 *
 * Lê `qa/migrations-draft/DRAFTS_STATUS.md` e produz um corpo de comentário
 * de PR (`qa/migrations-draft/PR_COMMENT.md`) com destaque para:
 *
 *   🟡 "não promovido" — precisa decisão do PO (promover ou registrar ack)
 *   ❔ "sem acesso ao DB" — status não pôde ser consultado
 *
 * O comentário inclui um marker HTML fixo para que o workflow faça upsert
 * (atualiza o mesmo comentário em vez de criar N a cada push).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const IN = join(ROOT, 'qa', 'migrations-draft', 'DRAFTS_STATUS.md');
const OUT = join(ROOT, 'qa', 'migrations-draft', 'PR_COMMENT.md');
const REVIEWS = join(ROOT, 'qa', 'migrations-draft', 'REVIEWS.json');

export const MARKER = '<!-- drafts-status-comment:v1 -->';

if (!existsSync(IN)) {
  console.error(`[drafts-pr-comment] arquivo não encontrado: ${IN}`);
  process.exit(1);
}

const src = readFileSync(IN, 'utf8');

// Extrai linhas da tabela `| draft | slug | migration | status |`
const rowRe = /^\|\s*`([^`]+\.sql)`\s*\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/gm;
const rows = [];
for (const m of src.matchAll(rowRe)) {
  rows.push({ draft: m[1], slug: m[2], migration: m[3], status: m[4] });
}

const notPromoted = rows.filter((r) => r.status.includes('não promovido'));
const noDb = rows.filter((r) => r.status.includes('sem acesso ao DB') || r.status.startsWith('❔'));

// Carrega ledger de revisão p/ marcar quem já foi acknowledged.
let ackSet = new Set();
if (existsSync(REVIEWS)) {
  try {
    const data = JSON.parse(readFileSync(REVIEWS, 'utf8'));
    ackSet = new Set(
      (data?.acknowledged_not_promoted ?? [])
        .map((e) => (typeof e === 'string' ? e : e?.draft))
        .filter(Boolean),
    );
  } catch {
    /* ignora — o gate drafts:status:check já valida o JSON */
  }
}

function bullet(rowsList, kind) {
  if (rowsList.length === 0) return '_(nenhum)_';
  return rowsList
    .map((r) => {
      const ack = kind === 'not_promoted' && ackSet.has(r.draft) ? ' _(revisado ✍️)_' : '';
      return `- \`${r.draft}\`${ack}`;
    })
    .join('\n');
}

const header = [
  MARKER,
  '## 📋 Status dos rascunhos de migration',
  '',
  `**Resumo:** ${rows.length} rascunho(s) · ` +
    `${notPromoted.length} 🟡 não promovido · ${noDb.length} ❔ sem acesso ao DB`,
  '',
  '### 🟡 Não promovidos — requerem ação do PO',
  '',
  bullet(notPromoted, 'not_promoted'),
  '',
  notPromoted.length > 0
    ? '> Para cada draft acima: **promova** via `npm run draft:promote -- <arquivo> --apply` ' +
      '**ou** registre a revisão em `qa/migrations-draft/REVIEWS.json` ' +
      '(`acknowledged_not_promoted`). Sem uma dessas ações, o gate ' +
      '`drafts:status:check` bloqueia a PR.'
    : '> Nenhum draft pendente de promoção. ✅',
  '',
  '### ❔ Sem acesso ao DB — status indeterminado',
  '',
  bullet(noDb, 'no_db'),
  '',
  noDb.length > 0
    ? '> Configure `PGHOST/PGUSER/PGPASSWORD/PGDATABASE` como secrets do repo ' +
      'para que o workflow consiga consultar `supabase_migrations.schema_migrations` ' +
      'no banco canônico e classificar como ✅/🟠 em vez de ❔.'
    : '> DB canônico acessível. ✅',
  '',
  '<details><summary>📄 <code>DRAFTS_STATUS.md</code> completo</summary>',
  '',
  src,
  '',
  '</details>',
  '',
  `_Gerado por \`scripts/build-drafts-pr-comment.mjs\` em ${new Date().toISOString()}._`,
  '',
].join('\n');

writeFileSync(OUT, header);
console.log(
  `[drafts-pr-comment] ${OUT} gerado · ${notPromoted.length} 🟡 · ${noDb.length} ❔`,
);
