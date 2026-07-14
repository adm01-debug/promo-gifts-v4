#!/usr/bin/env node
/**
 * Mutation Testing — Magazine rings
 * ----------------------------------
 * Aplica um catálogo de mutações determinísticas (M1–M6) ao código de
 * produção e helpers, roda `vitest run tests/magazine/` para cada uma,
 * e produz um relatório consolidado com mutation score.
 *
 * Semântica:
 *  - Cada mutação é uma substituição de string literal (não regex) —
 *    para garantir que a marcação seja única, o script valida ANTES de
 *    aplicar que o `find` aparece exatamente 1 vez.
 *  - Uma mutação é KILLED quando `vitest` sai com código ≠ 0.
 *  - Uma mutação é SURVIVED quando os testes continuam verdes → indica
 *    lacuna de cobertura (o ponto mutado não tem asserção suficiente).
 *
 * Segurança:
 *  - Um snapshot do arquivo é feito antes da mutação e SEMPRE restaurado
 *    no bloco `finally` (mesmo em Ctrl-C via SIGINT/SIGTERM handlers).
 *  - Ao final, o script verifica `git status --porcelain` dos arquivos
 *    mutados; se algo divergir, aborta com exit 2.
 *
 * Uso:
 *   node scripts/mutation-test-magazine.mjs
 *   node scripts/mutation-test-magazine.mjs --only=M1,M4
 *   node scripts/mutation-test-magazine.mjs --pattern=tests/magazine/preview-ring-collision.test.tsx
 *
 * Exit codes:
 *   0 → todas as mutações foram killed (mutation score = 100%)
 *   1 → ao menos uma mutação sobreviveu
 *   2 → erro de infraestrutura (snapshot divergente, marcador não único, etc.)
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const PATTERN = String(args.pattern ?? 'tests/magazine/');
const ONLY = args.only ? String(args.only).split(',').map((s) => s.trim()) : null;
const OUT_DIR = resolve(String(args['out-dir'] ?? 'reports/mutation'));

mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Catálogo de mutações
// ---------------------------------------------------------------------------
//
// Cada entrada define:
//   id          — M1..MN (estável, referenciado no relatório e docs).
//   file        — caminho relativo ao repo.
//   find        — string exata a substituir. DEVE aparecer 1× no arquivo.
//   replace     — mutação. Sintaticamente válida para o parser TS/TSX.
//   intent      — o que a mutação está tentando "sabotar".
//   killedBy    — teste que ESPERAMOS matar essa mutação (documental).
//
// Observação: mutações NÃO podem quebrar type-check (o vitest ignora tsc,
// mas os testes importam o arquivo mutado). Todas as substituições
// abaixo preservam a assinatura pública dos símbolos.
// ---------------------------------------------------------------------------

const MUTATIONS = [
  {
    id: 'M1',
    file: 'tests/utils/tailwindRings.ts',
    find: 'const PRIMARY_RE = /^ring-primary(?:\\/\\d+)?$/;',
    replace: 'const PRIMARY_RE = /^ring-primary\\/\\d+$/;',
    intent: 'Força PRIMARY_RE a exigir opacity — `ring-primary` puro deixa de contar.',
    killedBy: 'helpers.test.ts (contrato de aceitação de shades/opacidades)',
  },
  {
    id: 'M2',
    file: 'tests/utils/tailwindRings.ts',
    find: 'const AMBER_RE = /^ring-amber-\\d+(?:\\/\\d+)?$/;',
    replace: 'const AMBER_RE = /^ring-amber-500$/;',
    intent: 'Restringe AMBER_RE a shade 500 — refactors de shade viram falso negativo.',
    killedBy: 'helpers.test.ts + preview-focus-ring-collision (variação de shade)',
  },
  {
    id: 'M3',
    file: 'tests/utils/tailwindRings.ts',
    find: '/** Retorna os rings pintados EXCLUSIVAMENTE sob `:focus-visible`. */\nexport function focusRingsOf(el: Element): RingState {\n  return ringsByVariant(el, \'focus-visible\');\n}',
    replace: '/** Retorna os rings pintados EXCLUSIVAMENTE sob `:focus-visible`. */\nexport function focusRingsOf(el: Element): RingState {\n  return ringsByVariant(el, \'hover\');\n}',
    intent: 'focusRingsOf passa a ler tokens :hover — quebra o contrato de teclado.',
    killedBy: 'preview-focus-ring-collision + layout-step-rings (drag handle)',
  },
  {
    id: 'M4',
    file: 'src/pages/magazine/components/PreviewSidebar.tsx',
    find: "!isActive && isHighlighted && 'ring-2 ring-amber-500',",
    replace: "isHighlighted && 'ring-2 ring-amber-500',",
    intent: 'Remove o guard `!isActive` — permite colisão primary+amber na thumb ativa.',
    killedBy: 'preview-ring-collision + preview-ring-fuzz (P1)',
  },
  {
    id: 'M5',
    file: 'src/pages/magazine/components/PreviewSidebar.tsx',
    find: "isActive && 'ring-2 ring-primary',",
    replace: "isActive && 'ring-2 ring-amber-500',",
    intent: 'Ativo passa a pintar âmbar — sinaliza estado errado (colide com highlight).',
    killedBy: 'preview-ring-collision + fuzz P3 (aria-current ⇒ primary)',
  },
  {
    id: 'M6',
    file: 'src/pages/magazine/components/PreviewSidebar.tsx',
    find: "'group relative overflow-hidden rounded border bg-background text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',",
    replace: "'group relative overflow-hidden rounded border bg-background text-left transition focus-visible:outline-none ring-2 ring-primary',",
    intent: 'Ring de focus-visible vira ring base — sempre visível, colide com amber.',
    killedBy: 'preview-focus-ring-collision + fuzz P2',
  },
];

