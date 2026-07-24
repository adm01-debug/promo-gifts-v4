// =============================================================================
// AI Router — orquestrador central
//
// Responsabilidades:
//   1) Resolver routing da função (DB/cache 60s)
//   2) Filtrar candidatos por capabilities exigidas
//   3) Chamar adapter do provider primário; fallback em ordem se erro retryable
//   4) Logar uso (ai_usage_logs) + decisão de routing (ai_routing_decisions)
//   5) Respeitar quota de usuário (acquireAiQuota) e quota de provider (PR futuro)
//
// BUG-A11 FIX (26/05/2026): logDecision era `await`ed no path de sucesso,
// adicionando latência de DB desnecessária a TODA chamada AI bem-sucedida.
// Agora é fire-and-forget (como já era logAiUsage). Só o path de falha
// (all_failed, quota_blocked, no_routing) continua aguardando para garantir
// que o log exista antes de lançar o erro.
//
// BUG-A18 FIX (26/05/2026): quando routing não está configurado para uma
// função, a mensagem de erro agora inclui instrução clara de onde configurar.
// =============================================================================

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { getCredential } from "../credentials.ts";
import { acquireAiQuota, logAiUsage, QuotaExceededError } from "../ai-usage.ts";
import type { Adapter, AdapterCallOpts, ApiFormat, UnifiedRequest, UnifiedResponse } from "./types.ts";
import { AdapterError } from "./types.ts";
import { openaiCompatibleAdapter } from "./openai-compatible.ts";
import { anthropicNativeAdapter } from "./anthropic-native.ts";
import { googleGenaiAdapter } from "./google-genai.ts";

export type {
  ApiFormat,
  ContentPart,
  UnifiedMessage,
  UnifiedRequest,
  UnifiedResponse,
  ToolCall,
  ProviderConfig,
  AdapterCallOpts,
} from "./types.ts";
export { AdapterError } from "./types.ts";

const ADAPTERS: Record<ApiFormat, Adapter> = {
  openai_compatible: openaiCompatibleAdapter,
  anthropic_native: anthropicNativeAdapter,
  google_native: googleGenaiAdapter,
  custom: openaiCompatibleAdapter, // fallback default — assume OpenAI-compatible
};

interface RoutingRow {
  routing_id: string;
  function_name: string;
  is_active: boolean;
  required_capabilities: Record<string, boolean>;
  request_overrides: Record<string, unknown>;
  primary_model_id: string;
  primary_model: string;
  primary_capabilities: Record<string, boolean>;
  primary_provider_id: string;
  primary_provider_slug: string;
  primary_active: boolean;
  primary_provider_active: boolean;
  fallbacks: Array<{
    model_id: string;
    model: string;
    provider_slug: string;
    capabilities: Record<string, boolean>;
    cost_input: number;
    cost_output: number;
    model_active: boolean;
    provider_active: boolean;
    order_index: number;
  }>;
}

interface ProviderRow {
  id: string;
  slug: string;
  api_base_url: string;
  api_format: ApiFormat;
  auth_header: string;
  auth_format: string;
  secret_name: string;
  timeout_ms: number;
  metadata: Record<string, unknown>;
}

const ROUTING_CACHE = new Map<string, { row: RoutingRow; expires: number }>();
const PROVIDER_CACHE = new Map<string, { row: ProviderRow; expires: number }>();
const MODEL_PROVIDER_CACHE = new Map<string, { providerId: string; expires: number }>();
const CACHE_TTL_MS = 60_000;

let _serviceClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;
  // Routing/providers/models tables live in the canonical external DB.
  // Fallback to internal SUPABASE_URL if external is not configured.
  const url =
    Deno.env.get("EXTERNAL_SUPABASE_URL") ??
    Deno.env.get("EXTERNAL_PROMOBRIND_URL") ??
    Deno.env.get("SUPABASE_URL")!;
  const key =
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ??
    Deno.env.get("EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  _serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serviceClient;
}


