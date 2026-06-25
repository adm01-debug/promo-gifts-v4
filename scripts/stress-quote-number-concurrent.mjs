#!/usr/bin/env node
/**
 * stress-quote-number-concurrent
 *
 * Stress de concorrência para validar que o trigger `generate_quote_number`
 * + `UNIQUE INDEX uniq_quotes_quote_number` impedem qualquer colisão de
 * `quote_number` mesmo sob centenas de inserts simultâneos no MESMO ano.
 *
 * RODAR APENAS EM STAGING. Insere dados reais na tabela `public.quotes`.
 *
 * Estratégia:
 *  1. Abre N conexões paralelas (default 50) ao banco.
 *  2. Cada conexão insere M quotes (default 20) com `quote_number = NULL`
 *     — o trigger gera o número.
 *  3. Ao final: confere unicidade (zero duplicidade), continuidade da
 *     sequência (gaps ≤ 0) e que o total inserido bate.
 *  4. Faz `DELETE` do que foi inserido (marca via coluna `metadata` ou
 *     prefixo configurável) — opcional via `--keep`.
 *
 * Uso:
 *   node scripts/stress-quote-number-concurrent.mjs \
 *     --connections 50 --per-conn 20 [--keep]
 *
 * Requer: PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE apontando para STAGING.
 *
 * Exit code:
 *   0 = zero colisões, zero gaps inesperados
 *   1 = qualquer falha (colisão, erro de insert, gap suspeito)
 */
import pg from 'pg';
import { argv, env, exit } from 'node:process';

const args = Object.fromEntries(
  argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) {
      const k = a.replace(/^--/, '');
      const v = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true';
      acc.push([k, v]);
    }
    return acc;
  }, []),
);

const CONNECTIONS = Number(args.connections ?? 50);
const PER_CONN = Number(args['per-conn'] ?? 20);
const KEEP = args.keep === 'true';
const TAG = `stress-${Date.now()}`;

if (!env.PGHOST || !env.PGDATABASE) {
  console.error('✘ PGHOST/PGDATABASE ausentes. Aponte para STAGING.');
  exit(1);
}

// Guarda dura: nunca rodar contra prod canônico.
const FORBIDDEN_HOSTS = (env.STRESS_FORBIDDEN_HOSTS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (FORBIDDEN_HOSTS.some((h) => env.PGHOST.includes(h))) {
  console.error(`✘ PGHOST=${env.PGHOST} bate com STRESS_FORBIDDEN_HOSTS. Abortando.`);
  exit(1);
}

const cfg = {
  host: env.PGHOST,
  port: Number(env.PGPORT ?? 5432),
  user: env.PGUSER,
  password: env.PGPASSWORD,
  database: env.PGDATABASE,
  ssl: env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
};

const total = CONNECTIONS * PER_CONN;
console.log(
  `▶ stress quote_number: ${CONNECTIONS} conexões × ${PER_CONN} inserts = ${total} quotes (tag=${TAG})`,
);

const yy = String(new Date().getFullYear() % 100).padStart(2, '0');

// Captura MAX antes para validar gaps depois.
const ctlClient = new pg.Client(cfg);
await ctlClient.connect();
const before = await ctlClient.query(
  `SELECT COALESCE(MAX(split_part(quote_number,'/',1)::int), 10000) AS m
     FROM public.quotes WHERE quote_number LIKE '%/' || $1`,
  [yy],
);
const baseMax = Number(before.rows[0].m);
console.log(`  baseline MAX(${yy}) = ${baseMax} → esperado: ${baseMax + 1}..${baseMax + total}`);

// Descobre colunas obrigatórias mínimas (defensivo: schemas variam).
const cols = await ctlClient.query(`
  SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='quotes'
`);
const required = cols.rows
  .filter((c) => c.is_nullable === 'NO' && !c.column_default && c.column_name !== 'quote_number')
  .map((c) => c.column_name);
console.log('  colunas NOT NULL sem default:', required.join(', ') || '(nenhuma)');

const insertSql = `INSERT INTO public.quotes (${['quote_number', ...required, 'metadata']
  .filter((x, i, a) => a.indexOf(x) === i)
  .join(',')}) VALUES (NULL${required.map((_, i) => `, $${i + 1}`).join('')}, $${required.length + 1}::jsonb) RETURNING id, quote_number`;

// Placeholder values para colunas required (heurística simples).
const placeholderFor = (name) => {
  if (name.endsWith('_id') || name === 'id') return '00000000-0000-0000-0000-000000000000';
  if (name.includes('status')) return 'draft';
  if (name.includes('total') || name.includes('value') || name.includes('amount')) return 0;
  return 'stress';
};
const reqValues = required.map(placeholderFor);

async function worker(workerId) {
  const c = new pg.Client(cfg);
  await c.connect();
  const out = [];
  for (let i = 0; i < PER_CONN; i++) {
    try {
      const r = await c.query(insertSql, [
        ...reqValues,
        JSON.stringify({ stress_tag: TAG, worker: workerId, seq: i }),
      ]);
      out.push(r.rows[0]);
    } catch (e) {
      out.push({ error: e.code || e.message });
    }
  }
  await c.end();
  return out;
}

const t0 = Date.now();
const results = (await Promise.all(Array.from({ length: CONNECTIONS }, (_, i) => worker(i)))).flat();
const dt = Date.now() - t0;

const ok = results.filter((r) => !r.error);
const errs = results.filter((r) => r.error);
console.log(`  inseridos: ${ok.length}/${total} em ${dt}ms`);

// Análise
const nums = ok.map((r) => r.quote_number);
const unique = new Set(nums);
const collisions = nums.length - unique.size;

const seqsThisYear = nums
  .filter((q) => q && q.endsWith(`/${yy}`))
  .map((q) => Number(q.split('/')[0]))
  .sort((a, b) => a - b);

const gaps = seqsThisYear.length
  ? seqsThisYear[seqsThisYear.length - 1] - seqsThisYear[0] + 1 - seqsThisYear.length
  : 0;

const code23505 = errs.filter((e) => e.error === '23505').length;

console.log(`\n━━━ Resultado ━━━`);
console.log(`  total inserts pedidos: ${total}`);
console.log(`  sucesso:               ${ok.length}`);
console.log(`  erros (qualquer):      ${errs.length}`);
console.log(`    └ 23505 unique_violation: ${code23505}`);
console.log(`  colisões em quote_number: ${collisions}  ${collisions === 0 ? '✔' : '✘'}`);
console.log(`  gaps na sequência:      ${gaps}  ${gaps === 0 ? '✔' : '⚠'}`);

if (KEEP) {
  console.log(`\n(--keep) registros mantidos. Para limpar:`);
  console.log(`  DELETE FROM public.quotes WHERE metadata->>'stress_tag' = '${TAG}';`);
} else {
  const del = await ctlClient.query(
    `DELETE FROM public.quotes WHERE metadata->>'stress_tag' = $1`,
    [TAG],
  );
  console.log(`\n  cleanup: ${del.rowCount} linhas removidas (tag=${TAG})`);
}
await ctlClient.end();

const fail = collisions > 0 || code23505 > 0 || ok.length !== total;
if (fail) {
  console.error(`\n✘ STRESS FALHOU — investigar advisory_lock / UNIQUE INDEX`);
  exit(1);
}
console.log(`\n✔ STRESS OK — ${ok.length} quotes sem colisão sob ${CONNECTIONS} conexões paralelas`);
