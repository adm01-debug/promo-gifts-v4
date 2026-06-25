#!/usr/bin/env node
/**
 * Gate estático de acessibilidade do FAB "Novo Orçamento".
 * Bloqueia regressões nas garantias de a11y do botão flutuante em
 * `src/pages/quotes/QuotesListPage.tsx` sem precisar de browser.
 *
 * Verifica:
 *  - data-testid="quote-new-button"
 *  - aria-label="Novo orçamento"
 *  - className inclui focus-visible:ring, rounded-full, h-11, w-11
 *  - <TooltipContent> com copy "Criar novo orçamento em segundos"
 *  - <Button> renderizado dentro de <TooltipTrigger asChild>
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve('src/pages/quotes/QuotesListPage.tsx');
let src;
try {
  src = readFileSync(FILE, 'utf8');
} catch (err) {
  console.error(`[fab-a11y] Falha ao ler ${FILE}: ${err.message}`);
  process.exit(1);
}

const checks = [
  { name: 'data-testid', re: /data-testid=["']quote-new-button["']/ },
  { name: 'aria-label', re: /aria-label=["']Novo orçamento["']/ },
  { name: 'rounded-full', re: /rounded-full/ },
  { name: 'h-11', re: /\bh-11\b/ },
  { name: 'w-11', re: /\bw-11\b/ },
  { name: 'focus-visible:ring', re: /focus-visible:ring(-\d|\b)/ },
  { name: 'TooltipTrigger asChild', re: /<TooltipTrigger\s+asChild>/ },
  {
    name: 'TooltipContent + copy comercial',
    re: /<TooltipContent[\s\S]{0,200}Criar novo orçamento em segundos[\s\S]{0,80}<\/TooltipContent>/,
  },
];

const failures = checks.filter((c) => !c.re.test(src));
if (failures.length > 0) {
  console.error('[fab-a11y] ❌ Regressão de acessibilidade no FAB Novo Orçamento:');
  for (const f of failures) {
    console.error(`  - faltando/alterado: ${f.name} (regex ${f.re})`);
  }
  console.error(`\nArquivo: ${FILE}`);
  process.exit(1);
}

console.log('[fab-a11y] ✅ FAB Novo Orçamento OK (8/8 contratos de a11y).');