async function getRouting(functionName: string): Promise<RoutingRow | null> {
  const cached = ROUTING_CACHE.get(functionName);
  if (cached && cached.expires > Date.now()) return cached.row;
  const client = getServiceClient();
  const { data, error } = await client
    .from("v_ai_function_routing_effective")
    .select("*")
    .eq("function_name", functionName)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("[ai-router] Failed to load routing:", error.message);
    return null;
  }
  if (!data) return null;
  const row = data as RoutingRow;
  ROUTING_CACHE.set(functionName, { row, expires: Date.now() + CACHE_TTL_MS });
  return row;
}

async function getProvider(providerId: string): Promise<ProviderRow | null> {
  const cached = PROVIDER_CACHE.get(providerId);
  if (cached && cached.expires > Date.now()) return cached.row;
  const client = getServiceClient();
  const { data, error } = await client.from("ai_providers").select("*").eq("id", providerId).maybeSingle();
  if (error || !data) return null;
  const row = data as ProviderRow;
  PROVIDER_CACHE.set(providerId, { row, expires: Date.now() + CACHE_TTL_MS });
  return row;
}

async function resolveModelProvider(modelId: string): Promise<string> {
  const cached = MODEL_PROVIDER_CACHE.get(modelId);
  if (cached && cached.expires > Date.now()) return cached.providerId;
  const client = getServiceClient();
  const { data } = await client.from("ai_models").select("provider_id").eq("id", modelId).maybeSingle();
  const providerId = (data as { provider_id?: string } | null)?.provider_id ?? "";
  if (providerId) {
    MODEL_PROVIDER_CACHE.set(modelId, { providerId, expires: Date.now() + CACHE_TTL_MS });
  }
  return providerId;
}

function satisfiesCapabilities(caps: Record<string, boolean>, required: Record<string, boolean>): boolean {
  for (const [key, need] of Object.entries(required)) {
    if (need && !caps[key]) return false;
  }
  return true;
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof AdapterError) return err.retryable;
  return false;
}

interface CallOpts {
  functionName: string;
  userId: string;
  request: UnifiedRequest;
  skipQuota?: boolean;
  requestId?: string;
}

export interface RouterCallResult extends UnifiedResponse {
  used_model_id: string;
  used_model_name: string;
  used_provider_id: string;
  used_provider_slug: string;
  attempts: number;
  total_duration_ms: number;
  fallback_used: boolean;
}

interface AttemptOutcome {
  model_id: string;
  provider_id: string | null;
  provider_slug: string;
  status: "success" | "error" | "skipped";
  error_kind?: string;
  error_message?: string;
  latency_ms: number;
}