const selected = ONLY ? MUTATIONS.filter((m) => ONLY.includes(m.id)) : MUTATIONS;
if (ONLY && selected.length !== ONLY.length) {
  const known = new Set(MUTATIONS.map((m) => m.id));
  const missing = ONLY.filter((id) => !known.has(id));
  console.error(`[mutation] IDs desconhecidos: ${missing.join(', ')}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Snapshot + rollback
// ---------------------------------------------------------------------------
const snapshots = new Map(); // filePath → original content

function snapshot(filePath) {
  if (snapshots.has(filePath)) return;
  if (!existsSync(filePath)) {
    console.error(`[mutation] Arquivo não encontrado: ${filePath}`);
    process.exit(2);
  }
  snapshots.set(filePath, readFileSync(filePath, 'utf8'));
}

function restoreAll() {
  for (const [file, content] of snapshots) {
    try {
      writeFileSync(file, content);
    } catch (err) {
      console.error(`[mutation] Falha ao restaurar ${file}: ${err.message}`);
    }
  }
}

// Restaura mesmo em interrupção.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    console.error(`\n[mutation] Interrompido (${sig}) — restaurando snapshots…`);
    restoreAll();
    process.exit(130);
  });
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
function applyMutation(m) {
  snapshot(m.file);
  const current = readFileSync(m.file, 'utf8');
  const occurrences = current.split(m.find).length - 1;
  if (occurrences !== 1) {
    return {
      ok: false,
      error: `Marcador não único em ${m.file}: ${occurrences} ocorrência(s) da string \`find\`.`,
    };
  }
  const mutated = current.replace(m.find, m.replace);
  writeFileSync(m.file, mutated);
  return { ok: true };
}

function runTests() {
  const started = Date.now();
  const res = spawnSync(
    'npx',
    ['vitest', 'run', PATTERN, '--reporter=default'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, TZ: 'America/Sao_Paulo', CI: 'true', NODE_ENV: 'test' },
      encoding: 'utf8',
    },
  );
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  return {
    code: res.status ?? -1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    elapsedSec: elapsed,
  };
}

// Baseline — sanity check antes de qualquer mutação.
console.log('[mutation] Baseline — verificando suíte limpa…');
const baseline = runTests();
if (baseline.code !== 0) {
  console.error('[mutation] FAIL — baseline está VERMELHO. Corrija testes antes de mutar.');
  console.error(baseline.stdout.slice(-1500));
  console.error(baseline.stderr.slice(-1500));
  process.exit(2);
}
console.log(`[mutation] Baseline OK em ${baseline.elapsedSec}s.\n`);

const results = [];

try {
  for (const m of selected) {
    console.log(`\n=== ${m.id} · ${m.file} ===`);
    console.log(`     ${m.intent}`);
    const apply = applyMutation(m);
    if (!apply.ok) {
      console.error(`[mutation] ${m.id} — infra error: ${apply.error}`);
      results.push({ ...m, status: 'ERROR', reason: apply.error });
      // Restaura antes de continuar.
      const original = snapshots.get(m.file);
      if (original !== undefined) writeFileSync(m.file, original);
      continue;
    }

    const run = runTests();
    // Restaura imediatamente após a rodada.
    writeFileSync(m.file, snapshots.get(m.file));

    const killed = run.code !== 0;
    console.log(
      `[mutation] ${m.id} → ${killed ? '☠️  KILLED' : '🧟 SURVIVED'} (exit=${run.code}, ${run.elapsedSec}s)`,
    );
    results.push({
      ...m,
      status: killed ? 'KILLED' : 'SURVIVED',
      exitCode: run.code,
      elapsedSec: run.elapsedSec,
      // Salva últimas linhas do output para debug de sobreviventes.
      tail: killed ? '' : (run.stdout + run.stderr).split('\n').slice(-40).join('\n'),
    });
  }
} finally {
  restoreAll();
}

