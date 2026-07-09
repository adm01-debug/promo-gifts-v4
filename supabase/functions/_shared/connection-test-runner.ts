// Shared core logic for connection ping + persistence.
// Used by `connection-tester` (manual, JWT-protected) and
// `connections-auto-test` (cron, service-role).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { getCredential } from "./credentials.ts";
import { resolveTimeout, type ConnectionType } from "./connection-timeouts.ts";

export type { ConnectionType };
export type TriggeredBy = "manual" | "cron" | "webhook";
export type ErrorKind =
  | "timeout"
  | "network"
  | "dns"
  | "http"
  | "auth"
  | "config"
  | "unknown";

export interface RunOptions {
  type: ConnectionType;
  config?: Record<string, string>;
  env_key?: "promobrind" | "crm";
  connection_id?: string;
  triggered_by?: TriggeredBy;
  /** Only required when env_key is provided without a connection_id (auto-upsert). */
  created_by?: string;
  service: SupabaseClient;
  /** Per-test timeout in ms. Default: per-type table; falls back to 8000. */
  timeoutMs?: number;
  /** Number of attempts performed (1 = first try; 2 = after one retry). Default 1. */
  attempts?: number;
  /** When true, skip writing to external_connections + connection_test_history.
   *  Used by the cron to "probe" before deciding whether to retry. */
  skipPersistence?: boolean;
}

/** Transient error kinds that are safe to retry once (no side effects expected). */
export const TRANSIENT_ERROR_KINDS: ReadonlySet<ErrorKind> = new Set(["timeout", "network", "dns"]);

/** True if a RunResult-like object represents a transient failure worth retrying. */
export function isTransientFailure(r: { ok: boolean; error_kind?: ErrorKind; status?: number }): boolean {
  if (r.ok) return false;
  if (r.error_kind && TRANSIENT_ERROR_KINDS.has(r.error_kind)) return true;
  if (typeof r.status === "number" && r.status >= 500 && r.status <= 599) return true;
  return false;
}

export interface RunResult {
  ok: boolean;
  status?: number;
  latency_ms?: number;
  error?: string;
  error_kind?: ErrorKind;
  message?: string;
  /** Timeout efetivo (ms) aplicado neste teste. Útil em falhas por AbortError. */
  timeout_ms?: number;
  tested_at: string;
  connection_id?: string;
}

/** Stable display name when auto-registering a connection from the first test. */
function defaultConnectionName(type: ConnectionType, env_key?: "promobrind" | "crm"): string {
  if (type === "supabase") return env_key === "crm" ? "Catálogo CRM" : env_key === "promobrind" ? "Catálogo Promobrind" : "Supabase";
  if (type === "bitrix24") return "Bitrix24";
  if (type === "n8n") return "n8n";
  if (type === "mcp") return "MCP Server";
  if (type === "webhook_outbound") return "Webhook (saída)";
  return type;
}

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
}

/**
 * Classify a thrown error or non-OK HTTP response into a structured ErrorKind
 * + a human-readable PT-BR message.
 */
function classifyError(
  err: unknown,
  status: number | undefined,
  timeoutMs: number,
): { kind: ErrorKind; message: string } {
  if (err instanceof Error && err.name === "AbortError") {
    return { kind: "timeout", message: `timeout após ${timeoutMs}ms — o serviço não respondeu` };
  }
  const raw = err instanceof Error ? err.message : (err != null ? String(err) : "");
  const lower = raw.toLowerCase();

  if (lower.includes("dns") || lower.includes("getaddrinfo") || lower.includes("enotfound")) {
    return { kind: "dns", message: "DNS não resolvido — verifique a URL configurada" };
  }
  if (
    lower.includes("econnrefused") ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("connection reset") ||
    lower.includes("socket")
  ) {
    return { kind: "network", message: "Falha de rede — serviço inalcançável (offline ou bloqueado)" };
  }
  if (status === 401 || status === 403) {
    return { kind: "auth", message: `Credenciais rejeitadas (HTTP ${status})` };
  }
  if (status && status >= 400) {
    return { kind: "http", message: `Serviço retornou HTTP ${status}` };
  }
  if (lower.includes("ausente") || lower.includes("missing") || lower.includes("not configured")) {
    return { kind: "config", message: raw || "Configuração incompleta" };
  }
  return { kind: "unknown", message: raw || "Erro desconhecido" };
}

/**
 * Validate URL format BEFORE calling pingX() — falha cedo com mensagem
 * explícita "URL_MALFORMED: ..." em vez de receber HTML 404 do site
 * supabase.com depois de um fetch que parece OK.
 *
 * Origem: incidente 2026-05-22 (`crm-db-bridge` recebeu URL do Dashboard
 * — `https://supabase.com/dashboard/project/<ref>` — colada no campo
 * URL da API, e a validação `!!CRM_URL` aceitou). Ver Issue 2 em
 * `docs/issues-pendentes-2026-05-22.md`.
 *
 * Retorna `null` se OK, ou string descritiva se malformado.
 */
