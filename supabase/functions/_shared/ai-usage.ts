/**
 * AI Usage Tracking Helper
 * Tracks AI consumption per user with quota checking and cost estimation.
 *
 * v2 (PR 3/6): callAiWithTracking agora delega ao novo AI Router quando
 * a função tem routing cadastrado em ai_function_routing. Mantém path
 * legacy (Lovable direto) como fallback automático para:
 *   - funções sem routing cadastrado (no_routing)
 *   - stream=true (router ainda não suporta streaming nativamente)
 *   - feature flag AI_ROUTER_DISABLE=true
 *
 * v3 (fix): AbortController no legacy fetch path. Antes, se o gateway
 * ficasse sem resposta, o isolate pendurava ~150s e updateAiLog nunca
 * corria — rows ficavam 'pending' e consumiam quota indevidamente.
 * Agora: timeout de 45s (configurável via legacyTimeoutMs) + catch que
 * garante updateAiLog antes do re-throw.
 *
 * Assinatura compatível — legacyTimeoutMs é opcional, todas as edges
 * existentes continuam funcionando sem alteração.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Default timeout for the Lovable legacy gateway fetch (ms).
// Prevents Edge Functions from hanging ~150s when the gateway is unresponsive,
// ensuring updateAiLog runs within the request lifecycle so 'pending' rows
// are updated to 'error' and don't count against the user's monthly quota.
// Set per-caller via legacyTimeoutMs option for tighter budgets.
const LEGACY_FETCH_TIMEOUT_MS = 45_000;

// Cost per 1M tokens (USD) — kept for legacy path fallback
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-pro":           { input: 1.25, output: 10.0 },
  "google/gemini-3.1-pro-preview":   { input: 1.25, output: 10.0 },
  "google/gemini-3-flash-preview":   { input: 0.10, output: 0.40 },
  "google/gemini-2.5-flash":         { input: 0.15, output: 0.60 },
  "google/gemini-2.5-flash-lite":    { input: 0.04, output: 0.15 },
  "google/gemini-2.5-flash-image":   { input: 0.10, output: 0.40 },
  "google/gemini-2.5-flash-image-preview": { input: 0.10, output: 0.40 },
  "google/gemini-3-pro-image-preview": { input: 1.25, output: 10.0 },
  "google/gemini-3.1-flash-image-preview": { input: 0.10, output: 0.40 },
  "openai/gpt-5":                    { input: 2.50, output: 10.0 },
  "openai/gpt-5-mini":              { input: 0.40, output: 1.60 },
  "openai/gpt-5-nano":              { input: 0.10, output: 0.40 },
  "openai/gpt-5.2":                 { input: 3.00, output: 12.0 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 0.50, output: 2.0 };
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  unlimited?: boolean;
  reason?: string;
  log_id?: string;
}

/**
 * Check if user has available AI quota for this month.
 */
export async function checkAiQuota(userId: string): Promise<QuotaResult> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("check_ai_quota", { _user_id: userId });
  if (error) {
    // Onda 6 (B-7): fail-CLOSED. Antes era fail-open ("allowed: true") — risco de gasto
    // descontrolado de IA se a RPC check_ai_quota falhar (banco lento, função recriada, etc).
    // Agora bloqueia. Erro é logado via console.error → capturado pelo GlitchTip (Onda 5).
    console.error("[ai-usage] Quota check failed (fail-closed):", error.message);
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      reason: "quota_check_failed_security_lock",
    };
  }
  return data as QuotaResult;
}

/**
 * Atomically acquire an AI quota slot (check + reserve in single transaction).
 * Returns quota result with log_id if allowed.
 */
export async function acquireAiQuota(userId: string, functionName: string, model: string): Promise<QuotaResult> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("acquire_ai_quota", {
    _user_id: userId,
    _function_name: functionName,
    _model: model,
  });
  if (error) {
    // Onda 6 (B-7): fail-CLOSED. Antes era "allow but without log_id" — risco de gasto
    // descontrolado de IA se a RPC acquire_ai_quota falhar. Callers (callAiWithTracking,
    // ai-router) tratam allowed=false via QuotaExceededError → resposta 429 ao cliente.
    // Erro é logado via console.error → capturado pelo GlitchTip (Onda 5).
    console.error("[ai-usage] Atomic quota acquire failed (fail-closed):", error.message);
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      reason: "acquire_failed_security_lock",
    };
  }
  return data as QuotaResult;
}

interface LogParams {
  userId: string;
  functionName: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  status?: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an AI usage event. Fire-and-forget — errors are logged but won't crash the caller.
 */
export async function logAiUsage(params: LogParams): Promise<void> {
  const {
    userId,
    functionName,
    model,
    inputTokens = 0,
    outputTokens = 0,
    durationMs,
    status = "success",
    errorMessage,
    metadata = {},
  } = params;

  const totalTokens = inputTokens + outputTokens;
  const cost = estimateCost(model, inputTokens, outputTokens);

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("ai_usage_logs").insert({
      user_id: userId,
      function_name: functionName,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: cost,
      duration_ms: durationMs,
      status,
      error_message: errorMessage,
      metadata,
    });
    if (error) console.error("[ai-usage] Failed to log:", error.message);
  } catch (e) {
    console.error("[ai-usage] Log error:", e);
  }
}

