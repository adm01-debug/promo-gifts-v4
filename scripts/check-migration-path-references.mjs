#!/usr/bin/env node
/**
 * check-migration-path-references.mjs
 *
 * Falha CI quando algum arquivo do repo referencia um caminho inexistente sob:
 *   - supabase/migrations/
 *   - supabase/migrations-snapshot/
 *   - qa/migrations-draft/
 *
 * Motivação: já aconteceu de mensagens/PRs/docs citarem
 * `supabase/migrations-snapshot/ALL_IN_ONE.sql` quando o arquivo ainda não
 * existia. Este gate evita que uma referência quebrada entre no `main`.
 *
 * Uso:
 *   node scripts/check-migration-path-references.mjs
 *
 * Regras:
 *   • Varre .md, .mdx, .txt, .yml, .yaml, .json, .ts, .tsx, .js, .mjs, .cjs, .sh
 *   • Ignora node_modules, dist, build, .git, coverage, playwright-report,
 *     test-results, .lovable, medallion (docs de arquitetura, links soltos).
 *   • Extrai path via regex; considera OK se o arquivo/dir existe no repo,
 *     ou se a referência é um glob (contém `*`), ou é o próprio path base
 *     (`supabase/migrations/`).
 *   • Ignora blocos de código diff/log de commit (linhas começando com `+++`/`---`).
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const EXT_ALLOW = new Set([
  '.md', '.mdx', '.txt', '.yml', '.yaml', '.json',
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.sh',
]);
const IGNORE_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage',
  'playwright-report', 'test-results', '.lovable', '.next',
  'medallion', // docs internos de arquitetura, links soltos aceitos
  '.workspace', '.agents', '.claude',
]);
// Arquivos que só falam de paths (README/snapshot meta), varremos normal —
// mas ignoramos o próprio SELF para não recursivar em exemplos.
const SELF = 'scripts/check-migration-path-references.mjs';

// Regex captura ocorrências como:
//   supabase/migrations/20260101_x.sql
//   `supabase/migrations-snapshot/ALL_IN_ONE.sql`
//   qa/migrations-draft/2026-06-27_quotes_status_allow_cancelled.sql
const PATH_RE =
  /(?:^|[\s`("'\[<])(supabase\/migrations(?:-snapshot)?\/[A-Za-z0-9_./*-]+|qa\/migrations-draft\/[A-Za-z0-9_./*-]+)/g;

// Referências "base" que sempre existem se o dir existir — não são citação de arquivo.
const BASE_PATHS = new Set([
  'supabase/migrations',
  'supabase/migrations/',
  'supabase/migrations-snapshot',
  'supabase/migrations-snapshot/',
  'qa/migrations-draft',
  'qa/migrations-draft/',
]);

const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry) || entry.startsWith('.')) {
      if (entry === '.github') { /* varrer workflows */ } else continue;
    }
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (IGNORE_DIRS.has(entry)) continue;
      walk(full);
    } else if (st.isFile()) {
      const rel = relative(ROOT, full);
      if (rel === SELF) continue;
      if (!EXT_ALLOW.has(extname(entry))) continue;
      scanFile(full, rel);
    }
  }
}

function scanFile(full, rel) {
  let text;
  try { text = readFileSync(full, 'utf8'); } catch { return; }
  if (!/(supabase\/migrations|qa\/migrations-draft)/.test(text)) return;

  const lines = text.split('\n');
  lines.forEach((line, i) => {
    // pula linhas de diff (ex.: patches/commits pegos em docs)
    const trimmed = line.trimStart();
    if (trimmed.startsWith('+++') || trimmed.startsWith('---')) return;
    // pula linhas comentadas como "não encontrei o arquivo ..." em CHANGELOG?
    // (mantemos strict — se a linha ativa cita, precisa existir)

    let m;
    PATH_RE.lastIndex = 0;
    while ((m = PATH_RE.exec(line)) !== null) {
      const raw = m[1].replace(/[.,;:)`"'\]>]+$/, '');
      if (BASE_PATHS.has(raw) || BASE_PATHS.has(raw + '/')) continue;
      if (raw.includes('*') || raw.includes('**')) continue;         // glob
      if (/\{[^}]+\}/.test(raw)) continue;                            // template
      if (/<[^>]+>/.test(raw)) continue;                              // placeholder
      if (/YYYY|MMDD|HHMMSS|slug|timestamp/i.test(raw)) continue;     // exemplo genérico
      const abs = join(ROOT, raw);
      if (existsSync(abs)) continue;

      problems.push({ file: rel, line: i + 1, ref: raw });
    }
  });
}

walk(ROOT);

if (problems.length) {
  console.error(
    `\n❌ ${problems.length} referência(s) a arquivo(s) inexistente(s) sob supabase/migrations{,-snapshot}/ ou qa/migrations-draft/:\n`,
  );
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line} → ${p.ref}`);
  }
  console.error(
    '\nCorreções possíveis:',
    '\n  • Gerar o arquivo faltante (ex.: `npm run schema:snapshot`).',
    '\n  • Corrigir o caminho na referência.',
    '\n  • Remover a menção obsoleta.\n',
  );
  process.exit(1);
}

console.log('✅ Nenhuma referência quebrada a supabase/migrations{,-snapshot}/ ou qa/migrations-draft/.');