export function validateUrlFormat(url: string, type: ConnectionType): string | null {
  if (!url || typeof url !== "string") {
    return "URL_MALFORMED: valor vazio";
  }
  const trimmed = url.trim();
  if (trimmed !== url) {
    return "URL_MALFORMED: whitespace no início/fim";
  }
  if (type === "supabase") {
    // Anti-padrão #1 do POP: colaram a URL do Dashboard
    if (/^https:\/\/supabase\.com\/dashboard/i.test(url)) {
      return `URL_MALFORMED: URL do Dashboard recebida — esperado https://<project_ref>.supabase.co`;
    }
    if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/i.test(url)) {
      return `URL_MALFORMED: esperado https://<project_ref>.supabase.co (project_ref com 20 chars alfanuméricos), recebido "${url.slice(0, 60)}${url.length > 60 ? "…" : ""}"`;
    }
  }
  if (type === "bitrix24") {
    if (!/^https:\/\//i.test(url)) {
      return "URL_MALFORMED: webhook Bitrix24 deve começar com https://";
    }
  }
  if (type === "n8n") {
    if (!/^https?:\/\//i.test(url)) {
      return "URL_MALFORMED: n8n base URL deve começar com http(s)://";
    }
  }
  if (type === "webhook_outbound") {
    if (!/^https?:\/\//i.test(url)) {
      return "URL_MALFORMED: webhook outbound deve começar com http(s)://";
    }
  }
  return null;
}

