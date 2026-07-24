#!/usr/bin/env node
/**
 * check-edge-request-id-propagation.mjs
 * ----------------------------------------------------------------
 * Gate de CI complementar ao `check-edge-structured-logging.mjs`.
 *
 * Para cada edge function listada em `CRITICAL_EDGES` (rotas críticas
 * que JÁ adotaram o logger SSOT), valida:
 *
 *   (A) LOGGER SSOT
 *       Importa `createStructuredLogger` (de `_shared/structured-logger.ts`)
 *       OU `getOrCreateRequestId` (de `_shared/request-id.ts`).
 *
 *   (B) PROPAGAÇÃO NO RESPONSE
 *       Toda resposta sai com `X-Request-Id`. Aceita um destes sinais:
 *         - `log.respond(` (wrapper do logger SSOT)
 *         - `withRequestIdHeader(` (helper)
 *         - menção literal a `REQUEST_ID_HEADER` ou `'X-Request-Id'`
 *           setada em headers de resposta.
 *
 *   (C) PROPAGAÇÃO EM CALLS INTERNOS
 *       Toda chamada `fetch(.../functions/v1/...)` ou
 *       `supabase.functions.invoke(...)` precisa, em janela de 30 linhas,
 *       conter `X-Request-Id` / `REQUEST_ID_HEADER` no bloco de headers.
 *
 * Heurística pragmática (regex + janela), zero dependências, exit 1 em violação.
 *
 * Variáveis úteis:
 *   - `LIST_ONLY=1` → imprime CRITICAL_EDGES e sai 0.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FN_ROOT = "supabase/functions";

// ⚠️  Snapshot 2026-04-27. Edges que JÁ usam o logger SSOT/request-id helpers.
//    Novas edges críticas DEVEM ser adicionadas AQUI (não na allowlist legada
//    do gate de structured-logging).
const CRITICAL_EDGES = [
  // ── Rotas críticas originais (snapshot 2026-04-27) ──────────────────────
  "connections-hub-audit",
  "crm-db-bridge",
  "external-db-bridge",
  "mcp-keys-issue",
  "mcp-keys-revoke",
  "mcp-keys-rotate",
  "mcp-keys-update",
  "mcp-server",
  "secrets-manager",
  // ── P1 observability wave (2026-06-18) — protegidas contra regressão Lovable ──
  // Regressão detectada: commit 8c57c1ed reverteu silenciosamente structured
  // logger + request-id de todas estas funções sem aviso. Adicionadas ao gate
  // para que qualquer revert futuro seja bloqueado no CI antes do merge.
  "asia-ingestion",
  "audit-suite",
  "backfill-image-dimensions",
  "check-login",
  "generate-blurhashes",
  "hash-product-images",
  "simulation-orchestrator",
  "word-magic",
];

// ----------------------------------------------------------------------------
// Regex SSOT
// ----------------------------------------------------------------------------
const RX_LOGGER = /createStructuredLogger\s*\(|getOrCreateRequestId\s*\(/;
const RX_RESPOND_OK =
  /\blog\.respond\s*\(|\bwithRequestIdHeader\s*\(|REQUEST_ID_HEADER|["']X-Request-Id["']/i;

// Calls internas: fetch para outra edge function ou supabase.functions.invoke
const RX_INTERNAL_CALL =
  /\bfetch\s*\(\s*[^)]*\/functions\/v1\/|supabase\.functions\.invoke\s*\(/g;

const RX_REQUEST_ID_TOKEN = /REQUEST_ID_HEADER|["']X-Request-Id["']|x-request-id/i;
const WINDOW_LINES = 30;

// ----------------------------------------------------------------------------
function readSource(name) {
  for (const file of ["index.ts", "index.tsx"]) {
    const p = join(FN_ROOT, name, file);
    if (existsSync(p)) return { src: readFileSync(p, "utf8"), path: p };
  }
  return null;
}

function checkLogger(src) {
  return RX_LOGGER.test(src);
}

function checkResponsePropagation(src) {
  // Pelo menos UMA evidência de que o handler injeta X-Request-Id no response.
  return RX_RESPOND_OK.test(src);
}

function checkInternalCalls(src, lines) {
  const violations = [];
  let m;
  while ((m = RX_INTERNAL_CALL.exec(src))) {
    const idx = m.index;
    // Linha 1-based
    const line = src.slice(0, idx).split("\n").length;
    const start = Math.max(0, line - 1);
    const end = Math.min(lines.length, line + WINDOW_LINES);
    const window = lines.slice(start, end).join("\n");
    if (!RX_REQUEST_ID_TOKEN.test(window)) {
      violations.push({ line, snippet: lines[line - 1]?.trim()?.slice(0, 120) ?? "" });
    }
  }
  return violations;
}

function main() {
  if (process.env.LIST_ONLY === "1") {
    console.log("CRITICAL_EDGES:");
    for (const e of CRITICAL_EDGES) console.log(`  • ${e}`);
    process.exit(0);
  }

  const violations = [];

  for (const name of CRITICAL_EDGES) {
    const found = readSource(name);
    if (!found) {
      violations.push({
        edge: name,
        kind: "missing",
        detail: "edge function não encontrada — atualize CRITICAL_EDGES",
      });
      continue;
    }
    const { src, path } = found;
    const lines = src.split("\n");

    if (!checkLogger(src)) {
      violations.push({
        edge: name,
        kind: "logger_missing",
        detail: `${path}: não importa createStructuredLogger nem getOrCreateRequestId`,
      });
    }

    if (!checkResponsePropagation(src)) {
      violations.push({
        edge: name,
        kind: "response_no_propagation",
        detail:
          `${path}: nenhum response propaga X-Request-Id ` +
          "(use `log.respond(res)`, `withRequestIdHeader(...)` ou setar `REQUEST_ID_HEADER`).",
      });
    }

    const internalViols = checkInternalCalls(src, lines);
    for (const v of internalViols) {
      violations.push({
        edge: name,
        kind: "internal_call_no_request_id",
        detail:
          `${path}:${v.line}: chamada interna sem X-Request-Id em janela de ${WINDOW_LINES} linhas\n` +
          `        ${v.snippet}`,
      });
    }
  }

  if (violations.length === 0) {
    console.log(
      `✅ Edge request-id propagation gate OK — ${CRITICAL_EDGES.length} edges críticas validadas ` +
        "(logger + response + calls internos).",
    );
    process.exit(0);
  }

  console.error("\n❌ Edge request-id propagation — violações:\n");
  const grouped = new Map();
  for (const v of violations) {
    if (!grouped.has(v.edge)) grouped.set(v.edge, []);
    grouped.get(v.edge).push(v);
  }
  for (const [edge, items] of grouped) {
    console.error(`  ▸ ${edge}`);
    for (const it of items) console.error(`      [${it.kind}] ${it.detail}`);
  }
  console.error(
    "\n  → Padrão SSOT: docs/OBSERVABILITY.md §1 (correlação X-Request-Id)\n" +
      "  → Helpers: supabase/functions/_shared/{request-id.ts,structured-logger.ts}\n",
  );
  process.exit(1);
}

main();
