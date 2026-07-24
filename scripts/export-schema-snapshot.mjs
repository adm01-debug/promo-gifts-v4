#!/usr/bin/env node
/**
 * export-schema-snapshot.mjs
 *
 * Exporta um snapshot consolidado do schema do projeto Supabase canônico
 * (`doufsxqlfjyuvxuezpln`) para auditoria, e regenera também o
 * `ALL_IN_ONE.sql` concatenando as migrations versionadas.
 *
 * Saídas em `supabase/migrations-snapshot/`:
 *   - ALL_IN_ONE.sql             — concatenação alfabética de supabase/migrations/**
 *   - SCHEMA_LIVE.sql            — snapshot do schema `public` do projeto linkado
 *                                  (via `supabase db dump --linked --schema public`)
 *   - SCHEMA_DRIFT.sql           — DDL que o `db diff` acusaria (drift entre
 *                                  migrations versionadas e o schema vivo)
 *   - SNAPSHOT_META.json         — metadados (timestamp, contagens, project ref)
 *
 * IMPORTANTE:
 *   - Nada aqui aplica DDL. É read-only.
 *   - Live/Drift dependem do CLI do Supabase (`supabase`) linkado ao projeto.
 *     Sem CLI ou sem `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD`, o script
 *     apenas gera `ALL_IN_ONE.sql` (safe-by-default) e avisa.
 *
 * Uso local:
 *   node scripts/export-schema-snapshot.mjs
 *
 * Uso em CI (com secrets):
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_DB_PASSWORD=... \
 *     node scripts/export-schema-snapshot.mjs
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const OUT_DIR = join(ROOT, 'supabase', 'migrations-snapshot');
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'doufsxqlfjyuvxuezpln';

const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

const log = (msg) => console.log(`${CYAN}[schema-snapshot]${RESET} ${msg}`);
const warn = (msg) => console.warn(`${YELLOW}[schema-snapshot][warn]${RESET} ${msg}`);
const ok = (msg) => console.log(`${GREEN}[schema-snapshot][ok]${RESET} ${msg}`);
const err = (msg) => console.error(`${RED}[schema-snapshot][err]${RESET} ${msg}`);

function ensureOutDir() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
}

function hasSupabaseCli() {
  const r = spawnSync('supabase', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

function tryLink() {
  if (!process.env.SUPABASE_ACCESS_TOKEN || !process.env.SUPABASE_DB_PASSWORD) {
    warn('SUPABASE_ACCESS_TOKEN e/ou SUPABASE_DB_PASSWORD ausentes — pulando etapas live/drift.');
    return false;
  }
  try {
    execSync(
      `supabase link --project-ref ${PROJECT_REF} -p "$SUPABASE_DB_PASSWORD"`,
      { stdio: 'inherit', shell: '/bin/bash' },
    );
    return true;
  } catch (e) {
    err(`Falha ao linkar projeto ${PROJECT_REF}: ${e.message}`);
    return false;
  }
}

function buildAllInOne() {
  log('Concatenando migrations versionadas → ALL_IN_ONE.sql');
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const outPath = join(OUT_DIR, 'ALL_IN_ONE.sql');
  const header = [
    '-- ==============================================================',
    '-- ALL_IN_ONE.sql — snapshot concatenado de supabase/migrations/',
    `-- Gerado em: ${new Date().toISOString()}`,
    `-- Total de arquivos: ${files.length}`,
    '-- Ordem: alfabética (mesmo critério do Supabase CLI)',
    '-- Uso: APENAS auditoria/leitura. NÃO aplicar direto no banco.',
    '-- SSOT continua sendo os arquivos individuais em supabase/migrations/.',
    '-- ==============================================================',
    '',
  ].join('\n');
  const chunks = [header];
  for (const f of files) {
    chunks.push(`\n-- >>> BEGIN ${f} >>>`);
    chunks.push(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    chunks.push(`-- <<< END ${f} <<<`);
  }
  writeFileSync(outPath, chunks.join('\n'));
  ok(`ALL_IN_ONE.sql gerado (${files.length} migrations).`);
  return { count: files.length, path: outPath };
}

function dumpLiveSchema() {
  log('Exportando schema vivo (supabase db dump --linked --schema public)');
  const outPath = join(OUT_DIR, 'SCHEMA_LIVE.sql');
  try {
    const sql = execSync(
      `supabase db dump --linked --schema public 2>/dev/null`,
      { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, shell: '/bin/bash' },
    );
    const header = [
      '-- ==============================================================',
      '-- SCHEMA_LIVE.sql — dump do schema `public` do projeto canônico',
      `-- Projeto: ${PROJECT_REF}`,
      `-- Gerado em: ${new Date().toISOString()}`,
      '-- Fonte: supabase db dump --linked --schema public',
      '-- ==============================================================',
      '',
    ].join('\n');
    writeFileSync(outPath, header + sql);
    ok('SCHEMA_LIVE.sql gerado.');
    return { path: outPath, bytes: sql.length };
  } catch (e) {
    err(`Falha ao dumpar schema vivo: ${e.message}`);
    return null;
  }
}

function computeDrift() {
  log('Calculando drift (supabase db diff --linked --schema public)');
  const outPath = join(OUT_DIR, 'SCHEMA_DRIFT.sql');
  try {
    const sql = execSync(
      `supabase db diff --linked --schema public 2>/dev/null`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: '/bin/bash' },
    );
    const header = [
      '-- ==============================================================',
      '-- SCHEMA_DRIFT.sql — DDL restante entre migrations e schema vivo',
      `-- Projeto: ${PROJECT_REF}`,
      `-- Gerado em: ${new Date().toISOString()}`,
      '-- Fonte: supabase db diff --linked --schema public',
      '-- Ideal: arquivo vazio (sem drift).',
      '-- ==============================================================',
      '',
    ].join('\n');
    writeFileSync(outPath, header + (sql || '-- (sem drift)\n'));
    const meaningful = sql
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('--'))
      .length;
    ok(`SCHEMA_DRIFT.sql gerado (${meaningful} linha(s) de DDL efetiva).`);
    return { path: outPath, driftLines: meaningful };
  } catch (e) {
    err(`Falha ao calcular drift: ${e.message}`);
    return null;
  }
}

function writeMeta(meta) {
  const outPath = join(OUT_DIR, 'SNAPSHOT_META.json');
  writeFileSync(outPath, JSON.stringify(meta, null, 2) + '\n');
  ok(`SNAPSHOT_META.json gerado.`);
}

function main() {
  ensureOutDir();
  const allInOne = buildAllInOne();

  const meta = {
    generated_at: new Date().toISOString(),
    project_ref: PROJECT_REF,
    migrations_count: allInOne.count,
    live_schema: null,
    drift: null,
  };

  if (!hasSupabaseCli()) {
    warn('CLI `supabase` não encontrado — pulando SCHEMA_LIVE.sql e SCHEMA_DRIFT.sql.');
    writeMeta(meta);
    return;
  }
  if (!tryLink()) {
    writeMeta(meta);
    return;
  }

  const live = dumpLiveSchema();
  if (live) meta.live_schema = { bytes: live.bytes };

  const drift = computeDrift();
  if (drift) meta.drift = { ddl_lines: drift.driftLines };

  writeMeta(meta);
}

try {
  main();
} catch (e) {
  err(e.stack || e.message);
  process.exit(1);
}