async function pingSupabase(url: string, key: string, timeoutMs: number) {
  const start = Date.now();
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const res = await fetch(`${url}/rest/v1/?apikey=${key}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal,
    });
    await res.text();
    return { ok: res.ok, status: res.status, latency_ms: Date.now() - start };
  } finally { cancel(); }
}

async function pingBitrix(webhookUrl: string, timeoutMs: number) {
  const start = Date.now();
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const url = webhookUrl.replace(/\/$/, "") + "/crm.contact.fields.json";
    const res = await fetch(url, { signal });
    const body = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(body); } catch { /* ignore */ }
    return {
      ok: res.ok && !!parsed && !(parsed as Record<string, unknown>).error,
      status: res.status,
      latency_ms: Date.now() - start,
      error: (parsed as { error?: string })?.error,
    };
  } finally { cancel(); }
}

async function pingN8n(baseUrl: string, apiKey: string | undefined, timeoutMs: number) {
  const start = Date.now();
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const url = baseUrl.replace(/\/$/, "") + "/healthz";
    const headers: Record<string, string> = {};
    if (apiKey) headers["X-N8N-API-KEY"] = apiKey;
    const res = await fetch(url, { headers, signal });
    await res.text();
    return { ok: res.ok, status: res.status, latency_ms: Date.now() - start };
  } finally { cancel(); }
}

async function pingWebhook(url: string, timeoutMs: number) {
  const start = Date.now();
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Connection-Test": "1" },
      body: JSON.stringify({ event: "connection.test", timestamp: new Date().toISOString() }),
      signal,
    });
    await res.text();
    return { ok: res.ok, status: res.status, latency_ms: Date.now() - start };
  } finally { cancel(); }
}

export async function runConnectionTest(opts: RunOptions): Promise<RunResult> {
  const { type, config = {}, env_key, service, created_by } = opts;
  const triggered_by: TriggeredBy = opts.triggered_by ?? "manual";
  const timeoutMs = resolveTimeout(type, opts.timeoutMs);
  const attempts = Math.max(1, Math.min(opts.attempts ?? 1, 9));
  let connection_id = opts.connection_id;

  let result: {
    ok: boolean;
    status?: number;
    latency_ms?: number;
    error?: string;
    error_kind?: ErrorKind;
    message?: string;
  };
  try {
    if (type === "supabase") {
      const prefix = env_key === "crm" ? "EXTERNAL_CRM" : "EXTERNAL_PROMOBRIND";
      const url = config.url || (await getCredential(`${prefix}_URL`, service)) || "";
      const key = config.key || (await getCredential(`${prefix}_SERVICE_ROLE_KEY`, service)) || "";
      if (!url || !key) throw new Error("URL/key ausente — configure as credenciais primeiro");
      const urlErr = validateUrlFormat(url, type);
      if (urlErr) {
        result = { ok: false, error: urlErr, error_kind: "config" };
      } else {
        result = await pingSupabase(url, key, timeoutMs);
      }
    } else if (type === "bitrix24") {
      const url = config.webhook_url || (await getCredential("BITRIX24_WEBHOOK_URL", service)) || "";
      if (!url) throw new Error("Webhook URL ausente");
      const urlErr = validateUrlFormat(url, type);
      if (urlErr) {
        result = { ok: false, error: urlErr, error_kind: "config" };
      } else {
        result = await pingBitrix(url, timeoutMs);
      }
    } else if (type === "n8n") {
      const base = config.base_url || (await getCredential("N8N_BASE_URL", service)) || "";
      const key = config.api_key || (await getCredential("N8N_API_KEY", service)) || undefined;
      if (!base) throw new Error("Base URL ausente");
      const urlErr = validateUrlFormat(base, type);
      if (urlErr) {
        result = { ok: false, error: urlErr, error_kind: "config" };
      } else {
        result = await pingN8n(base, key ?? undefined, timeoutMs);
      }
    } else if (type === "webhook_outbound") {
      const url = config.url || "";
      if (!url) throw new Error("URL ausente");
      const urlErr = validateUrlFormat(url, type);
      if (urlErr) {
        result = { ok: false, error: urlErr, error_kind: "config" };
      } else {
        result = await pingWebhook(url, timeoutMs);
      }
    } else if (type === "mcp") {
      const { count } = await service
        .from("mcp_api_keys")
        .select("*", { count: "exact", head: true })
        .is("revoked_at", null);
      result = { ok: true, status: 200, message: `${count ?? 0} chave(s) MCP ativa(s)` };
    } else {
      result = { ok: false, error: "Tipo não suportado", error_kind: "unknown" };
    }

    // Promote non-OK HTTP responses to a categorized error message.
    if (!result.ok && !result.error_kind) {
      const synthetic = result.error
        ? new Error(result.error)
        : new Error(`HTTP ${result.status ?? "?"}`);
      const classified = classifyError(synthetic, result.status, timeoutMs);
      result.error_kind = classified.kind;
      result.error = classified.message;
    }
  } catch (err) {
    const classified = classifyError(err, undefined, timeoutMs);
    result = { ok: false, error: classified.message, error_kind: classified.kind };
  }

  const tested_at = new Date().toISOString();
  const message = result.error ?? result.message ?? `HTTP ${result.status ?? "?"}`;

  if (opts.skipPersistence) {
    return { ...result, timeout_ms: timeoutMs, tested_at, connection_id };
  }

  if (connection_id) {
    await service.from("external_connections").update({
      last_test_at: tested_at,
      last_test_ok: result.ok,
      last_test_message: message,
      last_latency_ms: result.latency_ms ?? null,
      status: result.ok ? "active" : "error",
    }).eq("id", connection_id);

    await service.from("connection_test_history").insert({
      connection_id,
      tested_at,
      success: result.ok,
      latency_ms: result.latency_ms ?? null,
      status_code: result.status ?? null,
      error_message: result.ok ? null : (result.error ?? message)?.slice(0, 500),
      error_kind: result.ok ? null : (result.error_kind ?? null),
      triggered_by,
      attempts,
    }).then(() => undefined, (e) => console.error("history insert failed", e));
  } else if (created_by) {
    // Auto-register the connection on the first test (success OR fail).
    // Covers all types — not just supabase/env_key — so bitrix24, n8n, mcp and
    // webhook_outbound also get a row + active status after the first
    // "Testar conexão" instead of staying invisible to cron / health-check.
    const upsertPayload: Record<string, unknown> = {
      type,
      name: defaultConnectionName(type, env_key),
      status: result.ok ? "active" : "error",
      last_test_at: tested_at,
      last_test_ok: result.ok,
      last_test_message: message,
      last_latency_ms: result.latency_ms ?? null,
      created_by,
    };
    let conflictKey: "env_key,type" | "type,name" = "type,name";
    if (env_key && type === "supabase") {
      upsertPayload.env_key = env_key;
      conflictKey = "env_key,type";
    }

    const { data: upserted, error: upErr } = await service
      .from("external_connections")
      .upsert(upsertPayload, { onConflict: conflictKey })
      .select("id")
      .maybeSingle();
    if (upErr) {
      console.error("auto-upsert failed", upErr.message);
    } else if (upserted?.id) {
      connection_id = upserted.id;
      await service.from("connection_test_history").insert({
        connection_id: upserted.id,
        tested_at,
        success: result.ok,
        latency_ms: result.latency_ms ?? null,
        status_code: result.status ?? null,
        error_message: result.ok ? null : (result.error ?? message)?.slice(0, 500),
        error_kind: result.ok ? null : (result.error_kind ?? null),
        triggered_by,
        attempts,
      }).then(() => undefined, (e) => console.error("history insert failed (auto)", e));
    }
  }

  return { ...result, timeout_ms: timeoutMs, tested_at, connection_id };
}
