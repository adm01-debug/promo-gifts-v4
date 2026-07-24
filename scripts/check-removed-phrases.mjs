#!/usr/bin/env node
/**
 * Gate: garante que frases banidas NÃO reapareçam no código.
 * Exceção: este próprio arquivo + specs E2E que asseguram ausência.
 */
import { execSync } from 'node:child_process';

const BANNED = [
  'Modo de seleção ativo',
  'marque manualmente os orçamentos',
];

const ALLOWLIST = [
  'scripts/check-removed-phrases.mjs',
  'e2e/flows/04o-quotes-columns-always-visible.spec.ts',
];

let failed = false;
for (const phrase of BANNED) {
  let out = '';
  try {
    out = execSync(
      `rg -n --no-heading -F ${JSON.stringify(phrase)} src e2e tests scripts 2>/dev/null || true`,
      { encoding: 'utf8' },
    );
  } catch {
    /* rg sem matches */
  }
  const hits = out
    .split('\n')
    .filter(Boolean)
    .filter((line) => !ALLOWLIST.some((a) => line.startsWith(a + ':')));
  if (hits.length > 0) {
    failed = true;
    console.error(`❌ Frase banida encontrada: "${phrase}"`);
    hits.forEach((h) => console.error('   ' + h));
  }
}

if (failed) {
  console.error('\nRemova as ocorrências acima ou atualize a allowlist em scripts/check-removed-phrases.mjs.');
  process.exit(1);
}
console.log('✅ Nenhuma frase banida encontrada.');
