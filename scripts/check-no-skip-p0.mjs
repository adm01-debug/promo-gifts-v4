#!/usr/bin/env node
/**
 * Gate: bloqueia merge se houver testes P0 skipados (`it.skip`, `describe.skip`,
 * `xit`, `xdescribe`, `.only`, `.fixme`) em tests/p0/.
 *
 * Testes em e2e/flows/p0/ (Playwright) são tratados como WARN — exigem app +
 * Supabase + seeds rodando; cobertura é rastreada em e2e/flows/p0/README.md.
 *
 * Justificativa: testes P0 cobrem fronteiras de segurança/integridade.
 * `skip` é um anti-pattern silencioso que esconde regressão. Para parquear um
 * caso temporariamente, mova-o para tests/wontfix/ com README explicando.
 *
 * Uso:
 *   node scripts/check-no-skip-p0.mjs              # gate completo
 *   node scripts/check-no-skip-p0.mjs --warn-e2e   # default (e2e P0 vira WARN)
 *   node scripts/check-no-skip-p0.mjs --strict     # falha também em e2e P0
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");

const TARGETS = [
  { dir: join(ROOT, "tests", "p0"), severity: "fail" },
  { dir: join(ROOT, "e2e", "flows", "p0"), severity: STRICT ? "fail" : "warn" },
];

const SKIP_PATTERNS = [
  /\bit\.skip\(/g,
  /\bdescribe\.skip\(/g,
  /\btest\.skip\(/g,
  /\bxit\(/g,
  /\bxdescribe\(/g,
  /\bit\.only\(/g,
  /\bdescribe\.only\(/g,
  /\btest\.only\(/g,
  /\bit\.fixme\(/g,
  /\btest\.fixme\(/g,
];

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name.startsWith("_") || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|mjs|cjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

let failures = 0;
let warnings = 0;

for (const { dir, severity } of TARGETS) {
  const localViolations = [];
  for (const file of walk(dir)) {
    const src = readFileSync(file, "utf8");
    for (const pat of SKIP_PATTERNS) {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(src)) !== null) {
        const lineNo = src.slice(0, m.index).split("\n").length;
        localViolations.push({ file, line: lineNo, match: m[0] });
      }
    }
  }
  if (localViolations.length === 0) continue;

  const icon = severity === "fail" ? "❌" : "⚠️";
  const label = severity === "fail" ? "BLOQUEADO" : "AVISO";
  console.error(
    `\n${icon} [${label}] ${localViolations.length} skip/only/fixme em ${dir.replace(ROOT + "/", "")}:`,
  );
  for (const v of localViolations) {
    const rel = v.file.replace(ROOT + "/", "");
    console.error(`  ${rel}:${v.line}  →  ${v.match}`);
  }
  if (severity === "fail") failures += localViolations.length;
  else warnings += localViolations.length;
}

if (failures > 0) {
  console.error(
    "\nP0 cobre fronteiras de segurança/integridade. Skip mascara regressão.\n" +
      "Para parquear, mova para tests/wontfix/ com README explicando.\n",
  );
  process.exit(1);
}

if (warnings > 0) {
  console.error(
    `\n⚠️  ${warnings} skip(s) em e2e/flows/p0/ — documentar em e2e/flows/p0/README.md.\n` +
      "Use --strict para que esses também bloqueiem.\n",
  );
}

console.log(`✓ Sem skip/only/fixme em tests/p0/ (e2e P0 verificado como WARN)`);
