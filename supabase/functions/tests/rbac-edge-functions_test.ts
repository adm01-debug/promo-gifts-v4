/**
 * RBAC regression tests — garante que rotas/edge functions técnicas só são
 * acessíveis a `dev` e que supervisor/agente não conseguem escalar.
 *
 * Há duas camadas:
 *
 *  1. **Source-level gate check**: lê o código de cada edge function
 *     privilegiada e exige presença do gate `is_dev` (RPC) ou `requireDev`
 *     (helper compartilhado). Se alguém remover o check, o teste falha.
 *     Roda 100% offline — não precisa de service_role key.
 *
 *  2. **RLS-level check (DB)**: confirma que as policies SELECT/ALL das
 *     tabelas técnicas usam `is_dev(auth.uid())` — bloqueando supervisor
 *     e agente mesmo se o frontend for contornado.
 *
 * Cobertura E2E (executar JWT real contra a função) requer
 * `SUPABASE_SERVICE_ROLE_KEY` no env de testes — não disponível no runner
 * padrão. Os dois checks abaixo cobrem as duas frentes que importam:
 * código + dados.
 */

import { assert, assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";
const pool = DB_URL ? new Pool(DB_URL, 2, true) : null;

// ============================================================
// 1. SOURCE-LEVEL GATE CHECK
// ============================================================

interface GateExpectation {
  fn: string;
  /** Pelo menos um dos padrões abaixo deve aparecer no index.ts */
  patterns: RegExp[];
  description: string;
}

/**
 * Edge functions que NUNCA podem ser invocadas por supervisor/agente.
 * Cada entrada lista os padrões aceitos para o role gate.
 */
const PRIVILEGED_FUNCTIONS: GateExpectation[] = [
  {
    fn: "mcp-keys-issue",
    patterns: [/admin\.rpc\(["']is_dev["']/],
    description: "Emissão de chaves MCP",
  },
  {
    fn: "mcp-keys-revoke",
    patterns: [/admin\.rpc\(["']is_dev["']/],
    description: "Revogação de chaves MCP",
  },
  {
    fn: "mcp-keys-rotate",
    patterns: [/admin\.rpc\(["']is_dev["']/],
    description: "Rotação de chaves MCP",
  },
  {
    fn: "mcp-keys-update",
    patterns: [/admin\.rpc\(["']is_dev["']/],
    description: "Atualização de chaves MCP",
  },
  {
    fn: "connections-hub-audit",
    patterns: [/requireDev\s*\(/],
    description: "Auditoria do hub de conexões",
  },
  {
    fn: "secrets-manager",
    patterns: [/role === ["']dev["']/, /isDev/],
    description: "Gerência de credenciais técnicas",
  },
];

for (const { fn, patterns, description } of PRIVILEGED_FUNCTIONS) {
  Deno.test({
    name: `[gate] ${fn} (${description}) exige perfil dev`,
    fn: async () => {
      const path = new URL(`../${fn}/index.ts`, import.meta.url);
      const source = await Deno.readTextFile(path);

      const matched = patterns.some((p) => p.test(source));
      assert(
        matched,
        `Edge function "${fn}" não tem gate dev-only no código.\n` +
          `Esperava casar um destes: ${patterns.map((p) => p.toString()).join(", ")}.\n` +
          `Sem este gate, supervisor/agente conseguiriam invocar ${description}.`,
      );

      // Defesa adicional: deve retornar 403 em algum caminho (literal ou via
      // helper que propaga `status: 403` lançado por requireDev).
      const has403Path =
        /\b403\b/.test(source) ||
        /requireDev\s*\(/.test(source) ||
        /authErrorResponse/.test(source);
      assert(
        has403Path,
        `Edge function "${fn}" não tem caminho que retorne 403 — ` +
          `verifique se o role check responde adequadamente.`,
      );
    },
  });
}

// ============================================================
// 2. RLS-LEVEL CHECK (defesa em profundidade)
// ============================================================

interface PolicyRow {
  polname: string;
  cmd: string;
  qual: string | null;
}

async function getPolicies(table: string): Promise<PolicyRow[]> {
  if (!pool) return [];
  const c = await pool.connect();
  try {
    const r = await c.queryObject<PolicyRow>(`
      SELECT polname,
        CASE polcmd
          WHEN 'r' THEN 'SELECT'
          WHEN 'a' THEN 'INSERT'
          WHEN 'w' THEN 'UPDATE'
          WHEN 'd' THEN 'DELETE'
          WHEN '*' THEN 'ALL'
        END as cmd,
        pg_get_expr(polqual, polrelid) as qual
      FROM pg_policy
      WHERE polrelid = ('public.' || $1)::regclass
      ORDER BY polname
    `, [table]);
    return r.rows;
  } finally {
    c.release();
  }
}

/**
 * Tabelas técnicas: a leitura/gerência por usuários autenticados deve
 * estar restrita a `is_dev(auth.uid())`.
 */
const TECHNICAL_TABLES = [
  "query_telemetry",
  "optimization_queue",
  "bot_detection_log",
  "ip_access_control",
  "request_rate_limits",
];

for (const table of TECHNICAL_TABLES) {
  Deno.test({
    name: `[rls] ${table}: SELECT/ALL para authenticated exige is_dev`,
    ignore: !pool,
    fn: async () => {
      const policies = await getPolicies(table);

      // Pega policies de leitura (SELECT ou ALL) — ignora as de service_role
      // que sempre têm qual="true"
      const readPolicies = policies.filter(
        (p) => (p.cmd === "SELECT" || p.cmd === "ALL") && p.qual !== "true",
      );

      assert(
        readPolicies.length > 0,
        `${table} não tem policy SELECT/ALL para usuários autenticados`,
      );

      const allUseIsDev = readPolicies.every((p) =>
        p.qual?.includes("is_dev")
      );

      assert(
        allUseIsDev,
        `${table}: policies de leitura não usam is_dev — ` +
          `supervisor/agente podem ler dados técnicos!\n` +
          policies
            .map((p) => `  ${p.polname} (${p.cmd}): ${p.qual}`)
            .join("\n"),
      );
    },
  });
}

// ============================================================
// 3. SANITY: query_telemetry NÃO deve ter policy admin-only
// (regressão do hardening passado)
// ============================================================
Deno.test({
  name: "[regressão] query_telemetry NÃO deve mais ter policy is_admin",
  ignore: !pool,
  fn: async () => {
    const policies = await getPolicies("query_telemetry");
    const adminLeaks = policies.filter(
      (p) =>
        (p.cmd === "SELECT" || p.cmd === "ALL") &&
        p.qual?.includes("is_admin") &&
        !p.qual.includes("is_dev"),
    );
    assertEquals(
      adminLeaks.length,
      0,
      `query_telemetry tem policies que aceitam admin sem ser dev: ` +
        adminLeaks.map((p) => p.polname).join(", "),
    );
  },
});

// ============================================================
// teardown
// ============================================================
globalThis.addEventListener("unload", () => {
  if (pool) pool.end().catch(() => {});
});
