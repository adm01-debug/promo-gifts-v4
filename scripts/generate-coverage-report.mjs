#!/usr/bin/env node
/**
 * scripts/generate-coverage-report.mjs
 *
 * Gera relatório de cobertura detalhado por módulo e por rota.
 * Lê coverage/coverage-summary.json (gerado pelo vitest --coverage) e
 * produz:
 *   - coverage/module-coverage-report.json  → cobertura por módulo
 *   - coverage/route-coverage-report.json   → cobertura por "rota" (src/pages/*)
 *   - coverage/coverage-report.md           → relatório Markdown legível
 *
 * Thresholds por módulo (configuráveis via MODULE_THRESHOLDS env):
 *   Padrão: 60% lines — pode ser sobrescrito por módulo.
 *
 * Uso:
 *   node scripts/generate-coverage-report.mjs [--check] [--module=src/pages/products]
 *
 *   --check    → Falha com exit 1 se algum módulo cair abaixo do threshold
 *   --module=X → Filtra relatório para módulo específico
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const COVERAGE_SUMMARY = path.resolve("coverage/coverage-summary.json");
const OUT_MODULE_JSON = path.resolve("coverage/module-coverage-report.json");
const OUT_ROUTE_JSON = path.resolve("coverage/route-coverage-report.json");
const OUT_MD = path.resolve("coverage/coverage-report.md");

const CHECK_MODE = process.argv.includes("--check");
const MODULE_FILTER = process.argv.find(a => a.startsWith("--module="))?.split("=")[1];

// ---------------------------------------------------------------------------
// Thresholds por padrão de caminho
// ---------------------------------------------------------------------------

const THRESHOLDS = [
  { pattern: /src\/hooks\//, name: "Hooks",              lines: 70, functions: 70 },
  { pattern: /src\/pages\//, name: "Pages",              lines: 40, functions: 40 },
  { pattern: /src\/components\//, name: "Components",   lines: 50, functions: 50 },
  { pattern: /src\/utils\//, name: "Utils",              lines: 70, functions: 70 },
  { pattern: /src\/lib\//, name: "Lib",                  lines: 60, functions: 60 },
  { pattern: /src\/stores\//, name: "Stores",            lines: 60, functions: 60 },
  { pattern: /src\/services\//, name: "Services",        lines: 50, functions: 50 },
  { pattern: /src\/logic\//, name: "Logic",              lines: 60, functions: 60 },
  { pattern: /src\//, name: "Outros (src)",              lines: 40, functions: 40 },
];

function getThreshold(filePath) {
  for (const t of THRESHOLDS) {
    if (t.pattern.test(filePath)) return t;
  }
  return { name: "Default", lines: 40, functions: 40 };
}

// ---------------------------------------------------------------------------
// Classificação de arquivo por módulo
// ---------------------------------------------------------------------------

const MODULE_GROUPS = {
  "pages/auth": /src\/pages\/auth\//,
  "pages/admin": /src\/pages\/admin\//,
  "pages/quotes": /src\/pages\/quotes\//,
  "pages/products": /src\/pages\/(products|filters|advanced-price-search)\//,
  "pages/collections": /src\/pages\/collections\//,
  "pages/kit-builder": /src\/pages\/kit-builder\//,
  "pages/mockups": /src\/pages\/mockups\//,
  "pages/bi": /src\/pages\/bi\//,
  "pages/tools": /src\/pages\/tools\//,
  "hooks": /src\/hooks\//,
  "components/ui": /src\/components\/ui\//,
  "components/products": /src\/components\/products\//,
  "components/quotes": /src\/components\/quotes\//,
  "components/admin": /src\/components\/admin\//,
  "components/layout": /src\/components\/layout\//,
  "utils": /src\/utils\//,
  "lib": /src\/lib\//,
  "stores": /src\/stores\//,
  "services": /src\/services\//,
  "logic": /src\/logic\//,
  "integrations": /src\/integrations\//,
  "other": /src\//,
};

function classifyFile(filePath) {
  for (const [group, pattern] of Object.entries(MODULE_GROUPS)) {
    if (pattern.test(filePath)) return group;
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Classificação por rota
// ---------------------------------------------------------------------------

const ROUTE_PATTERNS = [
  { route: "/login",        pattern: /src\/pages\/auth\// },
  { route: "/produtos",     pattern: /src\/pages\/(products|filters)\/|FiltersPage/ },
  { route: "/orcamentos",   pattern: /src\/pages\/quotes\// },
  { route: "/admin",        pattern: /src\/pages\/admin\// },
  { route: "/colecoes",     pattern: /src\/pages\/collections\// },
  { route: "/montar-kit",   pattern: /src\/pages\/kit-builder\// },
  { route: "/mockups",      pattern: /src\/pages\/mockups\// },
  { route: "/bi",           pattern: /src\/pages\/bi\// },
  { route: "/favoritos",    pattern: /src\/pages\/.*favor/ },
  { route: "/simulador",    pattern: /src\/pages\/.*simul/ },
  { route: "/tendencias",   pattern: /src\/pages\/.*trend/ },
];

function classifyRoute(filePath) {
  for (const { route, pattern } of ROUTE_PATTERNS) {
    if (pattern.test(filePath)) return route;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cálculo de cobertura agregada
// ---------------------------------------------------------------------------

function pct(covered, total) {
  if (total === 0) return 100;
  return Math.round((covered / total) * 1000) / 10; // 1 decimal
}

function aggregateCoverage(files) {
  const totals = { lines: { covered: 0, total: 0 }, functions: { covered: 0, total: 0 }, branches: { covered: 0, total: 0 }, statements: { covered: 0, total: 0 } };
  for (const f of files) {
    for (const metric of ["lines", "functions", "branches", "statements"]) {
      totals[metric].covered += f[metric].covered ?? 0;
      totals[metric].total   += f[metric].total   ?? 0;
    }
  }
  return {
    lines:      pct(totals.lines.covered,      totals.lines.total),
    functions:  pct(totals.functions.covered,  totals.functions.total),
    branches:   pct(totals.branches.covered,   totals.branches.total),
    statements: pct(totals.statements.covered, totals.statements.total),
    _raw: totals,
  };
}

// ---------------------------------------------------------------------------
// Gerador de Markdown
// ---------------------------------------------------------------------------

function statusIcon(pctVal, threshold) {
  if (pctVal >= threshold) return "✅";
  if (pctVal >= threshold * 0.8) return "⚠️";
  return "❌";
}

function buildMarkdown(moduleSummary, routeSummary, lowCoverageFiles, totalStats) {
  const now = new Date().toISOString();
  const lines = [
    `# 📊 Relatório de Cobertura de Testes`,
    ``,
    `> Gerado em: ${now}`,
    ``,
    `## Cobertura Global`,
    ``,
    `| Métrica | % |`,
    `|---------|---|`,
    `| Lines | ${totalStats.lines}% |`,
    `| Functions | ${totalStats.functions}% |`,
    `| Branches | ${totalStats.branches}% |`,
    `| Statements | ${totalStats.statements}% |`,
    ``,
    `## Cobertura por Módulo`,
    ``,
    `| Módulo | Lines | Functions | Branches | Status |`,
    `|--------|-------|-----------|----------|--------|`,
  ];

  for (const [mod, stats] of Object.entries(moduleSummary)) {
    const threshold = 50; // default display threshold
    const icon = statusIcon(stats.lines, threshold);
    lines.push(`| \`${mod}\` | ${stats.lines}% | ${stats.functions}% | ${stats.branches}% | ${icon} |`);
  }

  lines.push(``, `## Cobertura por Rota`, ``, `| Rota | Lines | Functions | Branches | Arquivos |`, `|------|-------|-----------|----------|----------|`);

  for (const [route, stats] of Object.entries(routeSummary)) {
    const icon = statusIcon(stats.lines, 40);
    lines.push(`| \`${route}\` | ${stats.lines}% | ${stats.functions}% | ${stats.branches}% | ${stats.fileCount} | ${icon} |`);
  }

  if (lowCoverageFiles.length > 0) {
    lines.push(``, `## ⚠️ Arquivos Abaixo do Threshold (Top 20)`, ``, `| Arquivo | Lines | Functions | Threshold |`, `|---------|-------|-----------|-----------|`);
    for (const f of lowCoverageFiles.slice(0, 20)) {
      const short = f.file.replace(process.cwd() + "/", "");
      lines.push(`| \`${short}\` | ${f.lines}% | ${f.functions}% | ${f.threshold}% |`);
    }
  }

  lines.push(``, `---`, `*Gerado por \`scripts/generate-coverage-report.mjs\`*`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!fs.existsSync(COVERAGE_SUMMARY)) {
  console.error(`❌ coverage/coverage-summary.json não encontrado.`);
  console.error(`   Execute primeiro: npx vitest run --coverage`);
  process.exit(CHECK_MODE ? 1 : 0);
}

const summary = JSON.parse(fs.readFileSync(COVERAGE_SUMMARY, "utf-8"));
const files = Object.entries(summary)
  .filter(([key]) => key !== "total")
  .map(([file, stats]) => ({ file, ...stats }));

// Apply module filter
const filteredFiles = MODULE_FILTER ? files.filter(f => f.file.includes(MODULE_FILTER)) : files;

// Group by module
const moduleGroups = {};
for (const f of filteredFiles) {
  const group = classifyFile(f.file);
  if (!moduleGroups[group]) moduleGroups[group] = [];
  moduleGroups[group].push(f);
}

const moduleSummary = {};
for (const [group, groupFiles] of Object.entries(moduleGroups)) {
  moduleSummary[group] = { ...aggregateCoverage(groupFiles), fileCount: groupFiles.length };
}

// Group by route
const routeGroups = {};
for (const f of filteredFiles) {
  const route = classifyRoute(f.file);
  if (!route) continue;
  if (!routeGroups[route]) routeGroups[route] = [];
  routeGroups[route].push(f);
}

const routeSummary = {};
for (const [route, routeFiles] of Object.entries(routeGroups)) {
  routeSummary[route] = { ...aggregateCoverage(routeFiles), fileCount: routeFiles.length };
}

// Find low-coverage files
const lowCoverageFiles = filteredFiles
  .map(f => {
    const threshold = getThreshold(f.file);
    const linesPct = pct(f.lines?.covered ?? 0, f.lines?.total ?? 0);
    const fnPct = pct(f.functions?.covered ?? 0, f.functions?.total ?? 0);
    return { file: f.file, lines: linesPct, functions: fnPct, threshold: threshold.lines };
  })
  .filter(f => f.lines < f.threshold)
  .sort((a, b) => a.lines - b.lines);

// Total stats (from summary.total if available)
const totalEntry = summary.total || {};
const totalStats = {
  lines:      pct(totalEntry.lines?.covered ?? 0,      totalEntry.lines?.total ?? 0),
  functions:  pct(totalEntry.functions?.covered ?? 0,  totalEntry.functions?.total ?? 0),
  branches:   pct(totalEntry.branches?.covered ?? 0,   totalEntry.branches?.total ?? 0),
  statements: pct(totalEntry.statements?.covered ?? 0, totalEntry.statements?.total ?? 0),
};

// ---------------------------------------------------------------------------
// Cobertura de TESTE por Edge Function (presença de teste live/integração).
// As edge functions são Deno (fora de src/), então o coverage v8 não as mede.
// Aqui reportamos quais funções têm teste de integração LIVE e/ou mockado.
// ---------------------------------------------------------------------------
const OUT_EDGE_JSON = path.resolve("coverage/edge-coverage-report.json");
function buildEdgeCoverage() {
  const fnsDir = path.resolve("supabase/functions");
  const liveDir = path.resolve("tests/edge-functions/live");
  const integDir = path.resolve("tests/edge-functions/integration");
  const exclude = new Set(["_shared", "tests"]);
  if (!fs.existsSync(fnsDir)) return null;
  const fns = fs
    .readdirSync(fnsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !exclude.has(d.name))
    .filter((d) => fs.existsSync(path.join(fnsDir, d.name, "index.ts")))
    .map((d) => d.name)
    .sort();
  const rows = fns.map((fn) => ({
    fn,
    live: fs.existsSync(path.join(liveDir, `${fn}.test.ts`)),
    integration: fs.existsSync(path.join(integDir, `${fn}.test.ts`)),
  }));
  const liveCount = rows.filter((r) => r.live).length;
  const integCount = rows.filter((r) => r.integration).length;
  return {
    total: fns.length,
    live_covered: liveCount,
    integration_covered: integCount,
    live_pct: pct(liveCount, fns.length),
    functions: rows,
  };
}
const edgeCoverage = buildEdgeCoverage();

// Write outputs
fs.mkdirSync("coverage", { recursive: true });
if (edgeCoverage) {
  fs.writeFileSync(
    OUT_EDGE_JSON,
    JSON.stringify({ generated_at: new Date().toISOString(), ...edgeCoverage }, null, 2),
  );
}
fs.writeFileSync(OUT_MODULE_JSON, JSON.stringify({ generated_at: new Date().toISOString(), total: totalStats, modules: moduleSummary }, null, 2));
fs.writeFileSync(OUT_ROUTE_JSON, JSON.stringify({ generated_at: new Date().toISOString(), routes: routeSummary }, null, 2));
fs.writeFileSync(OUT_MD, buildMarkdown(moduleSummary, routeSummary, lowCoverageFiles, totalStats));

// Console output
console.log("📊 Relatório de Cobertura por Módulo");
console.log("=".repeat(60));
for (const [mod, stats] of Object.entries(moduleSummary)) {
  const icon = stats.lines >= 50 ? "✅" : stats.lines >= 30 ? "⚠️" : "❌";
  console.log(`${icon}  ${mod.padEnd(30)} Lines: ${String(stats.lines).padStart(5)}% | Fns: ${String(stats.functions).padStart(5)}% | Files: ${stats.fileCount}`);
}

console.log("\n📊 Cobertura por Rota");
console.log("=".repeat(60));
for (const [route, stats] of Object.entries(routeSummary)) {
  const icon = stats.lines >= 40 ? "✅" : stats.lines >= 20 ? "⚠️" : "❌";
  console.log(`${icon}  ${route.padEnd(20)} Lines: ${String(stats.lines).padStart(5)}% | Fns: ${String(stats.functions).padStart(5)}%`);
}

if (lowCoverageFiles.length > 0) {
  console.log(`\n⚠️  ${lowCoverageFiles.length} arquivo(s) abaixo do threshold.`);
  for (const f of lowCoverageFiles.slice(0, 10)) {
    console.log(`   ${f.lines}% < ${f.threshold}% — ${f.file.replace(process.cwd() + "/", "")}`);
  }
}

if (edgeCoverage) {
  console.log("\n📊 Cobertura de Teste por Edge Function (integração)");
  console.log("=".repeat(60));
  const icon = edgeCoverage.live_pct >= 100 ? "✅" : edgeCoverage.live_pct >= 80 ? "⚠️" : "❌";
  console.log(
    `${icon}  LIVE: ${edgeCoverage.live_covered}/${edgeCoverage.total} (${edgeCoverage.live_pct}%) | mockado: ${edgeCoverage.integration_covered}/${edgeCoverage.total}`,
  );
  const noLive = edgeCoverage.functions.filter((r) => !r.live).map((r) => r.fn);
  if (noLive.length > 0) console.log(`   sem teste LIVE: ${noLive.join(", ")}`);
}

console.log(`\n✅ Relatórios gerados:`);
console.log(`   ${OUT_MODULE_JSON}`);
console.log(`   ${OUT_ROUTE_JSON}`);
console.log(`   ${OUT_MD}`);
if (edgeCoverage) console.log(`   ${OUT_EDGE_JSON}`);

if (CHECK_MODE && lowCoverageFiles.length > 0) {
  console.error(`\n❌ --check falhou: ${lowCoverageFiles.length} arquivo(s) abaixo do threshold.`);
  process.exit(1);
}