/**
 * Extract token counts from an OpenAI-compatible response body.
 */
export function extractTokensFromResponse(responseBody: any): { input: number; output: number } {
  const usage = responseBody?.usage;
  return {
    input: usage?.prompt_tokens ?? usage?.input_tokens ?? 0,
    output: usage?.completion_tokens ?? usage?.output_tokens ?? 0,
  };
}

/**
 * Wraps an AI gateway call with quota check + usage logging.
 *
 * v2 behavior (PR 3/6):
 *  1) Reserve quota slot (acquire_ai_quota).
 *  2) If routing exists for `functionName` AND not streaming AND not disabled,
 *     delegate to the multi-provider router.
 *  3) Else: fall back to legacy Lovable gateway path (apiKey arg + hardcoded URL).
 *  4) Update reserved log with actual tokens/cost/duration.
 *
 * v3 (fix): Legacy fetch now has AbortController timeout guard (default 45s,
 * overridable via legacyTimeoutMs). On timeout or network error, updateAiLog
 * is called before re-throwing so 'pending' rows become 'error'.
 *
 * Caller signature unchanged — legacyTimeoutMs is optional.
 */
export async function callAiWithTracking(options: {
  userId: string;
  functionName: string;
  model: string;
  requestBody: Record<string, unknown>;
  apiKey: string;
  stream?: boolean;
  /**
   * Timeout for the legacy Lovable gateway fetch (ms). Default: 45_000.
   * Callers that wrap callAiWithTracking with a tighter outer timeout
   * (e.g. semantic-search's withTimeout at 12s) should pass a value
   * smaller than their outer budget so updateAiLog runs BEFORE the outer
   * timeout fires and the isolate is killed.
   * Example: semantic-search passes legacyTimeoutMs: 9_000.
   */
  legacyTimeoutMs?: number;
}): Promise<Response> {
  const { userId, functionName, model, requestBody, apiKey, stream = false, legacyTimeoutMs = LEGACY_FETCH_TIMEOUT_MS } = options;

  // 1. Atomically check quota AND reserve slot
  const quota = await acquireAiQuota(userId, functionName, model);
  if (!quota.allowed) {
    throw new QuotaExceededError(quota);
  }
  const logId = quota.log_id;

  // 2. Try the new router (skip when streaming or disabled)
  const routerDisabled = Deno.env.get("AI_ROUTER_DISABLE") === "true";
  const canUseRouter = !stream && !routerDisabled;

  if (canUseRouter) {
    try {
      const startMs = Date.now();
      // Dynamic import avoids circular dep with the router (which imports
      // acquireAiQuota/logAiUsage from this very file).
      const { callOpenAiViaRouter } = await import("./ai-router/openai-bridge.ts");
      const { response, result } = await callOpenAiViaRouter({
        functionName,
        userId,
        requestBody,
        skipQuota: true, // we already reserved a slot above
      });
      const durationMs = Date.now() - startMs;

      // Update reserved log with router results + provenance
      await updateAiLog(logId, {
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        totalTokens: result.usage.input_tokens + result.usage.output_tokens,
        estimatedCostUsd: estimateCost(
          `${result.used_provider_slug}/${result.used_model_name}`,
          result.usage.input_tokens,
          result.usage.output_tokens,
        ),
        durationMs,
        status: "success",
        metadata: {
          via: "router",
          provider_slug: result.used_provider_slug,
          model_used: result.used_model_name,
          attempts: result.attempts,
          fallback_used: result.fallback_used,
          requested_model: model, // legacy hint — what the caller asked for
        },
      });

      return response;
    } catch (err) {
      // Router-known errors that mean "not configured" → fall through to legacy
      const errMsg = (err as Error)?.message ?? "";
      const isNoRouting = errMsg.includes("No active routing") || errMsg.includes("Nenhum routing ativo");
      const isNoCapabilityMatch = errMsg.includes("No valid models satisfy") || errMsg.includes("Nenhum modelo satisfaz");
      // Fallback to legacy when providers lack credentials (no API key configured for any provider)
      const isAllMissingCredentials = errMsg.includes("Todos os providers falharam") && errMsg.includes("missing_credential");

      if (isNoRouting || isNoCapabilityMatch || isAllMissingCredentials) {
        console.log(
          `[ai-usage] Router unavailable for "${functionName}" (${isNoRouting ? "no_routing" : isNoCapabilityMatch ? "no_capability_match" : "missing_credentials"}). Falling back to legacy Lovable path.`,
        );
        // continua para path legacy abaixo
      } else {
        // Erros sérios (provider all_failed, auth, quota_blocked) — propaga
        await updateAiLog(logId, {
          durationMs: 0,
          status: "error",
          errorMessage: `Router error: ${errMsg.slice(0, 300)}`,
          metadata: { via: "router", error: true },
        });
        throw err;
      }
    }
  }

  // 3. Legacy path — direct call to Lovable gateway with AbortController timeout guard.
  //
  // Before this fix, if the gateway was unresponsive the fetch would hang for ~150s until
  // the Supabase Edge platform killed the isolate. updateAiLog never ran, so 'pending' rows
  // accumulated in ai_usage_logs and incorrectly counted against the user's monthly quota
  // (check_ai_quota counts WHERE status != 'error').
  //
  // Now: AbortController fires at `legacyTimeoutMs` ms, catch calls updateAiLog(→'error'),
  // then re-throws. Callers with an outer withTimeout (e.g. semantic-search at 12s) should
  // pass legacyTimeoutMs < their outer budget (e.g. 9_000) so the log is updated before
  // the outer timeout fires and the isolate is killed.
  const startMs = Date.now();
  const legacyCtrl = new AbortController();
  const legacyTimer = setTimeout(() => legacyCtrl.abort(), legacyTimeoutMs);

  let response!: Response;
  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, stream, ...requestBody }),
      signal: legacyCtrl.signal,
    });
  } catch (fetchErr) {
    // Fetch failed: AbortError (our timeout) or network error.
    // updateAiLog ensures the 'pending' row becomes 'error' so quota is correctly reset.
    const durationMs = Date.now() - startMs;
    const isAbort = fetchErr instanceof Error && fetchErr.name === "AbortError";
    const errMsg = isAbort
      ? `legacy_gateway_timeout_${legacyTimeoutMs}ms`
      : `legacy_fetch_error: ${(fetchErr as Error).message?.slice(0, 200) ?? "unknown"}`;
    console.warn(`[ai-usage] Legacy fetch failed (${errMsg}). Updating log before re-throw.`);
    await updateAiLog(logId, {
      durationMs,
      status: "error",
      errorMessage: errMsg,
      metadata: { via: "legacy", timed_out: isAbort },
    });
    throw fetchErr; // Re-throw: callers handle (semantic-search catch → degraded=true)
  } finally {
    clearTimeout(legacyTimer);
  }

  const durationMs = Date.now() - startMs;

  if (stream) {
    updateAiLog(logId, {
      durationMs,
      status: response.ok ? "success" : "error",
      errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
      metadata: { via: "legacy", stream: true },
    });
    return response;
  }

  const cloned = response.clone();
  try {
    const body = await cloned.json();
    const tokens = extractTokensFromResponse(body);
    const cost = estimateCost(model, tokens.input, tokens.output);
    await updateAiLog(logId, {
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      totalTokens: tokens.input + tokens.output,
      estimatedCostUsd: cost,
      durationMs,
      status: response.ok ? "success" : "error",
      errorMessage: response.ok ? undefined : body?.error?.message || `HTTP ${response.status}`,
      metadata: { via: "legacy" },
    });
  } catch {
    await updateAiLog(logId, {
      durationMs,
      status: "error",
      errorMessage: "Failed to parse AI response",
      metadata: { via: "legacy" },
    });
  }

  return response;
}

