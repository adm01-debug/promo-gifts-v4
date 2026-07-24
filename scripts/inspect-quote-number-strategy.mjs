#!/usr/bin/env node
/**
 * inspect-quote-number-strategy
 *
 * Comando READ-ONLY que descreve, em runtime, como o número de orçamento
 * é gerado no banco externo (doufsxqlfjyuvxuezpln):
 *   - estratégia (MAX+1 vs sequence)
 *   - presença de lock (FOR UPDATE, advisory_lock)
 *   - escopo de unicidade (global, org_id, seller_id)
 *   - índices únicos em quote_number
 *   - quantidade de números duplicados existentes (gap detector)
 *
 * Uso:
 *   node scripts/inspect-quote-number-strategy.mjs
 *
 * Variáveis de ambiente:
 *   PGHOST/PGUSER/PGPASSWORD/PGDATABASE  (padrão psql)
 *   ou DATABASE_URL
 *
 * NÃO executa nenhum DDL nem DML — apenas SELECT em catálogo + agregações.
 */
import { execSync } from 'node:child_process';

const q = (sql) => {
  try {
    return execSync(`psql -At -F '|' -c ${JSON.stringify(sql)}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    return `ERR: ${err.message}`;
  }
};

const banner = (s) => console.log(`\n━━━ ${s} ━━━`);

banner('1. Definição do trigger generate_quote_number');
const fn = q(`SELECT pg_get_functiondef('public.generate_quote_number'::regproc)`);
console.log(fn);

const strategy = /nextval\s*\(/i.test(fn)
  ? 'sequence PG (nextval)'
  : /MAX\s*\(/i.test(fn)
    ? 'MAX+1 (computa no INSERT)'
    : 'desconhecida';
const hasForUpdate = /FOR\s+UPDATE/i.test(fn);
const hasAdvisory = /advisory_xact_lock|advisory_lock/i.test(fn);
const scope = /org_id/i.test(fn)
  ? 'por org_id'
  : /seller_id/i.test(fn)
    ? 'por seller_id'
    : 'global por ano';

banner('2. Diagnóstico inferido');
console.table({
  estrategia: strategy,
  lock_for_update: hasForUpdate,
  advisory_lock: hasAdvisory,
  escopo_unicidade: scope,
});

banner('3. Índices em quote_number');
console.log(
  q(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname='public' AND tablename='quotes'
       AND indexdef ILIKE '%quote_number%'`,
  ) || '(nenhum)',
);

banner('4. Constraints UNIQUE');
console.log(
  q(
    `SELECT conname, pg_get_constraintdef(oid)
       FROM pg_constraint
      WHERE conrelid='public.quotes'::regclass
        AND contype IN ('u','p')
        AND pg_get_constraintdef(oid) ILIKE '%quote_number%'`,
  ) || '(nenhuma)',
);

banner('5. Duplicidades existentes (gap detector)');
console.log(
  q(
    `SELECT quote_number, COUNT(*) AS qtd
       FROM public.quotes
      WHERE quote_number IS NOT NULL
      GROUP BY quote_number
     HAVING COUNT(*) > 1
      ORDER BY qtd DESC
      LIMIT 20`,
  ) || '✅ nenhuma duplicidade',
);

banner('6. Última sequência por ano');
console.log(
  q(
    `SELECT split_part(quote_number,'/',2) AS yy,
            COUNT(*) AS total,
            MIN(quote_number) AS min,
            MAX(quote_number) AS max
       FROM public.quotes
      WHERE quote_number ~ '^\\d+/\\d{2}$'
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 5`,
  ),
);

console.log('\n✔ Inspeção concluída (read-only).');