export async function callAiForFunction(opts: CallOpts): Promise<RouterCallResult> {
  const t0 = Date.now();

  // 1) Quota check
  if (!opts.skipQuota) {
    const quota = await acquireAiQuota(opts.userId, opts.functionName, "router-pending");
    if (!quota.allowed) {
      // BUG-A11 FIX: await logDecision only on error paths (ensures log exists before throwing)
      await logDecision({
        functionName: opts.functionName,
        userId: opts.userId,
        outcomes: [],
        finalModelId: null,
        finalProviderId: null,
        outcome: "quota_blocked",
        durationMs: Date.now() - t0,
        requestId: opts.requestId,
      });
      throw new QuotaExceededError(quota);
    }
  }

  // 2) Routing
  const routing = await getRouting(opts.functionName);
  if (!routing) {
    await logDecision({
      functionName: opts.functionName,
      userId: opts.userId,
      outcomes: [],
      finalModelId: null,
      finalProviderId: null,
      outcome: "no_routing",
      durationMs: Date.now() - t0,
      requestId: opts.requestId,
    });
    // BUG-A18 FIX: hint de onde configurar o routing
    throw new AdapterError(
      `Nenhum routing ativo para a função "${opts.functionName}". ` +
      `Configure em /admin/conexoes > AI Models > Routing e ative a função.`,
      { retryable: false, errorKind: "client" },
    );
  }

  // 3) Build candidate list
  const required = routing.required_capabilities ?? {};
  const candidates: Array<{ modelId: string; modelName: string; providerSlug: string }> = [];

  if (
    routing.primary_active &&
    routing.primary_provider_active &&
    satisfiesCapabilities(routing.primary_capabilities, required)
  ) {
    candidates.push({
      modelId: routing.primary_model_id,
      modelName: routing.primary_model,
      providerSlug: routing.primary_provider_slug,
    });
  }
  for (const fb of routing.fallbacks ?? []) {
    if (!fb.model_active || !fb.provider_active) continue;
    if (!satisfiesCapabilities(fb.capabilities, required)) continue;
    candidates.push({
      modelId: fb.model_id,
      modelName: fb.model,
      providerSlug: fb.provider_slug,
    });
  }

  if (candidates.length === 0) {
    throw new AdapterError(
      `Nenhum modelo satisfaz as capabilities necessárias para "${opts.functionName}". ` +
      `Necessário: ${JSON.stringify(required)}. ` +
      `Verifique em /admin/conexoes > AI Models se os modelos estão ativos.`,
      { retryable: false, errorKind: "client" },
    );
  }

  // 4) Apply request overrides
  const finalRequest: UnifiedRequest = { ...opts.request, ...(routing.request_overrides ?? {}) };

  // 5) Try each candidate
  const outcomes: AttemptOutcome[] = [];
  let fatalError: unknown = null;

  for (const cand of candidates) {
    const tStart = Date.now();
    let providerId: string | null = null;
    try {
      providerId = (await resolveModelProvider(cand.modelId)) || null;
      if (!providerId) {
        outcomes.push({
          model_id: cand.modelId,
          provider_id: null,
          provider_slug: cand.providerSlug,
          status: "skipped",
          error_kind: "missing_credential",
          error_message: "provider_id not found",
          latency_ms: Date.now() - tStart,
        });
        continue;
      }

      const provider = await getProvider(providerId);
      if (!provider) {
        outcomes.push({
          model_id: cand.modelId,
          provider_id: providerId,
          provider_slug: cand.providerSlug,
          status: "skipped",
          error_kind: "missing_credential",
          error_message: "provider row missing",
          latency_ms: Date.now() - tStart,
        });
        continue;
      }

      const apiKey = await getCredential(provider.secret_name, getServiceClient());
      if (!apiKey) {
        outcomes.push({
          model_id: cand.modelId,
          provider_id: providerId,
          provider_slug: cand.providerSlug,
          status: "skipped",
          error_kind: "missing_credential",
          error_message: `secret ${provider.secret_name} not configured`,
          latency_ms: Date.now() - tStart,
        });
        continue;
      }

      const adapter = ADAPTERS[provider.api_format] ?? ADAPTERS.openai_compatible;
      const adapterOpts: AdapterCallOpts = {
        provider: {
          baseUrl: provider.api_base_url,
          apiKey,
          authHeader: provider.auth_header,
          authFormat: provider.auth_format,
          apiFormat: provider.api_format,
          timeoutMs: provider.timeout_ms,
          extraHeaders: (provider.metadata?.required_headers as Record<string, string>) ?? undefined,
        },
        model: cand.modelName,
        request: finalRequest,
      };

      const response = await adapter.call(adapterOpts);
      const latency = Date.now() - tStart;

      outcomes.push({
        model_id: cand.modelId,
        provider_id: providerId,
        provider_slug: cand.providerSlug,
        status: "success",
        latency_ms: latency,
      });

      if (!opts.skipQuota) {
        logAiUsage({
          userId: opts.userId,
          functionName: opts.functionName,
          model: `${cand.providerSlug}/${cand.modelName}`,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          durationMs: latency,
          status: "success",
          metadata: {
            provider_slug: cand.providerSlug,
            model_id: cand.modelId,
            attempt_number: outcomes.length,
            fallback_used: outcomes.length > 1,
            request_id: opts.requestId,
          },
        }).catch((e: unknown) => console.error("[ai-router] log usage failed (non-fatal):", e));
      }

      const fallbackUsed = outcomes.filter((o) => o.status === "error" || o.status === "skipped").length > 0;

      // BUG-A11 FIX: fire-and-forget no path de SUCESSO — não adiciona latência à resposta.
      // O log de decisão não é crítico para o usuário; falha de log não deve atrasar a resposta.
      logDecision({
        functionName: opts.functionName,
        userId: opts.userId,
        outcomes,
        finalModelId: cand.modelId,
        finalProviderId: providerId,
        outcome: fallbackUsed ? "fallback_used" : "success",
        durationMs: Date.now() - t0,
        requestId: opts.requestId,
      }).catch((e: unknown) => console.error("[ai-router] logDecision failed (non-fatal):", e));

      return {
        ...response,
        used_model_id: cand.modelId,
        used_model_name: cand.modelName,
        used_provider_id: providerId,
        used_provider_slug: cand.providerSlug,
        attempts: outcomes.length,
        total_duration_ms: Date.now() - t0,
        fallback_used: fallbackUsed,
      };
    } catch (err) {
      const latency = Date.now() - tStart;
      const aerr = err instanceof AdapterError ? err : null;
      outcomes.push({
        model_id: cand.modelId,
        provider_id: providerId,
        provider_slug: cand.providerSlug,
        status: "error",
        error_kind: aerr?.errorKind ?? "unknown",
        error_message: (err as Error)?.message?.slice(0, 200),
        latency_ms: latency,
      });
      console.warn(
        `[ai-router] candidate ${cand.providerSlug}/${cand.modelName} failed:`,
        aerr?.errorKind ?? "unknown",
        (err as Error)?.message,
      );

      if (!isRetryableError(err)) {
        fatalError = err;
        break;
      }
    }
  }

  // 6) Todos os candidatos falharam — await aqui para garantir log antes do throw
  await logDecision({
    functionName: opts.functionName,
    userId: opts.userId,
    outcomes,
    finalModelId: null,
    finalProviderId: null,
    outcome: "all_failed",
    durationMs: Date.now() - t0,
    requestId: opts.requestId,
  });

  if (fatalError) throw fatalError;

  throw new AdapterError(
    `Todos os providers falharam para "${opts.functionName}". ` +
      `Tentativas: ${outcomes.length} modelos. ` +
      `Últimos erros: ${outcomes.slice(-3).map((o) => `${o.provider_slug}=${o.error_kind}`).join("; ")}`,
    {
      retryable: false,
      errorKind: "server",
      raw: outcomes,
    },
  );
}

