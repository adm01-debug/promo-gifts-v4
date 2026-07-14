#!/usr/bin/env node
/**
 * A11y gate — WCAG 2.4.7 (Focus Visible).
 *
 * Regra: qualquer `className` (string literal ou template literal) que declare
 * `outline-none` DEVE oferecer uma affordance de foco substituta no MESMO
 * literal — um token `ring-*` sob variant de foco (`focus:` ou `focus-visible:`),
 * ou pelo menos um `ring-*` bare que passe a ser pintado sob foco por outra
 * regra do design system (ex.: `ring-offset-*` + `focus-visible:ring-2`).
 *
 * Motivação: `outline-none` sem ring substituto anula o affordance nativo do
 * browser e quebra WCAG 2.4.7. Invariante já validado em runtime pelo caso A4
 * de `tests/utils/tailwindRings.interaction.test.tsx`; este gate propaga o
 * invariante para o codebase inteiro (estática, sem execução).
 *
 * Escopo: `src/**` .ts/.tsx (código de aplicação). CSS/PostCSS ignorados
 * porque `outline-none` puro em `@apply`/`@layer` costuma vir acompanhado
 * de `focus-visible:` em outra regra do mesmo bloco.
 *
 * Falha o build no primeiro literal violador com file:line e o trecho ofensor.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const EXTS = new Set([".ts", ".tsx"]);

/** Diretórios que não precisam do gate (tests, mocks, storybook, tipos). */
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

/**
 * Extrai literais de string plausivelmente-className (strings simples e
 * template literals). Preserva line numbers para report legível.
 */
function extractLiterals(src) {
  const lits = [];
  const re = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const value = m[2];
    // Rápido: só nos interessa se o literal contiver classe-alvo.
    if (!value.includes("outline-none")) continue;
    const idx = m.index;
    const line = src.slice(0, idx).split("\n").length;
    lits.push({ value, line });
  }
  return lits;
}

/**
 * Um literal "OK" contém `outline-none` E pelo menos uma affordance de ring:
 *   - `focus:ring-*`
 *   - `focus-visible:ring-*`
 *   - `focus-within:ring-*`
 *   - `ring-<algo>` bare (design system aplica sob foco)
 *
 * Rejeita apenas `ring-offset-*` isolado — offset sem ring não pinta nada.
 */
const RING_RE = /(?:focus(?:-visible|-within)?:)?ring-(?!offset\b)[\w[\]/.\-]+/;

function isViolation(literal) {
  return !RING_RE.test(literal);
}

const files = walk(ROOT);
const violations = [];

for (const file of files) {
  let src;
  try { src = readFileSync(file, "utf8"); } catch { continue; }
  if (!src.includes("outline-none")) continue;
  for (const { value, line } of extractLiterals(src)) {
    if (isViolation(value)) {
      const snippet = value.length > 140 ? value.slice(0, 137) + "…" : value;
      violations.push({ file, line, snippet });
    }
  }
}

if (violations.length > 0) {
  console.error(
    `❌ outline-none a11y gate falhou (${violations.length} violação${violations.length === 1 ? "" : "es"}):`,
  );
  console.error(
    `   Regra WCAG 2.4.7: todo className com "outline-none" DEVE incluir um ring substituto\n` +
    `   (focus:ring-*, focus-visible:ring-*, focus-within:ring-* ou ring-* bare) no MESMO literal.\n`,
  );
  for (const v of violations) {
    console.error(`  • ${v.file}:${v.line}`);
    console.error(`    "${v.snippet}"`);
  }
  console.error(
    `\nFix: adicione algo como "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" no mesmo className.`,
  );
  process.exit(1);
}

console.log(`✅ outline-none a11y gate: ${files.length} arquivos varridos, nenhuma violação de WCAG 2.4.7.`);
