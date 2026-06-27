#!/usr/bin/env node
/**
 * Gate: garante que `QuoteCommentsSection`, `useQuoteComments` e queries em
 * `quote_comments` foram totalmente removidas do código de aplicação.
 *
 * Falha o CI se qualquer referência residual reaparecer (regressão acidental
 * via auto-import, merge ou regeneração de types).
 *
 * Tolera:
 *  - `src/integrations/supabase/types.ts` (auto-gerado; só desaparece após
 *    a próxima regeneração pós-DROP TABLE).
 *  - Próprio arquivo do gate.
 *  - Migrations SQL (histórico imutável).
 */
import { spawnSync } from "node:child_process";
import { relative } from "node:path";

const PATTERNS = [
  "QuoteCommentsSection",
  "useQuoteComments",
  String.raw`from\(['"]quote_comments['"]\)`,

];

const ALLOW = [
  /^src\/integrations\/supabase\/types\.ts$/,
  /^scripts\/check-no-quote-comments\.mjs$/,
  /^supabase\/migrations\//,
  /^qa\//,
  /^docs\//,
];

const cwd = process.cwd();
const violations = [];

for (const pattern of PATTERNS) {
  const res = spawnSync(
    "rg",
    [
      "-n",
      "--no-heading",
      "--glob",
      "!node_modules",
      "--glob",
      "!dist",
      "--glob",
      "!coverage",
      "--glob",
      "!.git",
      pattern,
      "src",
      "scripts",
      "e2e",
      "tests",
    ],
    { encoding: "utf8" },
  );
  if (res.status !== 0 && res.status !== 1) {
    console.error("rg falhou:", res.stderr);
    process.exit(2);
  }
  for (const line of (res.stdout || "").split("\n").filter(Boolean)) {
    const [file] = line.split(":");
    const rel = relative(cwd, file);
    if (ALLOW.some((re) => re.test(rel))) continue;
    violations.push(`  ${line}`);
  }
}


if (violations.length > 0) {
  console.error(
    "❌ Referências residuais a QuoteComments/quote_comments detectadas:\n" +
      violations.join("\n") +
      "\n\nA funcionalidade foi removida. Remova as referências acima.",
  );
  process.exit(1);
}

console.log("✅ Sem referências residuais a QuoteCommentsSection/useQuoteComments/quote_comments.");
