#!/usr/bin/env node
/**
 * Bloqueia commits que reintroduzem `supabase db push` como instrução operacional.
 *
 * O comando destrói o banco prod do Promo_Gifts dado o desync de migrations
 * (ver docs/redeploy/REDEPLOY-T3-MIGRATIONS-AUDIT.md).
 *
 * Allowlist:
 *   - Entradas terminadas em '/' são tratadas como diretórios (prefix match).
 *     Use para pastas de DOCUMENTAÇÃO onde nada é executável (apenas .md).
 *   - Entradas sem '/' final exigem igualdade exata (evita bypass via
 *     `DEPLOYMENT.md.tmp`, `DEPLOYMENT.md.bak` etc.). Use para arquivos
 *     pontuais e principalmente para migrations .sql, que devem ser
 *     liberadas uma a uma após revisão manual (uma migration que cite o
 *     comando proibido em comentário precisa de aprovação humana).
 *
 * Busca usa regex ERE com whitespace livre para pegar variações como
 * `supabase   db   push` (espaços múltiplos, tabs). Quebra de linha
 * entre tokens não é detectada (git grep é linha-a-linha) — risco
 * negligenciável na prática.
 */
import { execSync } from 'node:child_process';

const ALLOWLIST = [
  // ─── Docs operacionais que explicitamente PROÍBEM ou mencionam o comando ──
  'docs/DEPLOYMENT.md',
  'supabase/MIGRATIONS_README.md',
  'recovery/agent-db/tasks/FASE_0_setup.md',
  'recovery/analysis/ACHADO_ZERO_OVERLAP_MIGRATIONS.md',

  // ─── CONTRIBUTING e ADR explicam a proibição (não são guia operacional) ──
  'CONTRIBUTING.md',
  'docs/adr/0006-migration-baseline.md',

  // ─── CHANGELOG cita o comando ao descrever a proibição da Fase 2 ──
  'CHANGELOG.md',

  // ─── Diretórios de DOCUMENTAÇÃO (apenas .md, nada executável) ──
  // - docs/historico/  : auditorias antigas (documenta o desync)
  // - docs/sessoes/    : transcrições de sessões anteriores
  // - docs/hardening/  : ondas de hardening (mencionam o comando como anti-padrão)
  // - docs/redeploy/   : manuais, READMEs e logs de execução do redeploy
  //                      (Decision 010 / Lovable→Oficial — todos citam o comando como proibido)
  'docs/historico/',
  'docs/sessoes/',
  'docs/hardening/',
  'docs/redeploy/',

  // ─── Auditorias de raiz e auditorias independentes ──
  'AUDITORIA_REDEPLOY_PROMO_GIFTS_2026-05-13_15-32 (1).md',
  'docs/AUDITORIA_INDEPENDENTE_PRE_PRODUCAO_2026-05-13.md',
  'docs/AUDIT_INDEPENDENTE.md',
  // Cita o comando como anti-padrão ao documentar o gap de drift (QA-03 / OPS-01).
  'docs/AUDITORIA-BACKEND-2026-05-25.md',
  // Bug report que cita o comando em prosa (remediação proposta dos fixes 001-005).
  'docs/BUG_REPORT_20260526.md',

  // ─── Auto-referências dos próprios scripts ──
  'scripts/check-no-db-push.mjs',
  'scripts/gen-migrations-readme.mjs',

  // ─── Migrations .sql que citam o comando em COMENTÁRIO ──
  // Política: liberar UMA POR UMA após revisão humana. Nunca usar prefix
  // 'supabase/migrations/' aqui — uma migration nova com `supabase db push`
  // em comentário deve forçar o autor a justificar e pedir entrada explícita.
  'supabase/migrations/20260522155000_align_wave_3_5_2_lovable_uuid_casts.sql',
];

function isAllowed(path) {
  return ALLOWLIST.some((p) =>
    p.endsWith('/') ? path.startsWith(p) : path === p,
  );
}

// ERE: aceita whitespace variável intra-linha (espaços múltiplos, tabs).
// Quebras de linha entre tokens NÃO são detectadas — git grep é linha-a-linha;
// ver header.
const PATTERN = 'supabase[[:space:]]+db[[:space:]]+push';

// Diretórios excluídos da busca (dependências, artifacts, caches).
const EXCLUDE_DIRS = [
  'node_modules', '.git', 'dist', 'build', 'coverage',
  'playwright-report', 'e2e-artifacts', '.next', '.cache',
];

let raw = '';
try {
  const excludeArgs = EXCLUDE_DIRS.map((d) => `--exclude-dir=${d}`).join(' ');
  raw = execSync(
    `grep -rlE ${excludeArgs} -- '${PATTERN}' .`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
} catch (e) {
  // grep convenciona: exit 1 = nenhum match (não é erro real).
  if (e.status === 1) {
    raw = '';
  } else {
    console.error('check-no-db-push: grep falhou inesperadamente.');
    console.error('  status:', e.status, 'code:', e.code);
    console.error('  stderr:', (e.stderr || '').toString().trim());
    console.error('  message:', e.message);
    process.exit(2);
  }
}

const files = raw
  .split('\n')
  .map((s) => s.trim().replace(/^\.\//, ''))
  .filter(Boolean);

const offenders = files.filter((f) => !isAllowed(f));

if (offenders.length === 0) {
  console.log('✅ check-no-db-push: nenhum uso novo de `supabase db push` detectado.');
  process.exit(0);
}

console.error('❌ check-no-db-push: `supabase db push` reintroduzido fora da allowlist.');
console.error('   Esse comando destruiria o banco prod (ver docs/DEPLOYMENT.md).');
console.error('   Arquivos com match:');
for (const f of offenders) console.error('   -', f);
console.error('');
console.error('   Se o uso for legítimo, adicione o caminho à ALLOWLIST em scripts/check-no-db-push.mjs');
console.error('   e justifique em commit message.');
process.exit(1);
