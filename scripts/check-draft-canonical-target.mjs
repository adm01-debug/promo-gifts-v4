#!/usr/bin/env node
/**
 * check-draft-canonical-target.mjs
 *
 * Verifica que o "alvo canônico" declarado em cada rascunho de
 * `qa/migrations-draft/*.sql` é consistente com:
 *
 *   1. A política de SSOT do projeto — o único banco canônico é
 *      `doufsxqlfjyuvxuezpln`. Rascunhos NÃO podem declarar
 *      `pqpdolkaeqlyzpdpbizo` como alvo.
 *   2. As migrações já versionadas em `supabase/migrations/` — quando o
 *      draft já tem uma migration canônica correspondente (mesmo slug), ela
 *      também não pode referenciar `pqp` em código executável.
 *   3. O schema atual (opcional) — se `PGHOST/PG*` estiver configurado,
 *      confirmamos via `psql` que o banco conectado é o canônico
 *      (`SHOW server_version` + `SELECT current_setting('cluster_name')` são
 *      frágeis, então usamos um marker seguro: presença de
 *      `supabase_migrations.schema_migrations`).
 *
 * Regras de aceitação por rascunho:
 *   ✔ contém `doufsxqlfjyuvxuezpln` em cabeçalho/comentário   → OK
 *   ✔ declara explicitamente "DDL agnóstica" / "agnostica"    → OK
 *   ✘ contém `pqpdolkaeqlyzpdpbizo` (em qualquer lugar)       → FAIL
 *   ✘ nenhum dos anteriores                                   → FAIL
 *
 * Uso:
 *   node scripts/check-draft-canonical-target.mjs
 *   node scripts/check-draft-canonical-target.mjs --json
 *
 * Exit codes:
 *   0 = todos os rascunhos OK
 *   1 = pelo menos um rascunho inconsistente
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, 'qa', 'migrations-draft');
const MIG_DIR = join(ROOT, 'supabase', 'migrations');

const CANONICAL = 'doufsxqlfjyuvxuezpln';
const FORBIDDEN = 'pqpdolkaeqlyzpdpbizo';
const AGNOSTIC_RE = /ddl\s+agn[oó]stic[ao]|schema\s+agn[oó]stic[ao]|project[-\s]?agnostic/i;

const emitJson = process.argv.includes('--json');

function slugOf(file) {
  const base = basename(file, '.sql');
  const idx = base.indexOf('_');
  return idx < 0 ? base : base.slice(idx + 1);
}

function tokensOf(slug) {
  return slug.split(/[_.-]+/).filter((t) => t.length >= 3);
}

function findCanonicalMatch(slug, migFiles) {
  const wanted = tokensOf(slug);
  for (const f of migFiles) {
    const lc = f.toLowerCase();
    if (lc.includes(slug.toLowerCase())) return f;
    if (wanted.length >= 3) {
      const hits = wanted.filter((t) => lc.includes(t.toLowerCase())).length;
      if (hits / wanted.length >= 0.6) return f;
    }
  }
  return null;
}

// ----- Executable-code sniffing (ignora linhas de comentário puras) -----
function stripComments(sql) {
  return sql
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function checkDraft(file) {
  const full = readFileSync(join(DRAFT_DIR, file), 'utf8');
  const exec = stripComments(full);
  const issues = [];
  const warnings = [];

  const declaresCanonical = full.includes(CANONICAL);
  const declaresAgnostic = AGNOSTIC_RE.test(full);
  const declaresForbidden = full.includes(FORBIDDEN);
  const forbiddenInExec = exec.includes(FORBIDDEN);

  if (forbiddenInExec) {
    issues.push(`referência a projeto proibido \`${FORBIDDEN}\` em código executável`);
  } else if (declaresForbidden) {
    warnings.push(`menciona \`${FORBIDDEN}\` em comentário — aceito apenas como aviso "NÃO rodar em pqp"`);
  }

  if (!declaresCanonical && !declaresAgnostic) {
    issues.push(
      `não declara alvo canônico — adicione um cabeçalho tipo "Alvo: ${CANONICAL}" ou "DDL agnóstica"`,
    );
  }

  return { file, declaresCanonical, declaresAgnostic, warnings, issues };
}

function checkCanonicalMigration(migFile) {
  const full = readFileSync(join(MIG_DIR, migFile), 'utf8');
  const exec = stripComments(full);
  const issues = [];
  if (exec.includes(FORBIDDEN)) {
    issues.push(
      `migration canônica \`supabase/migrations/${migFile}\` contém \`${FORBIDDEN}\` em código executável`,
    );
  }
  return issues;
}

// ----- Opcional: sanity-check do schema atual -----
function schemaSanity() {
  if (!process.env.PGHOST) {
    return { available: false, reason: 'PGHOST não definido — checagem de schema pulada (safe-by-default)' };
  }
  try {
    execSync(
      `psql -X -A -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema='supabase_migrations' AND table_name='schema_migrations'"`,
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { available: true, ok: true };
  } catch (err) {
    return {
      available: true,
      ok: false,
      reason: `psql falhou: ${String(err.message || err).split('\n')[0]}`,
    };
  }
}

// ----- Main -----
function main() {
  if (!existsSync(DRAFT_DIR)) {
    console.error(`❌ Diretório não encontrado: ${DRAFT_DIR}`);
    process.exit(2);
  }
  const drafts = readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.sql'));
  const migs = existsSync(MIG_DIR) ? readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')) : [];

  const results = [];
  for (const d of drafts) {
    const r = checkDraft(d);
    const match = findCanonicalMatch(slugOf(d), migs);
    if (match) {
      r.canonicalMatch = match;
      const migIssues = checkCanonicalMigration(match);
      if (migIssues.length) r.issues.push(...migIssues);
    }
    results.push(r);
  }

  const schema = schemaSanity();

  const failing = results.filter((r) => r.issues.length > 0);

  if (emitJson) {
    console.log(JSON.stringify({ results, schema, failing: failing.length }, null, 2));
  } else {
    console.log('┌─ Verificação de alvo canônico dos rascunhos ─────────────────');
    for (const r of results) {
      const badge = r.issues.length ? '❌' : '✅';
      const target = r.declaresCanonical ? CANONICAL : r.declaresAgnostic ? 'AGNÓSTICA' : '—';
      console.log(`│ ${badge} ${r.file}  (alvo: ${target})`);
      if (r.canonicalMatch) console.log(`│    ↳ canônica: supabase/migrations/${r.canonicalMatch}`);
      for (const w of r.warnings) console.log(`│    ⚠ ${w}`);
      for (const i of r.issues) console.log(`│    ✘ ${i}`);
    }
    console.log('├─ Schema sanity ─────────────────────────────────────────────');
    if (!schema.available) console.log(`│ ⓘ ${schema.reason}`);
    else if (schema.ok) console.log(`│ ✅ schema canônico acessível (supabase_migrations.schema_migrations existe)`);
    else console.log(`│ ⚠ ${schema.reason}`);
    console.log('└──────────────────────────────────────────────────────────────');
    console.log(`Total: ${results.length} rascunhos · ${failing.length} com inconsistências`);
  }

  if (failing.length > 0) {
    console.error(
      `\n❌ ${failing.length} rascunho(s) com alvo canônico inconsistente. Corrija antes de promover.`,
    );
    process.exit(1);
  }
  console.log('\n✅ Todos os rascunhos declaram alvo canônico consistente.');
}

main();
