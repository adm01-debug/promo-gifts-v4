#!/usr/bin/env node
/**
 * A11y gate — WCAG 2.4.7 (Focus Visible).
 *
 * Regra: qualquer `className` (string ou template literal) que declare
 * `outline-none` DEVE oferecer uma affordance de foco substituta no MESMO
 * literal — um token `ring-*` sob variant de foco (`focus:` / `focus-visible:` /
 * `focus-within:`) ou um `ring-*` bare (o design system pinta sob foco por
 * outra regra). `ring-offset-*` isolado NÃO conta — offset sem ring não pinta.
 *
 * Motivação: `outline-none` sem ring substituto anula o affordance nativo do
 * browser e quebra WCAG 2.4.7. Invariante já validado em runtime pelo caso A4
 * de `tests/utils/tailwindRings.interaction.test.tsx`; este gate propaga o
 * invariante para o codebase inteiro (estática, sem execução).
 *
 * Modo: ratchet. Baseline `.outline-none-baseline.json` congela os literais
 * legados (snapshot inicial: 20 arquivos). Apenas violações NOVAS quebram o
 * build. Para regenerar após corrigir legados:
 *   UPDATE_BASELINE=1 node scripts/check-outline-none.mjs
 *
 * Escopo: `src/**` .ts/.tsx (código de aplicação). CSS/PostCSS ignorados.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = "src";
const EXTS = new Set([".ts", ".tsx"]);
const BASELINE_PATH = ".outline-none-baseline.json";
const UPDATE = process.env.UPDATE_BASELINE === "1";

const SKIP_DIRS = new Set(["__tests__", "tests", "__mocks__", "stories"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      out.push(...walk(full));
    } else {
      const dot = entry.lastIndexOf(".");
      if (dot === -1) continue;
      const ext = entry.slice(dot);
      if (!EXTS.has(ext)) continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      if (entry.endsWith(".spec.ts") || entry.endsWith(".spec.tsx")) continue;
      if (entry.endsWith(".d.ts")) continue;
      out.push(full);
    }
  }
  return out;
}

function extractLiterals(src) {
  const lits = [];
  const re = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const value = m[2];
    if (!value.includes("outline-none")) continue;
    const idx = m.index;
    const line = src.slice(0, idx).split("\n").length;
    lits.push({ value, line });
  }
  return lits;
}

const RING_RE = /(?:focus(?:-visible|-within)?:)?ring-(?!offset\b)[\w[\]/.\-]+/;
const isViolation = (literal) => !RING_RE.test(literal);
const hashLit = (v) => createHash("sha1").update(v).digest("hex").slice(0, 16);

const files = walk(ROOT);
/** @type {{ file: string; line: number; snippet: string; hash: string }[]} */
const violations = [];

for (const file of files) {
  let src;
  try { src = readFileSync(file, "utf8"); } catch { continue; }
  if (!src.includes("outline-none")) continue;
  for (const { value, line } of extractLiterals(src)) {
    if (!isViolation(value)) continue;
    const snippet = value.length > 140 ? value.slice(0, 137) + "…" : value;
    violations.push({ file, line, snippet, hash: hashLit(value) });
  }
}

// Baseline: chave = `${file}::${hash}` — resiliente a line drift.
const currentKeys = new Set(violations.map((v) => `${v.file}::${v.hash}`));

if (UPDATE) {
  const baseline = {
    generatedAt: new Date().toISOString().slice(0, 10),
    description: "Snapshot congelado de violações de outline-none pré-existentes. Novas violações são bloqueadas pelo gate. Regenerar com UPDATE_BASELINE=1.",
    entries: violations
      .map((v) => ({ file: v.file, hash: v.hash, snippet: v.snippet }))
      .sort((a, b) => (a.file + a.hash).localeCompare(b.file + b.hash)),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`✏️  Baseline atualizado: ${BASELINE_PATH} (${violations.length} entradas)`);
  process.exit(0);
}

const baselineKeys = new Set();
if (existsSync(BASELINE_PATH)) {
  try {
    const b = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    for (const e of b.entries ?? []) baselineKeys.add(`${e.file}::${e.hash}`);
  } catch (e) {
    console.error(`❌ Falha ao ler ${BASELINE_PATH}: ${e.message}`);
    process.exit(1);
  }
}

const regressions = violations.filter((v) => !baselineKeys.has(`${v.file}::${v.hash}`));
const fixed = [...baselineKeys].filter((k) => !currentKeys.has(k));

if (regressions.length > 0) {
  console.error(
    `❌ outline-none a11y gate falhou — ${regressions.length} violação${regressions.length === 1 ? "" : "es"} NOVA${regressions.length === 1 ? "" : "S"} (baseline: ${baselineKeys.size}).`,
  );
  console.error(
    `   Regra WCAG 2.4.7: todo className com "outline-none" DEVE incluir um ring substituto\n` +
    `   (focus:ring-*, focus-visible:ring-*, focus-within:ring-* ou ring-* bare) no MESMO literal.\n`,
  );
  for (const v of regressions) {
    console.error(`  • ${v.file}:${v.line}`);
    console.error(`    "${v.snippet}"`);
  }
  console.error(
    `\nFix: adicione "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"` +
    ` (ou equivalente do design system) no MESMO className.`,
  );
  process.exit(1);
}

if (fixed.length > 0) {
  console.log(
    `ℹ️  ${fixed.length} entrada${fixed.length === 1 ? "" : "s"} do baseline não aparece${fixed.length === 1 ? "" : "m"} mais — rode com UPDATE_BASELINE=1 para encolher o baseline:`,
  );
  for (const k of fixed) console.log(`   - ${k}`);
}

console.log(
  `✅ outline-none a11y gate: ${files.length} arquivos varridos, ${violations.length} legados (todos no baseline), 0 regressões.`,
);