interface LogDecisionOpts {
  functionName: string;
  userId: string;
  outcomes: AttemptOutcome[];
  finalModelId: string | null;
  finalProviderId: string | null;
  outcome: "success" | "all_failed" | "fallback_used" | "quota_blocked" | "no_routing";
  durationMs: number;
  usageLogId?: string;
  requestId?: string;
}

async function logDecision(opts: LogDecisionOpts): Promise<void> {
  try {
    const client = getServiceClient();
    await client.rpc("register_ai_routing_decision", {
      p_function_name: opts.functionName,
      p_user_id: opts.userId || null,
      p_attempted_models: opts.outcomes.map((o) => o.model_id),
      p_attempted_providers: opts.outcomes.map((o) => o.provider_id),
      p_attempted_outcomes: opts.outcomes,
      p_final_model_id: opts.finalModelId,
      p_final_provider_id: opts.finalProviderId,
      p_total_attempts: opts.outcomes.length,
      p_total_duration_ms: opts.durationMs,
      p_outcome: opts.outcome,
      p_usage_log_id: opts.usageLogId ?? null,
      p_request_id: opts.requestId ?? null,
    });
  } catch (err) {
    console.error("[ai-router] log decision failed (non-fatal):", err);
  }
}

/** Limpa caches em memória do router (útil em testes ou após hot-reload). */
export function clearRouterCache(): void {
  ROUTING_CACHE.clear();
  PROVIDER_CACHE.clear();
  MODEL_PROVIDER_CACHE.clear();
}
