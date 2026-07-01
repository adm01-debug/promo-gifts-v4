#!/usr/bin/env node
/**
 * list-migration-drafts.mjs
 *
 * Lê `qa/migrations-draft/*.sql`, extrai o cabeçalho (OBJETIVO/ALVO) e reescreve
 * o bloco entre `<!-- BEGIN:DRAFT-INDEX -->` e `<!-- END:DRAFT-INDEX -->` no
 * `qa/migrations-draft/README.md` com uma tabela viva.
 *
 * Uso:
 *   node scripts/list-migration-drafts.mjs           # regenera
 *   node scripts/list-migration-drafts.mjs --check   # sai !=0 se README stale
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, 'qa', 'migrations-draft');
const README = join(DRAFT_DIR, 'README.md');
const BEGIN = '<!-- BEGIN:DRAFT-INDEX (gerado por scripts/list-migration-drafts.mjs) -->';
const END = '<!-- END:DRAFT-INDEX -->';

const check = process.argv.includes('--check');

function extractSummary(sql) {
  // Pega até ~25 linhas iniciais de comentário para inferir objetivo/alvo.
  const lines = sql.split('\n').slice(0, 40);
  const commentLines = [];
  for (const l of lines) {
    const t = l.trim();
    if (t.startsWith('--')) commentLines.push(t.replace(/^--\s?/, ''));
    else if (t === '' && commentLines.length) commentLines.push('');
    else if (commentLines.length) break;
  }
  const joined = commentLines.join(' ');

  const objetivo =
    /Objetivo:\s*([^.\n]+)/i.exec(joined)?.[1]?.trim() ||
    /Migra[cç][aã]o:\s*([^.\n]+)/i.exec(joined)?.[1]?.trim() ||
    /Causa:\s*([^.\n]+)/i.exec(joined)?.[1]?.trim() ||
    /Cria\s+(?:RPC\s+)?[`"]?([^\s`"]+)/i.exec(joined)?.[0]?.trim() ||
    commentLines.find((l) => l && !/^=+$/.test(l) && !/^-+$/.test(l))?.slice(0, 120) ||
    '(sem descrição no cabeçalho)';

  const alvo =
    /doufsxqlfjyuvxuezpln/.test(joined)
      ? 'canônico'
      : /pqpdolkaeqlyzpdpbizo/.test(joined)
        ? 'lovable-cloud'
        : '?';

  const risco = /RISCO:\s*ZERO/i.test(joined) ? 'zero' : /Risco:\s*([^.\n]+)/i.exec(joined)?.[1]?.trim() || '—';

  return {
    objetivo: objetivo.replace(/\s+/g, ' ').slice(0, 140),
    alvo,
    risco: risco.slice(0, 40),
  };
}

function main() {
  if (!existsSync(DRAFT_DIR)) {
    console.error(`[drafts] diretório inexistente: ${DRAFT_DIR}`);
    process.exit(1);
  }
  const files = readdirSync(DRAFT_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const rows = files.map((f) => {
    const sql = readFileSync(join(DRAFT_DIR, f), 'utf8');
    const { objetivo, alvo, risco } = extractSummary(sql);
    const hasValidation = existsSync(join(DRAFT_DIR, f.replace(/\.sql$/, '.VALIDATION.md')));
    return { file: f, objetivo, alvo, risco, hasValidation };
  });

  const generatedAt = new Date().toISOString();
  const table = [
    `_Atualizado em ${generatedAt} · ${rows.length} rascunho(s)._`,
    '',
    '| Arquivo | Objetivo | Alvo | Risco | Validação |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| \`${r.file}\` | ${r.objetivo} | ${r.alvo} | ${r.risco} | ${r.hasValidation ? '📎 `.VALIDATION.md`' : '—'} |`,
    ),
  ].join('\n');

  const block = `${BEGIN}\n${table}\n${END}`;

  const current = readFileSync(README, 'utf8');
  const re = new RegExp(`${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END}`, 'm');
  if (!re.test(current)) {
    console.error('[drafts] marcadores BEGIN/END não encontrados no README.');
    process.exit(1);
  }
  const next = current.replace(re, block);

  if (check) {
    // Compara ignorando a linha de timestamp `_Atualizado em ..._`, senão
    // --check falharia toda execução (o timestamp muda a cada rodada).
    const stripTs = (s) =>
      s.replace(/_Atualizado em [^_]+_/g, '_Atualizado em <ts>_');
    if (stripTs(next) !== stripTs(current)) {
      console.error('[drafts] README desatualizado. Rode: node scripts/list-migration-drafts.mjs');
      process.exit(1);
    }
    console.log('[drafts] README ok.');
    return;
  }


  writeFileSync(README, next);
  console.log(`[drafts] README atualizado com ${rows.length} rascunho(s).`);
}

main();
