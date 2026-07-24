#!/usr/bin/env node
/**
 * Validação automatizada da lista de Orçamentos (QuotesConfigurableList).
 *
 * Roda em ordem:
 *   1. Invariantes estáticas de layout (ordem, alinhamento, testids, aria-label)
 *   2. Type-check TypeScript (tsgo)
 *   3. Vitest — suite de expiração e suites correlatas
 *
 * Saída: relatório JSON em /tmp/quotes-list-validation-report.json + resumo no stdout.
 * Exit code: 0 quando tudo passa, 1 em qualquer falha.
 *
 * Uso: node scripts/validate-quotes-list.mjs
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const REPORT_PATH = '/tmp/quotes-list-validation-report.json';
const report = { startedAt: new Date().toISOString(), steps: [] };

function step(name, fn) {
  const t0 = Date.now();
  try {
    const detail = fn();
    const entry = { name, status: 'pass', ms: Date.now() - t0, detail };
    report.steps.push(entry);
    console.log(`✅ ${name}  (${entry.ms}ms)`);
    return true;
  } catch (err) {
    const entry = { name, status: 'fail', ms: Date.now() - t0, error: String(err.message ?? err) };
    report.steps.push(entry);
    console.log(`❌ ${name}\n   ${entry.error.split('\n').slice(0, 8).join('\n   ')}`);
    return false;
  }
}

// ─── 1. Invariantes estáticas ────────────────────────────────────────────────
const staticOk = step('Invariantes estáticas de layout', () => {
  const list = fs.readFileSync('src/components/quotes/QuotesConfigurableList.tsx', 'utf8');
  const cell = fs.readFileSync('src/components/quotes/QuoteListCellRenderer.tsx', 'utf8');

  const assertions = [];
  const must = (label, cond, detail = '') => {
    assertions.push({ label, pass: !!cond, detail });
    if (!cond) throw new Error(`${label} — ${detail}`);
  };

  const orderMatch = list.match(/ALL_COLUMNS[^=]*=\s*\[([\s\S]*?)\];/);
  if (!orderMatch) throw new Error('ALL_COLUMNS não encontrado');
  const ids = [...orderMatch[1].matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
  const EXPECTED = [
    'client', 'contact', 'date', 'delivery', 'items',
    'value', 'status', 'expiration', 'quote_number',
  ];
  must('Ordem canônica das colunas', JSON.stringify(ids) === JSON.stringify(EXPECTED), `got=${ids.join(',')}`);

  const aligns = [...orderMatch[1].matchAll(/id:\s*'([^']+)'[^}]*align:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);
  must('Nenhuma coluna align:right', !aligns.some(([, a]) => a === 'right'));
  must("items + expiration centralizados",
    aligns.filter(([, a]) => a === 'center').map(([id]) => id).sort().join(',') === 'expiration,items');

  must("Header items com pr-4", /col\.id === 'items' && 'pr-4'/.test(list));
  must('Header com data-testid + role + aria-label',
    /data-testid=\{`quotes-col-header-\$\{col\.id\}`\}/.test(list) &&
    /role="columnheader"/.test(list) &&
    /aria-label=\{`Coluna \$\{col\.label\}`\}/.test(list));
  must('Cell com data-testid + role + aria-label',
    /data-testid=\{`quotes-col-cell-\$\{col\.id\}`\}/.test(list) &&
    /role="cell"/.test(list));
  must('Row testid', /data-testid=\{quoteId \? `quote-row-\$\{quoteId\}`/.test(list));

  const valueCase = cell.match(/case 'value':[\s\S]{0,200}?<span[^>]*className="([^"]+)"/);
  must("'value' renderer SEM text-right", valueCase && !/text-right/.test(valueCase[1]));

  const qnCase = cell.match(/case 'quote_number':[\s\S]{0,200}?<span[^>]*className="([^"]+)"/);
  must("'quote_number' renderer text-left + pl-8",
    qnCase && /text-left/.test(qnCase[1]) && /pl-8/.test(qnCase[1]));

  const delCase = cell.match(/case 'delivery':[\s\S]{0,400}?<span[^>]*className="([^"]+)"/);
  must("'delivery' renderer com pl-4", delCase && /pl-4/.test(delCase[1]));

  must("'expiration' renderer testid + aria",
    /data-testid="quote-expiration-cell"/.test(cell) &&
    /aria-label=\{`\$\{label\}\. Válido até /.test(cell));

  return { invariants: assertions.length, all: 'pass' };
});

// ─── 2. Type-check ──────────────────────────────────────────────────────────
const tsOk = step('Type-check (tsgo)', () => {
  const out = execSync(
    'npx tsgo --noEmit 2>&1 | grep -E "QuotesConfigurableList|QuoteListCellRenderer|lib/quotes/expiration" || true',
    { encoding: 'utf8', stdio: 'pipe' },
  );
  if (out.trim()) throw new Error(out);
  return { errors: 0 };
});

// ─── 3. Vitest — expiração ──────────────────────────────────────────────────
const vitestOk = step('Vitest · src/lib/quotes/__tests__/expiration.test.ts', () => {
  const raw = execSync(
    'npx vitest run src/lib/quotes/__tests__/expiration.test.ts --reporter=dot 2>&1',
    { encoding: 'utf8', stdio: 'pipe' },
  );
  // Remove códigos ANSI de cor antes de fazer match.
  const out = raw.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  const m = out.match(/Tests\s+(\d+)\s+passed/);
  const failed = /\bfailed\b/i.test(out) && !/0\s+failed/i.test(out);
  if (!m || failed) throw new Error(out.split('\n').slice(-15).join('\n'));
  return { passed: Number(m[1]) };
});

// ─── Relatório ───────────────────────────────────────────────────────────────
report.finishedAt = new Date().toISOString();
report.ok = staticOk && tsOk && vitestOk;
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

console.log('\n────────────────────────────────────────');
console.log(`Relatório salvo em ${REPORT_PATH}`);
console.log(`Resultado: ${report.ok ? '✅ TUDO OK' : '❌ FALHAS'}`);
process.exit(report.ok ? 0 : 1);