/**
 * Update an existing AI usage log entry with actual results.
 */
async function updateAiLog(logId: string | undefined, params: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  durationMs?: number;
  status?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!logId) {
    // Fallback: no log_id from atomic acquire, create new log
    console.warn("[ai-usage] No log_id, skipping update");
    return;
  }
  try {
    const supabase = getServiceClient();
    const updateData: Record<string, unknown> = {
      status: params.status || "success",
    };
    if (params.inputTokens !== undefined) updateData.input_tokens = params.inputTokens;
    if (params.outputTokens !== undefined) updateData.output_tokens = params.outputTokens;
    if (params.totalTokens !== undefined) updateData.total_tokens = params.totalTokens;
    if (params.estimatedCostUsd !== undefined) updateData.estimated_cost_usd = params.estimatedCostUsd;
    if (params.durationMs !== undefined) updateData.duration_ms = params.durationMs;
    if (params.errorMessage) updateData.error_message = params.errorMessage;
    if (params.metadata) updateData.metadata = params.metadata;

    const { error } = await supabase
      .from("ai_usage_logs")
      .update(updateData)
      .eq("id", logId);
    if (error) console.error("[ai-usage] Failed to update log:", error.message);
  } catch (e) {
    console.error("[ai-usage] Update log error:", e);
  }
}

export class QuotaExceededError extends Error {
  public quota: QuotaResult;
  constructor(quota: QuotaResult) {
    super(`AI quota exceeded: ${quota.used}/${quota.limit} requests used this month`);
    this.name = "QuotaExceededError";
    this.quota = quota;
  }
}
