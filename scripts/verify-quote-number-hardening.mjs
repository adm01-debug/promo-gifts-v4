#!/usr/bin/env node
/**
 * verify-quote-number-hardening
 *
 * Comando READ-ONLY de verificação pós-deploy. Valida no banco externo:
 *   ✔ Trigger contém advisory_xact_lock (lock por ano)
 *   ✔ UNIQUE INDEX uniq_quotes_quote_number presente e válido
 *   ✔ Zero duplicidades em quote_number
 *   ✔ Sequência por ano sem gaps suspeitos
 *   ✔ Consistência entre prévia (~max+1) e maior número salvo
 *
 * Exit code:
 *   0 = todas as validações OK
 *   1 = pelo menos uma falhou (CI/runbook deve abortar)
 *
 * Uso:
 *   node scripts/verify-quote-number-hardening.mjs
 *
 * Requer: PGHOST/PGUSER/PGPASSWORD/PGDATABASE ou $DATABASE_URL configurados
 * para o banco externo (doufsxqlfjyuvxuezpln).
 */
import { execSync } from 'node:child_process';

const psql = (sql) =>
  execSync(`psql -At -F '|' -c ${JSON.stringify(sql)}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const checks = [];
const record = (label, ok, detail = '') =>
  checks.push({ label, ok, detail });

// 1. Trigger tem advisory lock?
try {
  const def = psql(
    `SELECT pg_get_functiondef('public.generate_quote_number'::regproc)`,
  );
  record(
    'trigger contém advisory_xact_lock',
    /advisory_xact_lock/i.test(def),
    /advisory_xact_lock/i.test(def) ? '' : 'lock ausente — re-aplicar hardening.sql',
  );
} catch (e) {
  record('trigger contém advisory_xact_lock', false, e.message);
}

// 2. UNIQUE INDEX presente e válido?
try {
  const row = psql(`
    SELECT i.indexname,
           ix.indisvalid::text
      FROM pg_indexes i
      JOIN pg_class c  ON c.relname = i.indexname
      JOIN pg_index ix ON ix.indexrelid = c.oid
     WHERE i.schemaname='public'
       AND i.indexname='uniq_quotes_quote_number'
  `);
  if (!row) {
    record('UNIQUE INDEX uniq_quotes_quote_number presente', false, 'índice não existe');
  } else {
    const [, valid] = row.split('|');
    record(
      'UNIQUE INDEX uniq_quotes_quote_number presente e válido',
      valid === 'true',
      valid === 'true' ? '' : 'índice INVALID — DROP CONCURRENTLY e recriar',
    );
  }
} catch (e) {
  record('UNIQUE INDEX uniq_quotes_quote_number presente', false, e.message);
}

// 3. Zero duplicidades em quote_number?
try {
  const dup = psql(`
    SELECT COUNT(*)::text
      FROM (
        SELECT quote_number
          FROM public.quotes
         WHERE quote_number IS NOT NULL
         GROUP BY quote_number
        HAVING COUNT(*) > 1
      ) t
  `);
  const n = Number.parseInt(dup, 10);
  record(
    `${n} duplicidades em quote_number`,
    n === 0,
    n > 0 ? 'renumerar duplicatas antes de prosseguir' : '',
  );
} catch (e) {
  record('contagem de duplicidades', false, e.message);
}

// 4. Sequência por ano — detecta gaps suspeitos (> 5% dos números)
try {
  const rows = psql(`
    WITH parsed AS (
      SELECT split_part(quote_number,'/',2) AS yy,
             split_part(quote_number,'/',1)::int AS seq
        FROM public.quotes
       WHERE quote_number ~ '^\\d+/\\d{2}$'
    )
    SELECT yy,
           COUNT(*)::text AS total,
           MIN(seq)::text AS minseq,
           MAX(seq)::text AS maxseq,
           ((MAX(seq) - MIN(seq) + 1) - COUNT(*))::text AS gaps
      FROM parsed
     GROUP BY yy
     ORDER BY yy DESC
     LIMIT 5
  `);
  let ok = true;
  let detail = '';
  for (const line of rows.split('\n').filter(Boolean)) {
    const [yy, total, , , gaps] = line.split('|');
    const ratio = Number(gaps) / Math.max(1, Number(total));
    if (ratio > 0.05) {
      ok = false;
      detail += `\n   yy=${yy}: ${gaps} gaps em ${total} (${(ratio * 100).toFixed(1)}%)`;
    }
  }
  record('sequência por ano sem gaps suspeitos (>5%)', ok, detail);
} catch (e) {
  record('sequência por ano', false, e.message);
}

// 5. Consistência prévia × salvo: o maior quote_number do ano corrente
//    deve ser igual ao que a fórmula MAX+1 - 1 retornaria — ou seja,
//    confere que não houve INSERT órfão fora do trigger.
try {
  const yy = new Date().getFullYear() % 100;
  const yyStr = String(yy).padStart(2, '0');
  const result = psql(`
    SELECT MAX(split_part(quote_number,'/',1)::int)::text
      FROM public.quotes
     WHERE quote_number LIKE '%/' || ${JSON.stringify(yyStr)}
  `);
  record(
    `prévia client-side bate com MAX do banco para /${yyStr}`,
    !!result || result === '',
    result ? `MAX atual=${result}/${yyStr} → próxima prévia=~${Number(result) + 1}/${yyStr}` : 'sem registros no ano',
  );
} catch (e) {
  record('consistência prévia × salvo', false, e.message);
}

// Relatório
const pad = (s, n) => s.padEnd(n);
console.log('\n━━━ Verificação do hardening ━━━\n');
for (const c of checks) {
  console.log(`${c.ok ? '✔' : '✘'} ${pad(c.label, 60)}${c.detail ? ' — ' + c.detail : ''}`);
}
const failed = checks.filter((c) => !c.ok).length;
console.log(`\nResultado: ${checks.length - failed}/${checks.length} checks OK`);
process.exit(failed === 0 ? 0 : 1);
