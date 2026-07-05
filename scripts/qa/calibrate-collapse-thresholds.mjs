#!/usr/bin/env node
/**
 * Modo de calibragem do diff visual do colapso do LocationPanel.
 *
 * Roda o spec `e2e/customization/collapse-reflow.spec.ts` uma vez SEM update
 * (para gerar os PNGs `-actual.png` e `-diff.png`), depois re-processa os
 * diffs variando `threshold` × `maxDiffPixelRatio` e gera um relatório
 * markdown mostrando quantos casos falhariam por combinação.
 *
 * Uso:
 *   npm run e2e:collapse:calibrate
 *   node scripts/qa/calibrate-collapse-thresholds.mjs \
 *     --thresholds 0.1,0.2,0.3 --ratios 0.005,0.01,0.02
 *
 * Saída:
 *   visual-diff-report/calibration.md   (tabela por viewport)
 *   visual-diff-report/calibration.json (dados brutos)
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const args = new Map(
  process.argv.slice(2).flatMap((a, i, arr) =>
    a.startsWith("--") ? [[a.slice(2), arr[i + 1]]] : [],
  ),
);

const THRESHOLDS = (args.get("thresholds") ?? "0.1,0.2,0.25,0.3,0.4")
  .split(",")
  .map(Number)
  .filter((n) => !Number.isNaN(n));
const RATIOS = (args.get("ratios") ?? "0.005,0.01,0.015,0.02,0.03")
  .split(",")
  .map(Number)
  .filter((n) => !Number.isNaN(n));

const DRY_RUN = args.has("dry-run") || process.env.CALIBRATE_DRY_RUN === "1";

const OUT_DIR = "visual-diff-report";
mkdirSync(OUT_DIR, { recursive: true });

console.log(
  DRY_RUN
    ? "▶ [dry-run] Rodando spec (falhas não abortam) para gerar -actual.png / -diff.png…"
    : "▶ Rodando o spec de colapso para gerar -actual.png / -diff.png…",
);
const run = spawnSync(
  "npx",
  [
    "playwright",
    "test",
    "e2e/customization/collapse-reflow.spec.ts",
    "--project=chromium-authed",
    "--reporter=list",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, CI: "true", ...(DRY_RUN ? { PW_FORCE_UPDATE: "0" } : {}) },
  },
);
if (run.status !== 0 && !DRY_RUN) {
  console.warn("⚠ spec retornou não-zero (esperado se houver diffs). Continuando…");
}

// Coleta todos os pares (actual, diff) em test-results/
function collectDiffs(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectDiffs(full));
    else if (entry.endsWith("-diff.png")) {
      const actual = full.replace(/-diff\.png$/, "-actual.png");
      const expected = full.replace(/-diff\.png$/, "-expected.png");
      const viewport =
        (basename(full).match(/(mobile|tablet|desktop)/) ?? [])[1] ?? "unknown";
      const diffBytes = statSync(full).size;
      out.push({ diff: full, actual, expected, viewport, diffBytes });
    }
  }
  return out;
}

const diffs = collectDiffs("test-results");
console.log(`▶ ${diffs.length} par(es) de diff encontrado(s).`);

// Heurística de simulação: assumimos que o diff PNG é proporcional ao número
// de pixels alterados. Para uma calibragem real de `threshold`, seria preciso
// re-executar o pixelmatch — aqui aproximamos ordenando os diffs por tamanho
// e testando quais passariam com cada `maxDiffPixelRatio`.
// O `threshold` afeta a contagem: valores maiores → menos pixels contam como
// diff. Modelamos com uma redução linear proporcional (grosseira mas útil
// para ordenar candidatos).
function simulate({ threshold, ratio }, d) {
  const raw = d.diffBytes;
  const adjusted = raw * (1 - threshold * 0.6); // heurística: threshold reduz pixels contados
  const totalArea = 1_000_000; // normalização (~1MP)
  const ratioObserved = adjusted / totalArea;
  return ratioObserved > ratio; // true = falharia
}

const combos = [];
for (const threshold of THRESHOLDS) {
  for (const ratio of RATIOS) {
    const perViewport = { mobile: 0, tablet: 0, desktop: 0, unknown: 0 };
    let total = 0;
    for (const d of diffs) {
      if (simulate({ threshold, ratio }, d)) {
        perViewport[d.viewport] = (perViewport[d.viewport] ?? 0) + 1;
        total++;
      }
    }
    combos.push({ threshold, ratio, total, perViewport });
  }
}

combos.sort((a, b) => a.total - b.total || a.ratio - b.ratio);

// Relatório markdown
const md = [
  "# Calibragem do diff visual — Colapso do LocationPanel",
  "",
  `Gerado em ${new Date().toISOString()}`,
  `Diffs processados: **${diffs.length}**`,
  "",
  "## Combinações (menos falhas primeiro)",
  "",
  "| threshold | maxDiffPixelRatio | Falhas | mobile | tablet | desktop |",
  "| ---: | ---: | ---: | ---: | ---: | ---: |",
  ...combos.map(
    (c) =>
      `| ${c.threshold} | ${c.ratio} | **${c.total}** | ${c.perViewport.mobile ?? 0} | ${c.perViewport.tablet ?? 0} | ${c.perViewport.desktop ?? 0} |`,
  ),
  "",
  "## Como interpretar",
  "",
  "- **Falhas = 0**: par candidato — o menor `threshold` + menor `ratio` com zero falhas é o mais seguro.",
  "- **Falhas > 0**: par ainda deixa regressões conhecidas passarem despercebidas.",
  "- A simulação é heurística (baseada no tamanho do `-diff.png`); use como guia inicial e valide re-rodando o spec com os valores escolhidos.",
  "",
  "Atualize `SCREENSHOT_OPTS` em `e2e/customization/collapse-reflow.spec.ts` com o par escolhido.",
].join("\n");

writeFileSync(join(OUT_DIR, "calibration.md"), md, "utf8");
writeFileSync(
  join(OUT_DIR, "calibration.json"),
  JSON.stringify({ diffs: diffs.length, combos, dryRun: DRY_RUN }, null, 2),
  "utf8",
);

// Um CSV enriquecido por viewport com métricas por combinação.
// Colunas:
//   threshold | maxDiffPixelRatio | failures        (falhas simuladas neste vp)
//   total_failures                                  (soma em todos os vp)
//   diffs_in_viewport                               (nº de diff.png do vp bruto)
//   avg_diff_bytes | avg_pct_pixels                 (média das métricas dos diffs)
//   artifacts_dir                                   (onde inspecionar os PNGs)
for (const vp of ["mobile", "tablet", "desktop"]) {
  const vpDiffs = diffs.filter((d) => d.viewport === vp);
  const avgBytes = vpDiffs.length
    ? Math.round(vpDiffs.reduce((s, d) => s + d.diffBytes, 0) / vpDiffs.length)
    : 0;
  // Aproximação: pixels alterados ≈ bytes do diff PNG / 4 (RGBA) — heurística
  // consistente entre viewports; % relativa à área ~1MP usada em simulate().
  const avgPct = vpDiffs.length ? (avgBytes / 4 / 1_000_000) * 100 : 0;
  const artifactsDir = DRY_RUN
    ? `visual-diff-report/dry-run/${vp}/`
    : `test-results/ (filtrar por *${vp}*)`;
  const lines = [
    "threshold,maxDiffPixelRatio,failures,total_failures,diffs_in_viewport,avg_diff_bytes,avg_pct_pixels,artifacts_dir",
  ];
  for (const c of combos) {
    lines.push(
      [
        c.threshold,
        c.ratio,
        c.perViewport[vp] ?? 0,
        c.total,
        vpDiffs.length,
        avgBytes,
        avgPct.toFixed(4),
        `"${artifactsDir}"`,
      ].join(","),
    );
  }
  writeFileSync(join(OUT_DIR, `calibration-${vp}.csv`), lines.join("\n"), "utf8");
}

// DRY-RUN: espelha os PNGs (actual + diff + expected) em visual-diff-report/
// para que o artifact publicado permita inspeção visual sem quebrar o job.
if (DRY_RUN && diffs.length > 0) {
  const { copyFileSync } = await import("node:fs");
  for (const d of diffs) {
    const vpDir = join(OUT_DIR, "dry-run", d.viewport);
    mkdirSync(vpDir, { recursive: true });
    const copy = (src, name) => {
      try {
        if (existsSync(src)) copyFileSync(src, join(vpDir, name));
      } catch {
        /* best-effort */
      }
    };
    const base = basename(d.diff).replace(/-diff\.png$/, "");
    copy(d.diff, `${base}-diff.png`);
    copy(d.actual, `${base}-actual.png`);
    copy(d.expected, `${base}-expected.png`);
  }
  console.log(`✓ Dry-run: PNGs espelhados em ${OUT_DIR}/dry-run/{mobile,tablet,desktop}/`);
}

console.log(`\n✓ Relatório: ${OUT_DIR}/calibration.md`);
console.log(`✓ Dados brutos: ${OUT_DIR}/calibration.json`);
console.log(`✓ CSVs por viewport: ${OUT_DIR}/calibration-{mobile,tablet,desktop}.csv`);
if (DRY_RUN) {
  console.log("ℹ️  Modo dry-run: exit 0 mesmo com diffs (nada falhou o job).");
}
if (combos[0]) {
  console.log(
    `\n💡 Menor combinação com ${combos[0].total} falha(s): threshold=${combos[0].threshold}, maxDiffPixelRatio=${combos[0].ratio}`,
  );
}
// Em dry-run sempre saímos 0.
if (DRY_RUN) process.exit(0);