// Sanity: garante que restauramos tudo (compara com snapshots).
for (const [file, original] of snapshots) {
  if (readFileSync(file, 'utf8') !== original) {
    console.error(`[mutation] FATAL — ${file} não voltou ao estado original.`);
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------
const total = results.length;
const killed = results.filter((r) => r.status === 'KILLED').length;
const survived = results.filter((r) => r.status === 'SURVIVED').length;
const errored = results.filter((r) => r.status === 'ERROR').length;
const scored = total - errored;
const score = scored > 0 ? (killed / scored) * 100 : 0;

const jsonReport = {
  generatedAt: new Date().toISOString(),
  pattern: PATTERN,
  totals: { total, killed, survived, errored, score: Number(score.toFixed(1)) },
  mutations: results.map((r) => ({
    id: r.id,
    file: r.file,
    intent: r.intent,
    killedBy: r.killedBy,
    status: r.status,
    exitCode: r.exitCode ?? null,
    elapsedSec: r.elapsedSec ?? null,
    reason: r.reason ?? null,
  })),
};
writeFileSync(join(OUT_DIR, 'mutation-report.json'), JSON.stringify(jsonReport, null, 2));

const md = [];
md.push(`# Mutation Testing Report — Magazine Rings`);
md.push('');
md.push(`- **Gerado em:** ${jsonReport.generatedAt}`);
md.push(`- **Padrão de testes:** \`${PATTERN}\``);
md.push(`- **Mutation score:** **${score.toFixed(1)}%** (${killed}/${scored})`);
md.push(`- **Totais:** ${total} mutações · ☠️ ${killed} killed · 🧟 ${survived} survived · ⚠️ ${errored} errored`);
md.push('');
md.push(`## Resumo`);
md.push('');
md.push(`| ID | Arquivo | Status | Intenção | Killed by (esperado) |`);
md.push(`|---|---|---|---|---|`);
for (const r of results) {
  const icon =
    r.status === 'KILLED' ? '☠️ KILLED' : r.status === 'SURVIVED' ? '🧟 SURVIVED' : '⚠️ ERROR';
  md.push(`| ${r.id} | \`${r.file}\` | ${icon} | ${r.intent} | ${r.killedBy ?? '—'} |`);
}
md.push('');

const survivors = results.filter((r) => r.status === 'SURVIVED');
if (survivors.length) {
  md.push(`## 🧟 Sobreviventes — lacunas de cobertura`);
  md.push('');
  for (const r of survivors) {
    md.push(`### ${r.id} — \`${r.file}\``);
    md.push('');
    md.push(`**Intenção:** ${r.intent}`);
    md.push('');
    md.push('```diff');
    md.push(`- ${r.find.split('\n').join('\n- ')}`);
    md.push(`+ ${r.replace.split('\n').join('\n+ ')}`);
    md.push('```');
    md.push('');
    md.push(`**Última saída do vitest:**`);
    md.push('');
    md.push('```');
    md.push(r.tail || '(sem output relevante)');
    md.push('```');
    md.push('');
  }
}

if (errored) {
  md.push(`## ⚠️ Erros de infraestrutura`);
  md.push('');
  for (const r of results.filter((r) => r.status === 'ERROR')) {
    md.push(`- **${r.id}** (\`${r.file}\`): ${r.reason}`);
  }
  md.push('');
}

if (!survivors.length && !errored) {
  md.push(`✅ **Todas as mutações foram killed** — a suíte é sensível a M1–M${MUTATIONS.length}.`);
  md.push('');
}

writeFileSync(join(OUT_DIR, 'mutation-report.md'), md.join('\n'));

// Console summary.
console.log('\n=== Mutation Testing Summary ===');
console.log(`Total: ${total} | Killed: ${killed} | Survived: ${survived} | Errored: ${errored}`);
console.log(`Mutation score: ${score.toFixed(1)}%`);
if (survived) {
  console.log('\n🧟 Sobreviventes:');
  for (const r of survivors) console.log(`  - ${r.id} · ${r.file} — ${r.intent}`);
}
console.log(`\nRelatório: ${OUT_DIR}/mutation-report.{json,md}`);

// GitHub Actions job summary.
if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    const summary = readFileSync(join(OUT_DIR, 'mutation-report.md'), 'utf8');
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });
  } catch {
    /* best-effort */
  }
}

if (errored > 0) process.exit(2);
if (survived > 0) process.exit(1);
process.exit(0);
