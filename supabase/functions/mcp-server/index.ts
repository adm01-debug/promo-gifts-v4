import { buildPublicCorsHeaders, getCorsHeaders } from "../_shared/cors.ts";
// MCP server for Claude Desktop / other Lovable projects.
// Authenticates via X-MCP-Key header (validated in DB against mcp_api_keys.key_hash).
// Each tool declares { scope, mode } and is gated centrally before running.
// Every tool invocation is audited (granted, denied, error) with consistent error codes.
import { type Context, Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "../_shared/request-id.ts";
import { summarizePayload } from "../_shared/audit-log.ts";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";

// Fallback CORS headers — sobrescritos per-request via getCorsHeaders(c.req.raw).
let corsHeaders: Record<string, string> = buildPublicCorsHeaders();

type ValidateMcpKeyRow = {
  key_id: string;
  scopes: string[] | null;
  block_reason: string | null;
  created_by: string | null;
};

const SOURCE = "mcp-server";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ────────────────────────────────────────────────────────────────────────────
// Scope governance
// ────────────────────────────────────────────────────────────────────────────

type ToolMode = "read" | "write" | "admin";

interface AuthCtx {
  keyId: string;
  scopes: Set<string>;
  isFull: boolean;
  ip: string | null;
  ua: string | null;
  requestId: string;
  startedAt: string;
  startedMs: number;
}

interface ToolGuard {
  scope: string;     // e.g. "quotes:read", "quotes:write"
  mode: ToolMode;    // for audit + UX
}

// Standardized error codes for clients (matches admin_audit_log details.error_code)
const ERR = {
  UNAUTHENTICATED: "MCP_UNAUTHENTICATED",
  KEY_REVOKED: "MCP_KEY_REVOKED",
  KEY_EXPIRED: "MCP_KEY_EXPIRED",
  KEY_AUTO_REVOKED_DEV: "MCP_KEY_AUTO_REVOKED_DEV_LOST",
  SCOPE_MISSING: "MCP_SCOPE_MISSING",
  WRITE_FORBIDDEN: "MCP_WRITE_FORBIDDEN",
  INTERNAL: "MCP_INTERNAL_ERROR",
} as const;

class McpAuthError extends Error {
  code: string;
  status: number;
  meta: Record<string, unknown>;
  constructor(code: string, message: string, status = 403, meta: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}

async function audit(
  action: "mcp_tool.granted" | "mcp_tool.denied" | "mcp_tool.error",
  ctx: AuthCtx | null,
  details: Record<string, unknown>,
  opts: {
    status: "success" | "denied" | "error";
    payloadSummary?: Record<string, unknown>;
  },
) {
  try {
    const finishedAt = new Date().toISOString();
    const startedAt = ctx?.startedAt ?? finishedAt;
    const duration = ctx ? Date.now() - ctx.startedMs : 0;
    await supabase.from("admin_audit_log").insert({
      user_id: null,
      action,
      resource_type: "mcp_api_key",
      resource_id: ctx?.keyId ?? null,
      ip_address: ctx?.ip ?? null,
      user_agent: ctx?.ua ?? null,
      request_id: ctx?.requestId ?? null,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: duration,
      status: opts.status,
      payload_summary: opts.payloadSummary ?? {},
      source: SOURCE,
      details: {
        ...details,
        is_full_access: ctx?.isFull ?? false,
      },
    });
  } catch (_) {
    // never fail the request because of audit failure
  }
}

/** Resultado detalhado de autenticação para suportar auditoria diferenciada. */
type AuthResult =
  | { kind: "ok"; ctx: AuthCtx }
  | {
      kind: "blocked";
      reason: "grantor_lost_dev" | "revoked" | "expired";
      keyId: string | null;
      createdBy: string | null;
    }
  | { kind: "no_key" }
  | { kind: "invalid_key" };

async function authenticate(req: Request): Promise<AuthResult> {
  const key = req.headers.get("x-mcp-key") || "";
  if (!key || key.length < 16) return { kind: "no_key" };

  const { data, error } = await castRpcResult<{
    data: ValidateMcpKeyRow | ValidateMcpKeyRow[] | null;
    error: { message: string } | null;
  }>(supabase.rpc("validate_mcp_key", { _key_plain: key }));
  if (error) return { kind: "invalid_key" };

  const rows: ValidateMcpKeyRow[] = Array.isArray(data) ? data : (data ? [data] : []);
  if (rows.length === 0) return { kind: "invalid_key" };
  const row = rows[0];

  // Block reasons explícitos do RPC: chave existe mas foi rejeitada.
  if (row.block_reason) {
    const reason = row.block_reason as "grantor_lost_dev" | "revoked" | "expired";
    return { kind: "blocked", reason, keyId: row.key_id ?? null, createdBy: row.created_by ?? null };
  }

  if (!row.scopes) return { kind: "invalid_key" };

  const scopes = new Set<string>(row.scopes);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    null;
  const ua = req.headers.get("user-agent") ?? null;
  const requestId = getOrCreateRequestId(req);
  return {
    kind: "ok",
    ctx: {
      keyId: row.key_id,
      scopes,
      isFull: scopes.has("*"),
      ip,
      ua,
      requestId,
      startedAt: new Date().toISOString(),
      startedMs: Date.now(),
    },
  };
}

/**
 * Central authorization. Throws McpAuthError if the caller cannot run the tool.
 * Write/admin tools require an EXPLICIT matching scope — wildcard "*" is the only
 * scope that bypasses the explicit-write requirement.
 */
function authorizeTool(ctx: AuthCtx | null, toolName: string, guard: ToolGuard): AuthCtx {
  if (!ctx) {
    throw new McpAuthError(ERR.UNAUTHENTICATED, "Chave MCP inválida ou ausente.", 401);
  }
  // Wildcard always passes — but it was already gated at issuance with strong friction.
  if (ctx.isFull) return ctx;

  const hasScope = ctx.scopes.has(guard.scope);
  if (!hasScope) {
    throw new McpAuthError(
      ERR.SCOPE_MISSING,
      `Acesso negado: a ferramenta "${toolName}" requer o escopo "${guard.scope}" (modo ${guard.mode}). Sua chave possui: [${[...ctx.scopes].join(", ") || "nenhum"}].`,
      403,
      { required_scope: guard.scope, mode: guard.mode, available_scopes: [...ctx.scopes] },
    );
  }

  // Defensive double-check: write/admin tools must NEVER run from a read-only scope.
  if (guard.mode !== "read") {
    const isWriteScope = guard.scope.endsWith(":write") || guard.scope === "*";
    if (!isWriteScope) {
      throw new McpAuthError(
        ERR.WRITE_FORBIDDEN,
        `Configuração inválida: ferramenta "${toolName}" em modo "${guard.mode}" exige escopo terminando em :write.`,
        403,
        { required_scope: guard.scope, mode: guard.mode },
      );
    }
  }
  return ctx;
}

// ────────────────────────────────────────────────────────────────────────────
// Tool wrapper: gate + audit + error normalization
// ────────────────────────────────────────────────────────────────────────────

type ToolResult = { content: Array<{ type: "text"; text: string }> };
type ToolHandler<I> = (input: I, ctx: AuthCtx) => Promise<ToolResult> | ToolResult;

function defineTool<I>(
  name: string,
  guard: ToolGuard,
  description: string,
  inputSchema: Record<string, unknown>,
  handler: ToolHandler<I>,
) {
  mcpServer.tool(name, {
    description: `${description} [scope: ${guard.scope} | mode: ${guard.mode}]`,
    inputSchema,
    handler: async (input: I): Promise<ToolResult> => {
      const ctx = currentCtx;
      const startedAt = Date.now();
      const payloadSummary = summarizePayload(input);
      try {
        const authed = authorizeTool(ctx, name, guard);
        const result = await handler(input, authed);
        await audit(
          "mcp_tool.granted",
          authed,
          { tool: name, scope: guard.scope, mode: guard.mode, duration_ms: Date.now() - startedAt },
          { status: "success", payloadSummary },
        );
        return result;
      } catch (err) {
        if (err instanceof McpAuthError) {
          await audit(
            "mcp_tool.denied",
            ctx,
            { tool: name, scope: guard.scope, mode: guard.mode, error_code: err.code, ...err.meta },
            { status: "denied", payloadSummary },
          );
          throw new Error(`[${err.code}] ${err.message}`);
        }
        await audit(
          "mcp_tool.error",
          ctx,
          {
            tool: name,
            scope: guard.scope,
            mode: guard.mode,
            error_code: ERR.INTERNAL,
            message: err instanceof Error ? err.message : String(err),
          },
          { status: "error", payloadSummary },
        );
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
  });
}

const mcpServer = new McpServer({
  name: "promogifts-mcp",
  version: "1.1.0",
});

// We resolve the auth context from a per-request module-level holder.
let currentCtx: AuthCtx | null = null;

// ────────────────────────────────────────────────────────────────────────────
// READ tools
// ────────────────────────────────────────────────────────────────────────────

defineTool<{ status?: string; limit?: number }>(
  "list_quotes",
  { scope: "quotes:read", mode: "read" },
  "Lista os orçamentos mais recentes (limite 50).",
  {
    type: "object",
    properties: {
      status: { type: "string", description: "Filtrar por status (opcional)" },
      limit: { type: "number", description: "Máximo 50", default: 20 },
    },
  },
  async ({ status, limit }) => {
    const lim = Math.min(Math.max(Number(limit ?? 20), 1), 50);
    let q = supabase.from("quotes").select(
      "id, quote_number, status, client_name, client_email, total, created_at, updated_at",
    ).order("created_at", { ascending: false }).limit(lim);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

defineTool<{ id: string }>(
  "get_quote",
  { scope: "quotes:read", mode: "read" },
  "Detalha um orçamento por id.",
  {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", description: "UUID do orçamento" } },
  },
  async ({ id }) => {
    const { data, error } = await supabase.from("quotes").select("*, quote_items(*)").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

defineTool<{ search?: string; limit?: number }>(
  "list_companies",
  { scope: "crm:read", mode: "read" },
  "Lista as últimas empresas/clientes do CRM.",
  {
    type: "object",
    properties: { search: { type: "string" }, limit: { type: "number", default: 20 } },
  },
  async ({ search, limit }) => {
    const lim = Math.min(Math.max(Number(limit ?? 20), 1), 50);
    let q = supabase.from("quotes").select("client_name, client_email, client_company")
      .not("client_name", "is", null).limit(lim);
    if (search) q = q.ilike("client_name", `%${search}%`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

defineTool<{ limit?: number }>(
  "list_recent_orders",
  { scope: "orders:read", mode: "read" },
  "Lista os pedidos mais recentes.",
  {
    type: "object",
    properties: { limit: { type: "number", default: 20 } },
  },
  async ({ limit }) => {
    const lim = Math.min(Math.max(Number(limit ?? 20), 1), 50);
    const { data, error } = await supabase.from("orders").select(
      "id, order_number, status, fulfillment_status, client_name, total, created_at",
    ).order("created_at", { ascending: false }).limit(lim);
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

// ────────────────────────────────────────────────────────────────────────────
// PING (no scope)
// ────────────────────────────────────────────────────────────────────────────

mcpServer.tool("ping", {
  description: "Verifica conectividade do MCP. [scope: nenhum | mode: read]",
  inputSchema: { type: "object", properties: {} },
  handler: () => {
    if (!currentCtx) throw new Error(`[${ERR.UNAUTHENTICATED}] Chave MCP inválida ou ausente.`);
    return { content: [{ type: "text", text: `pong (key ${currentCtx.keyId.slice(0, 8)}…, scopes: ${[...currentCtx.scopes].join(",") || "—"})` }] };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Transport
// ────────────────────────────────────────────────────────────────────────────

const transport = new StreamableHttpTransport();
const app = new Hono();

app.options("/*", (c: Context) => new Response(null, { headers: getCorsHeaders(c.req.raw) }));

const httpHandler = transport.bind(mcpServer);

app.all("/*", async (c: Context) => {
  const auth = await authenticate(c.req.raw);
  const reqId = getOrCreateRequestId(c.req.raw);
  const ip =
    c.req.raw.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.raw.headers.get("cf-connecting-ip") ??
    null;
  const ua = c.req.raw.headers.get("user-agent") ?? null;

  // ── Caminho 1: chave FULL bloqueada por perda de role dev (auto-revogada na validação)
  if (auth.kind === "blocked" && auth.reason === "grantor_lost_dev") {
    const nowIso = new Date().toISOString();
    try {
      await supabase.from("admin_audit_log").insert({
        user_id: auth.createdBy,
        action: "mcp_tool.denied_dev_revoked",
        resource_type: "mcp_api_key",
        resource_id: auth.keyId,
        ip_address: ip,
        user_agent: ua,
        request_id: reqId,
        started_at: nowIso,
        finished_at: nowIso,
        duration_ms: 0,
        status: "denied",
        payload_summary: {},
        source: SOURCE,
        details: {
          error_code: ERR.KEY_AUTO_REVOKED_DEV,
          reason: "grantor_lost_dev_at_use",
          is_full_access: true,
          created_by: auth.createdBy,
          key_id: auth.keyId,
          revoked_at: nowIso,
          method: c.req.raw.method,
        },
      });
    } catch (_) { /* never block on audit */ }
    return new Response(
      JSON.stringify({
        error: ERR.KEY_AUTO_REVOKED_DEV,
        message: "Chave MCP de escopo total revogada: emissor original perdeu o papel dev.",
        request_id: reqId,
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json", [REQUEST_ID_HEADER]: reqId } },
    );
  }

  // ── Caminho 2: chave revogada/expirada por outros motivos (audit leve)
  if (auth.kind === "blocked") {
    const nowIso = new Date().toISOString();
    const code = auth.reason === "expired" ? ERR.KEY_EXPIRED : ERR.KEY_REVOKED;
    try {
      await supabase.from("admin_audit_log").insert({
        user_id: auth.createdBy,
        action: "mcp_tool.denied",
        resource_type: "mcp_api_key",
        resource_id: auth.keyId,
        ip_address: ip,
        user_agent: ua,
        request_id: reqId,
        started_at: nowIso,
        finished_at: nowIso,
        duration_ms: 0,
        status: "denied",
        payload_summary: {},
        source: SOURCE,
        details: {
          error_code: code,
          reason: auth.reason,
          key_id: auth.keyId,
          created_by: auth.createdBy,
          method: c.req.raw.method,
        },
      });
    } catch (_) { /* never block on audit */ }
    return new Response(
      JSON.stringify({ error: code, message: `Chave MCP ${auth.reason}.`, request_id: reqId }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json", [REQUEST_ID_HEADER]: reqId } },
    );
  }

  // ── Caminho 3: chave inexistente ou ausente
  if (auth.kind !== "ok") {
    try {
      const keyHeader = c.req.raw.headers.get("x-mcp-key") || "";
      await supabase.from("admin_audit_log").insert({
        user_id: null,
        action: "mcp_tool.denied",
        resource_type: "mcp_api_key",
        resource_id: null,
        ip_address: ip,
        user_agent: ua,
        request_id: reqId,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: 0,
        status: "denied",
        payload_summary: {},
        source: SOURCE,
        details: {
          error_code: ERR.UNAUTHENTICATED,
          reason: auth.kind === "no_key" ? "missing_key" : "invalid_key",
          key_length: keyHeader.length,
          method: c.req.raw.method,
        },
      });
    } catch (_) { /* never block on audit */ }
    return new Response(
      JSON.stringify({ error: ERR.UNAUTHENTICATED, message: "Chave MCP inválida ou ausente.", request_id: reqId }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json", [REQUEST_ID_HEADER]: reqId } },
    );
  }

  // ── Caminho feliz
  const ctx = auth.ctx;
  currentCtx = ctx;
  try {
    const res = await httpHandler(c.req.raw);
    const merged = new Headers(res.headers);
    for (const [k, v] of Object.entries(getCorsHeaders(c.req.raw))) merged.set(k, v);
    merged.set(REQUEST_ID_HEADER, ctx.requestId);
    return new Response(res.body, { status: res.status, headers: merged });
  } finally {
    currentCtx = null;
  }
});

Deno.serve(app.fetch);
