#!/usr/bin/env node
/**
 * QA — Regressão automatizada do "preço read-only" em itens de orçamento.
 *
 * Executa verificações estáticas (grep/AST-lite) que cobrem os itens do
 * checklist `qa/QUOTE_ITEM_PRICE_READONLY_REGRESSION.md` que podem ser
 * validados sem subir o app:
 *
 *  1. Nenhum testid `quote-item-price-input` em código/specs (vetor antigo).
 *  2. `quote-item-price-display` existe em `QuoteItemsList` e em specs.
 *  3. `QuoteItemsList` não importa `CurrencyInput` no campo de preço.
 *  4. Trigger `trg_prevent_non_admin_quote_item_price_change` versionado em
 *     `supabase/migrations/`.
 *  5. Specs e2e críticos presentes:
 *       - `quote-item-price-immutable.spec.ts`
 *       - `quote-items-list-mobile-layout.spec.ts`
 *       - `quote-item-editor-sheet-header.spec.ts` (com bloco de tab order).
 *  6. Snapshots antigos `quote-items-list-inputs-row-{320,375,768}.png`
 *     NÃO estão no repo (foram removidos para regeneração via workflow).
 *
 * Os itens dinâmicos (cálculos em runtime, persistência, integrações CRM/PDF,
 * regeneração visual) ficam para o workflow `update-quote-reset-snapshots.yml`
 * e specs Playwright correspondentes.
 *
 * Uso: `node scripts/qa-price-readonly-regression.mjs`
 * Sai com código 1 em qualquer falha.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const fails = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  fails.push(msg);
  console.log(`  ✗ ${msg}`);
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'playwright-report', 'test-results'].includes(name)) continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

function read(p) {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
}

console.log('▶ Regressão preço read-only — checagens estáticas\n');

// 1. Nenhum testid antigo em código/specs
console.log('1) Testid antigo `quote-item-price-input` ausente');
{
  const files = walk(join(ROOT, 'src')).concat(walk(join(ROOT, 'e2e')));
  // Permite asserções de ausência (toHaveCount(0)) em specs — flagra apenas uso real.
  const offenders = files.filter((f) => {
    if (!/\.(t|j)sx?$/.test(f)) return false;
    const src = read(f);
    return src.split('\n').some((line) =>
      line.includes('quote-item-price-input') && !/toHaveCount\(\s*0\s*\)/.test(line),
    );
  });
  offenders.length === 0
    ? ok('nenhum uso ativo de `quote-item-price-input` (asserções de ausência ok)')
    : fail(`testid antigo ainda referenciado em: ${offenders.join(', ')}`);
}

// 2. Display read-only existe em QuoteItemsList
console.log('\n2) `quote-item-price-display` presente em QuoteItemsList');
{
  const p = join(ROOT, 'src/components/quotes/QuoteItemsList.tsx');
  const src = read(p);
  src.includes('quote-item-price-display')
    ? ok('QuoteItemsList expõe `quote-item-price-display`')
    : fail('QuoteItemsList.tsx não contém `quote-item-price-display`');
  /aria-readonly\s*=\s*["']true["']/.test(src)
    ? ok('aria-readonly="true" presente')
    : fail('aria-readonly="true" ausente no display');
}

// 3. CurrencyInput não é usado para preço editável em QuoteItemsList
console.log('\n3) `CurrencyInput` removido de QuoteItemsList');
{
  const src = read(join(ROOT, 'src/components/quotes/QuoteItemsList.tsx'));
  /import\s+[^;]*CurrencyInput/.test(src)
    ? fail('CurrencyInput ainda importado em QuoteItemsList.tsx')
    : ok('sem import de CurrencyInput');
}

// 4. Trigger versionado
console.log('\n4) Trigger antifraude versionado');
{
  const dir = join(ROOT, 'supabase/migrations');
  const found = existsSync(dir)
    ? readdirSync(dir).some((f) =>
        read(join(dir, f)).includes('trg_prevent_non_admin_quote_item_price_change'),
      )
    : false;
  found
    ? ok('trigger encontrado em supabase/migrations/')
    : fail('trigger `trg_prevent_non_admin_quote_item_price_change` não encontrado em migrations');
}

// 5. Specs críticos
console.log('\n5) Specs e2e críticos presentes');
{
  const specs = [
    'e2e/quotes/quote-item-price-immutable.spec.ts',
    'e2e/quotes/quote-items-list-mobile-layout.spec.ts',
    'e2e/quotes/quote-item-editor-sheet-header.spec.ts',
  ];
  for (const s of specs) {
    existsSync(join(ROOT, s)) ? ok(s) : fail(`spec ausente: ${s}`);
  }
  const header = read(join(ROOT, 'e2e/quotes/quote-item-editor-sheet-header.spec.ts'));
  header.includes('quote-item-price-display') && /Tab.*pre[çc]o/i.test(header)
    ? ok('header.spec cobre tab order ignorando preço')
    : fail('header.spec não cobre tab order do preço read-only');
}

// 6. Snapshots antigos removidos
console.log('\n6) Snapshots antigos removidos (aguardando regeneração no CI)');
{
  const dir = join(ROOT, 'e2e/quotes/quote-items-list-mobile-layout.spec.ts-snapshots');
  if (!existsSync(dir)) {
    ok('diretório de snapshots inexistente — será regenerado');
  } else {
    const stale = readdirSync(dir).filter((f) =>
      /^quote-items-list-inputs-row-(320|375|768)-/.test(f),
    );
    stale.length === 0
      ? ok('snapshots inputs-row antigos ausentes')
      : fail(`snapshots antigos ainda presentes: ${stale.join(', ')}`);
  }
}

console.log('\n────────────────────────────────────────');
if (fails.length) {
  console.log(`❌ ${fails.length} verificação(ões) falharam.`);
  console.log('Consulte qa/QUOTE_ITEM_PRICE_READONLY_REGRESSION.md para itens dinâmicos.');
  process.exit(1);
}
console.log('✅ Todas as checagens estáticas passaram.');
console.log('ℹ Para regenerar snapshots visuais, dispare o workflow:');
console.log('  .github/workflows/update-quote-reset-snapshots.yml');
