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
 *
 * Implementação: busca nativa Node.js (sem dependência de `rg` ou sistema).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PATTERNS = [
  /QuoteCommentsSection/,
  /useQuoteComments/,
  /from\(['"]quote_comments['"]\)/,
];

const ALLOW = [
  /^src\/integrations\/supabase\/types\.ts$/,
  /^scripts\/check-no-quote-comments\.mjs$/,
  /^supabase\/migrations\//,
  /^qa\//,
  /^docs\//,
];

const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git"]);

const SEARCH_ROOTS = ["src", "scripts", "e2e", "tests"];

const cwd = process.cwd();
const violations = [];

function walkDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return; // directory may not exist (e.g., "tests" or "e2e")
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkDir(full);
    } else if (stat.isFile()) {
      scanFile(full);
    }
  }
}

function scanFile(full) {
  const rel = relative(cwd, full);
  if (ALLOW.some((re) => re.test(rel))) return;

  let content;
  try {
    content = readFileSync(full, "utf8");
  } catch {
    return; // binary or unreadable file — skip
  }

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of PATTERNS) {
      if (pattern.test(line)) {
        violations.push(`  ${rel}:${i + 1}:${line}`);
        break; // one violation per line is enough
      }
    }
  }
}

for (const root of SEARCH_ROOTS) {
  walkDir(join(cwd, root));
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
