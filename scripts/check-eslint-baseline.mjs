#!/usr/bin/env node
/**
 * Gate de CI: roda ESLint e compara com .eslint-baseline.json.
 *
 * Política:
 *   • Falha SOMENTE se houver erro NOVO (file:rule não presente no baseline,
 *     ou contagem maior que a registrada).
 *   • Não falha se contagens diminuírem (apenas avisa "drift positivo").
 *   • Falha se houver qualquer warning (severity=1) ou erro novo.

 *
 * Saídas:
 *   exit 0 — sem regressão.
 *   exit 1 — regressão (lista até 50 problemas novos).
 *   exit 2 — erro de execução (eslint quebrou ou baseline ausente).
 *
 * Para aceitar mudanças (após resolver erros legados ou refactor grande):
 *   node scripts/eslint-baseline-generate.mjs
 *
 * Uso:
 *   node scripts/check-eslint-baseline.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, ".eslint-baseline.json");
const MAX_LIST = 50;

if (!existsSync(BASELINE_PATH)) {
  console.error(
    "❌ .eslint-baseline.json não encontrado. Gere com: node scripts/eslint-baseline-generate.mjs"
  );
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const baselineCounts = baseline.counts ?? {};

const dir = mkdtempSync(join(tmpdir(), "eslint-gate-"));
const out = join(dir, "report.json");
const res = spawnSync(
  "npx",
  ["eslint", "src", "--format", "json", "-o", out],
  { stdio: ["ignore", "inherit", "inherit"], shell: false }
);
if (res.status !== 0 && res.status !== 1) {
  console.error(`❌ eslint falhou com status ${res.status}`);
  process.exit(2);
}

const report = JSON.parse(readFileSync(out, "utf8"));

// Normaliza uma entrada do baseline/current para { e, w }. Aceita o formato
// novo ({e, w}) e o legado (número = só erros) para retrocompatibilidade.
function norm(v) {
  if (v == null) return { e: 0, w: 0 };
  if (typeof v === "number") return { e: v, w: 0 };
  return { e: v.e ?? 0, w: v.w ?? 0 };
}

// Agrega current igual ao generator: { e, w } por (file, rule).
const current = {};
let totalErrors = 0;
let totalWarnings = 0;
for (const file of report) {
  if (!file.messages?.length) continue;
  const rel = relative(ROOT, file.filePath).replaceAll("\\", "/");
  for (const m of file.messages) {
    // Processamos erros (2) e warnings (1)
    if (m.severity !== 1 && m.severity !== 2) continue;

    const rule = m.ruleId ?? "<no-rule>";
    current[rel] ??= {};
    current[rel][rule] ??= { e: 0, w: 0 };
    if (m.severity === 2) {
      current[rel][rule].e += 1;
      totalErrors += 1;
    } else {
      current[rel][rule].w += 1;
      totalWarnings += 1;
    }
  }
}


// Compara erros e warnings SEPARADAMENTE por (file, rule). Assim uma transição
// warning→error (mesmo total) é flagada: o nº de erros sobe vs baseline.
const regressions = []; // {file, rule, severity, baseline, current, delta}
for (const [file, rules] of Object.entries(current)) {
  for (const [rule, cur] of Object.entries(rules)) {
    const base = norm(baselineCounts[file]?.[rule]);
    if (cur.e > base.e) {
      regressions.push({ file, rule, severity: "erro", baseline: base.e, current: cur.e, delta: cur.e - base.e });
    }
    if (cur.w > base.w) {
      regressions.push({ file, rule, severity: "warning", baseline: base.w, current: cur.w, delta: cur.w - base.w });
    }
  }
}

// Drift positivo (melhorias): não falha, só informa.
const improvements = [];
for (const [file, rules] of Object.entries(baselineCounts)) {
  for (const [rule, raw] of Object.entries(rules)) {
    const baseN = norm(raw);
    const curN = norm(current[file]?.[rule]);
    const improved = Math.max(0, baseN.e - curN.e) + Math.max(0, baseN.w - curN.w);
    if (improved > 0) improvements.push({ file, rule, baseline: baseN.e + baseN.w, current: curN.e + curN.w });
  }
}

const baselineTotal = baseline.totalErrors ?? 0;
console.log(
  `ESLint baseline gate — atual: ${totalErrors} erros, ${totalWarnings} warnings · baseline: ${baselineTotal} erros`
);


if (improvements.length) {
  const improved = improvements.reduce((s, i) => s + (i.baseline - i.current), 0);
  console.log(
    `✨ Drift positivo: ${improved} erro(s) eliminado(s) em ${improvements.length} par(es) file:rule. Considere atualizar o baseline.`
  );
}

if (regressions.length === 0) {
  console.log("✅ Nenhuma regressão de lint detectada.");
  process.exit(0);
}

regressions.sort((a, b) => b.delta - a.delta);
const totalDelta = regressions.reduce((s, r) => s + r.delta, 0);

// Coleta exemplos concretos (linha/coluna/msg) das regressões.
const examplesByKey = new Map();
for (const r of regressions.slice(0, MAX_LIST)) {
  examplesByKey.set(`${r.file}::${r.rule}`, []);
}
for (const file of report) {
  const rel = relative(ROOT, file.filePath).replaceAll("\\", "/");
  for (const m of file.messages ?? []) {
    if (m.severity === 0) continue;
    const key = `${rel}::${m.ruleId ?? "<no-rule>"}`;
    const arr = examplesByKey.get(key);
    if (arr && arr.length < 3) {
      const prefix = m.severity === 2 ? 'ERROR' : 'WARN';
      arr.push(`${prefix} ${m.line}:${m.column} ${m.message}`);
    }
  }
}


console.error(
  `\n❌ ${totalDelta} problema(s) novo(s) de ESLint (erros ou warnings) em ${regressions.length} par(es) file:rule:`
);

for (const r of regressions.slice(0, MAX_LIST)) {
  console.error(
    `  • ${r.file} [${r.rule}] (${r.severity}) baseline=${r.baseline} → atual=${r.current} (+${r.delta})`
  );
  const ex = examplesByKey.get(`${r.file}::${r.rule}`) ?? [];
  for (const e of ex) console.error(`      ${e}`);
}
if (regressions.length > MAX_LIST) {
  console.error(`  … e mais ${regressions.length - MAX_LIST} par(es) omitido(s).`);
}
console.error(
  "\nPara atualizar o baseline (após corrigir os legados ou refactor intencional):"
);
console.error("  node scripts/eslint-baseline-generate.mjs");
process.exit(1);
