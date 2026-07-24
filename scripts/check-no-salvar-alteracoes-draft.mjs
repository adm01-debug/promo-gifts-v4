#!/usr/bin/env node
/**
 * Gate: previne regressão de label "Salvar Alterações" em componentes/fluxos
 * relacionados a RASCUNHO de orçamento. O label canônico é "Salvar Rascunho".
 *
 * Escopo: apenas arquivos onde a string historicamente aparecia como CTA de
 * salvar rascunho (QuoteBuilderSummaryColumn, QuoteItemEditorSheet e os specs
 * associados). Isso mantém o gate estrito onde importa e evita ruído em
 * outros fluxos que legitimamente usam "Salvar Alterações" (ex.: perfil,
 * configurações genéricas).
 *
 * Uso: `node scripts/check-no-salvar-alteracoes-draft.mjs`
 *   Exit 0 = clean. Exit 1 = achou regressão de label.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BANNED = 'Salvar Alterações';

// Arquivos/pastas que representam o fluxo de rascunho.
const SCOPE = [
  'src/components/quotes/QuoteBuilderSummaryColumn.tsx',
  'src/components/quotes/QuoteItemEditorSheet.tsx',
  'src/components/quotes/__tests__',
  'src/pages/quotes',
  'e2e/quotes',
  'e2e/flows/pdf-dialog.spec.ts',
];

// Este próprio script é sempre allowlisted (menciona a string banida por design).
const ALLOWLIST = new Set(['scripts/check-no-salvar-alteracoes-draft.mjs']);

const existing = SCOPE.filter((p) => existsSync(p));
if (existing.length === 0) {
  console.log('ℹ️  Nenhum arquivo do escopo existe — nada a checar.');
  process.exit(0);
}

let hits = '';
try {
  hits = execSync(
    `rg -n --no-heading -F ${JSON.stringify(BANNED)} ${existing.map((p) => JSON.stringify(p)).join(' ')} 2>/dev/null || true`,
    { encoding: 'utf8' },
  );
} catch {
  /* rg sem matches */
}

const lines = hits
  .split('\n')
  .filter(Boolean)
  .filter((line) => {
    const file = line.split(':')[0];
    return !ALLOWLIST.has(file);
  });

if (lines.length > 0) {
  console.error(`❌ Regressão de label detectada: "${BANNED}" reapareceu em fluxo de rascunho.`);
  console.error('   Substitua por "Salvar Rascunho" nos arquivos abaixo:\n');
  for (const l of lines) console.error('   ' + l);
  console.error(
    '\nContexto: SSOT do label é "Salvar Rascunho" (aria-label + texto + testid quote-save-draft*).',
  );
  process.exit(1);
}

console.log('✅ Nenhuma ocorrência de "Salvar Alterações" nos fluxos de rascunho.');
