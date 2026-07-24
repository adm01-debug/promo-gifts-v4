#!/usr/bin/env node
/**
 * stress-quote-number-concurrent
 *
 * Stress de concorrência para validar que `generate_quote_number` +
 * `UNIQUE INDEX uniq_quotes_quote_number` impedem qualquer colisão de
 * `quote_number` mesmo sob centenas de inserts simultâneos no MESMO ano.
 *
 * RODAR APENAS EM STAGING — insere e (por padrão) remove linhas reais.
 *
 * Estratégia:
 *   - Dispara N processos `psql` em paralelo (default 50).
 *   - Cada um roda M inserts (default 20) com `quote_number = NULL`
 *     dentro de transações independentes — o trigger gera o número.
 *   - Marca cada linha com `metadata->>'stress_tag'` p/ cleanup determinístico.
 *   - Audita: zero duplicidade, zero gap inesperado, sem erro 23505 não
 *     compensado.
 *
 * Uso:
 *   node scripts/stress-quote-number-concurrent.mjs \
 *     --connections 50 --per-conn 20 [--keep]
 *
 * Requer: PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE apontando para STAGING
 * e `psql` no PATH. Sem dependências npm extras (usa o cliente do sistema).
 *
 * Exit code:
 *   0 = zero colisões, total inserido == pedido
 *   1 = qualquer divergência (colisão, erro, cleanup falhou)
 */
import { spawn } from 'node:child_process';
import { env, argv, exit } from 'node:process';

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
const TOTAL = CONNECTIONS * PER_CONN;

if (!env.PGHOST || !env.PGDATABASE) {
  console.error('✘ PGHOST/PGDATABASE ausentes. Aponte para STAGING.');
  exit(1);
}

// Guarda dura: lista de hosts proibidos via env (ex.: o canônico de produção).
const forbidden = (env.STRESS_FORBIDDEN_HOSTS ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);
if (forbidden.some((h) => env.PGHOST.includes(h))) {
  console.error(`✘ PGHOST=${env.PGHOST} bate com STRESS_FORBIDDEN_HOSTS. Abortando.`);
  exit(1);
}

const psql = (sql) =>
  new Promise((resolve) => {
    const p = spawn('psql', ['-At', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
      env,
    });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });

const yy = String(new Date().getFullYear() % 100).padStart(2, '0');

console.log(`▶ stress quote_number — ${CONNECTIONS} conexões × ${PER_CONN} inserts = ${TOTAL} (tag=${TAG})`);

// Descobre colunas NOT NULL sem default (defensivo p/ schemas que variam).
const colsRes = await psql(`
  SELECT string_agg(column_name, ',') FROM information_schema.columns
   WHERE table_schema='public' AND table_name='quotes'
     AND is_nullable='NO' AND column_default IS NULL
     AND column_name NOT IN ('quote_number','id','created_at','updated_at')
`);
if (colsRes.code !== 0) {
  console.error('✘ não consegui inspecionar schema:', colsRes.err);
  exit(1);
}
const required = (colsRes.out || '').split(',').filter(Boolean);
console.log('  colunas NOT NULL sem default:', required.join(', ') || '(nenhuma)');

// Baseline MAX do ano corrente.
const baseRes = await psql(`
  SELECT COALESCE(MAX(split_part(quote_number,'/',1)::int), 10000)
    FROM public.quotes WHERE quote_number LIKE '%/${yy}'
`);
const baseMax = Number(baseRes.out || 10000);
console.log(`  baseline MAX(/${yy}) = ${baseMax}`);

// Monta INSERT genérico — valores placeholder mínimos.
const placeholder = (name) => {
  if (name === 'org_id' || name.endsWith('_id')) return `'00000000-0000-0000-0000-000000000000'::uuid`;
  if (name.includes('status')) return `'draft'`;
  if (name.includes('total') || name.includes('amount') || name.includes('value')) return `0`;
  return `'stress'`;
};
const colList = ['quote_number', ...required, 'metadata'];
const valList = ['NULL', ...required.map(placeholder), `jsonb_build_object('stress_tag','${TAG}')`];
const insertSql = `INSERT INTO public.quotes (${colList.join(',')}) VALUES (${valList.join(',')}) RETURNING quote_number;`;

// Worker: PER_CONN inserts num único processo psql, sem transação envolvente
// (cada INSERT é sua própria tx → trigger dispara em paralelo real).
const worker = async (id) => {
  const batch = Array(PER_CONN).fill(insertSql).join('\n');
  const r = await psql(batch);
  if (r.code !== 0) return { id, ok: 0, errs: [r.err.split('\n').slice(0, 2).join(' | ')], nums: [] };
  const nums = r.out.split('\n').filter((l) => /^\d+\/\d{2}$/.test(l.trim()));
  const code23505 = (r.err.match(/duplicate key/g) || []).length;
  return { id, ok: nums.length, errs: code23505 ? [`23505 x${code23505}`] : [], nums };
};

const t0 = Date.now();
const results = await Promise.all(Array.from({ length: CONNECTIONS }, (_, i) => worker(i)));
const dt = Date.now() - t0;

const nums = results.flatMap((r) => r.nums);
const okN = nums.length;
const allErrs = results.flatMap((r) => r.errs);
const unique = new Set(nums);
const collisions = nums.length - unique.size;

const seqs = nums.filter((q) => q.endsWith(`/${yy}`)).map((q) => Number(q.split('/')[0])).sort((a, b) => a - b);
const gaps = seqs.length ? seqs[seqs.length - 1] - seqs[0] + 1 - seqs.length : 0;

console.log(`\n━━━ Resultado (${dt}ms) ━━━`);
console.log(`  pedidos:               ${TOTAL}`);
console.log(`  inseridos:             ${okN}`);
console.log(`  erros:                 ${allErrs.length}${allErrs.length ? ' → ' + allErrs.slice(0, 3).join(' ; ') : ''}`);
console.log(`  colisões quote_number: ${collisions}   ${collisions === 0 ? '✔' : '✘'}`);
console.log(`  gaps na sequência:     ${gaps}   ${gaps === 0 ? '✔' : '⚠'}`);
console.log(`  range /${yy}:             ${seqs[0] ?? '-'} .. ${seqs[seqs.length - 1] ?? '-'} (esperado ${baseMax + 1}..)`);

if (KEEP) {
  console.log(`\n(--keep) preservado. Limpar manualmente:`);
  console.log(`  DELETE FROM public.quotes WHERE metadata->>'stress_tag' = '${TAG}';`);
} else {
  const del = await psql(`DELETE FROM public.quotes WHERE metadata->>'stress_tag' = '${TAG}'`);
  console.log(`\n  cleanup: ${del.code === 0 ? 'OK' : '✘ FALHOU — ' + del.err}`);
  if (del.code !== 0) exit(1);
}

const fail = collisions > 0 || okN !== TOTAL;
if (fail) {
  console.error(`\n✘ STRESS FALHOU — verificar advisory_xact_lock + UNIQUE INDEX`);
  exit(1);
}
console.log(`\n✔ STRESS OK — ${okN}/${TOTAL} sem colisão sob ${CONNECTIONS} conexões paralelas`);
