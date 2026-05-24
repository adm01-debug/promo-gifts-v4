#!/usr/bin/env node
/**
 * Gate de CI: bloqueia qualquer reintrodução de chaves de bypass hardcoded
 * em código de auth ou edge functions.
 *
 * Contexto (auditoria back-end sênior 2026-05-22, achado SEC-001):
 *   `_shared/auth.ts` continha `ELITE_SIM_KEY = "a46c3981-..."` aceito como
 *   Bearer token, devolvendo userRole='dev' + service_role client. Bypass
 *   remoto total em ~64 edges. Mesmo UUID estava em
 *   `test-contract-orchestrator/index.ts` como `SIM_BYPASS`.
 *
 * O fix correto é usar `SIMULATION_BYPASS_KEY` do vault/env via
 * `resolveCredential()` ou `Deno.env.get()`, com comparação em tempo constante
 * (`constantTimeEqual` em `_shared/dispatcher-auth.ts`).
 *
 * Este script falha o build se:
 *   1. Qualquer UUID v4 literal aparece em código de auth/bridge.
 *   2. Constantes nomeadas como `*BYPASS_KEY`/`*BYPASS`/`*SIM_KEY` ganham
 *      atribuição com string literal.
 *
 * Allowlist:
 *   - Fixtures de teste em `tests/`/`e2e/`.
 *   - O próprio baseline (`.tsc-baseline.json` etc.) pode conter o UUID se
 *     houver histórico — esse caso é improvável e seria reportado.
 *
 * Saídas:
 *   exit 0 — sem violações.
 *   exit 1 — violação encontrada (lista até 50 ocorrências).
 *
 * Uso:
 *   node scripts/check-no-bypass-literals.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

// Caminhos sob auditoria forte (auth, bridges, edge functions críticas).
const TARGET_DIRS = [
  "supabase/functions",
  "src/lib/auth",
  "src/integrations/supabase",
  "src/contexts",
];

// Paths que NÃO devem ser varridos (fixtures de teste, baseline JSON, etc.).
const SKIP_PATTERNS = [
  /\/__tests__\//,
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
  /\/tests?\//,
  /\/e2e\//,
  /\/node_modules\//,
  /\.gitleaks\./,
  /\.eslint-baseline\.json$/,
  /\.tsc-baseline\.json$/,
  /\.toast-leaks-baseline\.json$/,
];

// 1) UUID v4 literal proibido (qualquer ocorrência fora de allowlist).
const UUID_RE = /["'`]([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})["'`]/gi;

// 2) Atribuição direta a constante chamada algo-BYPASS-algo com literal string.
//    Captura: const SIM_BYPASS = "...";  let ELITE_SIM_KEY = '...';  etc.
const BYPASS_ASSIGN_RE = /\b(const|let|var)\s+([A-Z_][A-Z0-9_]*(?:BYPASS|SIM_KEY|SIMULATION_KEY|ELITE_KEY)[A-Z0-9_]*)\s*=\s*["'`]([^"'`\s]{12,})["'`]/g;

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_PATTERNS.some((re) => re.test(full + "/"))) continue;
      out.push(...walk(full));
    } else if (st.isFile() && /\.(ts|tsx|js|mjs|cjs)$/.test(name)) {
      if (SKIP_PATTERNS.some((re) => re.test(full))) continue;
      out.push(full);
    }
  }
  return out;
}

const files = [];
for (const dir of TARGET_DIRS) {
  files.push(...walk(join(ROOT, dir)));
}

const violations = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // (1) UUIDs literais. Permitimos UUIDs em arquivos `*-aliases.ts` e similares
    // se acompanhados de comentário `// fixture` ou `// allowed:`.
    UUID_RE.lastIndex = 0;
    const uuidMatch = UUID_RE.exec(line);
    if (uuidMatch) {
      const allowed = /\b(fixture|allowed|seed|test-only)\b/i.test(line);
      if (!allowed) {
        violations.push({
          file: rel,
          line: i + 1,
          rule: "uuid_literal_in_auth_code",
          snippet: line.trim().slice(0, 160),
        });
      }
    }

    // (2) Atribuição literal a constante BYPASS/SIM_KEY.
    BYPASS_ASSIGN_RE.lastIndex = 0;
    const assignMatch = BYPASS_ASSIGN_RE.exec(line);
    if (assignMatch) {
      violations.push({
        file: rel,
        line: i + 1,
        rule: `bypass_constant_literal:${assignMatch[2]}`,
        snippet: line.trim().slice(0, 160),
      });
    }
  }
}

if (violations.length === 0) {
  console.log("✅ Nenhuma chave de bypass hardcoded encontrada em código de auth/bridge.");
  process.exit(0);
}

console.error(`❌ ${violations.length} violação(ões) de chave-bypass-hardcoded detectada(s):`);
console.error("");
const MAX_LIST = 50;
for (const v of violations.slice(0, MAX_LIST)) {
  console.error(`  ${v.file}:${v.line}  [${v.rule}]`);
  console.error(`    ${v.snippet}`);
}
if (violations.length > MAX_LIST) {
  console.error(`  ... e mais ${violations.length - MAX_LIST} ocorrência(s).`);
}
console.error("");
console.error("Como corrigir:");
console.error("  • Mover o valor para SIMULATION_BYPASS_KEY no vault (integration_credentials)");
console.error("    OU em Deno.env (edge function secret).");
console.error("  • Ler via `resolveCredential('SIMULATION_BYPASS_KEY', supabase)`.");
console.error("  • Comparar com `constantTimeEqual()` de `_shared/dispatcher-auth.ts`.");
console.error("  • Ver: audit/ANALISE_BACKEND_SENIOR_2026-05-22.md (SEC-001).");
process.exit(1);
