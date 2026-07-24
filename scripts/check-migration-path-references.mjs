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

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, '.migration-refs-baseline.json');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');
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

// ---- Baseline (legado congelado) ----
const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { entries: [] };
const baselineSet = new Set(
  (baseline.entries || []).map((e) => `${e.file}|${e.ref}`),
);
const isBaselined = (p) => baselineSet.has(`${p.file}|${p.ref}`);

if (UPDATE_BASELINE) {
  const uniq = new Map();
  for (const p of problems) uniq.set(`${p.file}|${p.ref}`, { file: p.file, ref: p.ref });
  const next = {
    _comment: baseline._comment || 'Referências legadas congeladas — NOVAS entradas requerem justificativa no PR.',
    entries: [...uniq.values()].sort((a, b) => (a.file + a.ref).localeCompare(b.file + b.ref)),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`📝 Baseline atualizada com ${next.entries.length} entrada(s).`);
  process.exit(0);
}

const newProblems = problems.filter((p) => !isBaselined(p));
const stale = [...baselineSet].filter(
  (key) => !problems.some((p) => `${p.file}|${p.ref}` === key),
);

if (newProblems.length) {
  console.error(
    `\n❌ ${newProblems.length} NOVA(S) referência(s) a arquivo(s) inexistente(s) sob supabase/migrations{,-snapshot}/ ou qa/migrations-draft/:\n`,
  );
  for (const p of newProblems) {
    console.error(`  ${p.file}:${p.line} → ${p.ref}`);
  }
  console.error(
    '\nCorreções possíveis:',
    '\n  • Gerar o arquivo faltante (ex.: `npm run schema:snapshot`).',
    '\n  • Corrigir o caminho na referência.',
    '\n  • Remover a menção obsoleta.',
    '\n  • Como último recurso: `node scripts/check-migration-path-references.mjs --update-baseline` e justificar no PR.\n',
  );
  process.exit(1);
}

if (stale.length) {
  console.error(
    `\n⚠️  ${stale.length} entrada(s) da baseline não são mais referências quebradas (limpar):\n`,
  );
  for (const s of stale) console.error(`  ${s.replace('|', ' → ')}`);
  console.error(
    '\nRode: node scripts/check-migration-path-references.mjs --update-baseline\n',
  );
  process.exit(1);
}

console.log(
  `✅ Nenhuma NOVA referência quebrada. (${baselineSet.size} entrada(s) legadas na baseline.)`,
);

