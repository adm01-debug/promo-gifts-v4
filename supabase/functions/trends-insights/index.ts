import { getCorsHeaders } from "../_shared/cors.ts";
// Edge function: trends-insights (v2 — AI Router)
// Agrega métricas de Tendências e gera narrativa via AI Router centralizado.
// Refatorado em 2026-06-12: removido LOVABLE_API_KEY hardcoded.
// Provider/model resolvido via ai_function_routing (DeepSeek primary, fallback automático).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  TrendsInsightsSchemas,
} from "../_shared/contracts/schemas/trends-insights.ts";
import { callAiForFunction, AdapterError } from "../_shared/ai-router/index.ts";
import type { UnifiedRequest } from "../_shared/ai-router/types.ts";

// ── Fallback response when AI is unavailable ────────────────────────────
const FALLBACK_INSIGHTS = {
  summary: "Sem dados suficientes para gerar insights ainda.",
  what_changed: "Aguardando mais atividade no catálogo.",
  why: "Volume baixo de eventos no período.",
  next_action: "Continue acompanhando — em breve haverá padrões claros.",
} as const;

// ── Structured logger ───────────────────────────────────────────────────
function log(
  level: "info" | "warn" | "error",
  requestId: string,
  event: string,
  extra: Record<string, unknown> = {},
): void {
  const payload = {
    fn: "trends-insights",
    request_id: requestId,
    event,
    ts: new Date().toISOString(),
    ...extra,
  };
  const line = `[trends-insights] ${JSON.stringify(payload)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    // ── Auth ───────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Contract parsing ──────────────────────────────────────────────
    const contractResult = await parseContract(req, TrendsInsightsSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    const { data: body, responseHeaders } = contractResult;
    const days = body.days ?? 30;

    log("info", requestId, "request_start", { days, user_id: userData.user.id });

    // ── Fetch analytics data ──────────────────────────────────────────
    const sinceCurrent = new Date(Date.now() - days * 86400000).toISOString();
    const sincePrevious = new Date(Date.now() - days * 2 * 86400000).toISOString();

    const [{ data: views }, { data: searches }] = await Promise.all([
      supabase
        .from("product_views")
        .select("product_id, product_name, view_type, created_at")
        .gte("created_at", sincePrevious),
      supabase
        .from("search_analytics")
        .select("search_term, results_count, created_at")
        .gte("created_at", sincePrevious),
    ]);

    const split = <T extends { created_at: string }>(rows: T[] | null) => {
      const cur: T[] = [], prev: T[] = [];
      (rows ?? []).forEach(r => (r.created_at >= sinceCurrent ? cur : prev).push(r));
      return { cur, prev };
    };
    const v = split(views as Array<{ created_at: string; product_name: string | null }> | null);
    const s = split(searches as Array<{ created_at: string; search_term: string | null; results_count: number | null }> | null);

    // ── Compute aggregates ────────────────────────────────────────────
    // Top 5 produtos
    const productCount = new Map<string, number>();
    v.cur.forEach((r) => {
      const k = r.product_name ?? "Sem nome";
      productCount.set(k, (productCount.get(k) ?? 0) + 1);
    });
    const topProducts = Array.from(productCount.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Top 5 buscas + sem resultado
    const searchCount = new Map<string, { count: number; zero: number }>();
    s.cur.forEach(r => {
      const t = (r.search_term ?? "").toLowerCase().trim();
      if (!t) return;
      const e = searchCount.get(t) ?? { count: 0, zero: 0 };
      e.count += 1;
      if ((r.results_count ?? 0) === 0) e.zero += 1;
      searchCount.set(t, e);
    });
    const topSearches = Array.from(searchCount.entries())
      .sort((a, b) => b[1].count - a[1].count).slice(0, 5)
      .map(([term, d]) => ({ term, count: d.count, zero: d.zero }));
    const unmet = Array.from(searchCount.entries())
      .filter(([, d]) => d.zero >= 2)
      .sort((a, b) => b[1].zero - a[1].zero).slice(0, 5)
      .map(([term, d]) => ({ term, zero: d.zero }));

    const totalViewsCur = v.cur.length;
    const totalViewsPrev = v.prev.length;
    const totalSearchesCur = s.cur.length;
    const totalSearchesPrev = s.prev.length;
    const pct = (a: number, b: number) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100);

    const summary = {
      window_days: days,
      total_views: totalViewsCur,
      views_growth_pct: pct(totalViewsCur, totalViewsPrev),
      total_searches: totalSearchesCur,
      searches_growth_pct: pct(totalSearchesCur, totalSearchesPrev),
      top_products: topProducts,
      top_searches: topSearches,
      unmet_demand: unmet,
    };

    log("info", requestId, "data_aggregated", {
      views_cur: totalViewsCur,
      views_prev: totalViewsPrev,
      searches_cur: totalSearchesCur,
      top_products: topProducts.length,
      top_searches: topSearches.length,
    });

    // ── Build AI request via router ───────────────────────────────────
    const prompt = `Você é um analista comercial sênior. Com base nas métricas abaixo de um catálogo B2B de brindes, gere insights acionáveis em português brasileiro. Seja específico, cite produtos/termos reais, e foque em ações práticas.

DADOS (últimos ${days} dias):
${JSON.stringify(summary, null, 2)}

Retorne via tool call.`;

    const toolDef = {
      type: "function",
      function: {
        name: "report_insights",
        description: "Reporta insights estruturados",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "1 frase resumindo o período" },
            what_changed: { type: "string", description: "O que mudou — números e produtos específicos" },
            why: { type: "string", description: "Hipótese plausível para o que mudou" },
            next_action: { type: "string", description: "Ação recomendada concreta" },
          },
          required: ["summary", "what_changed", "why", "next_action"],
          additionalProperties: false,
        },
      },
    };

    const aiRequest: UnifiedRequest = {
      messages: [
        { role: "system", content: "Você gera insights comerciais concisos e acionáveis em português brasileiro." },
        { role: "user", content: prompt },
      ],
      tools: [toolDef],
      tool_choice: { type: "function", function: { name: "report_insights" } },
      temperature: 0.4,
      max_tokens: 1024,
    };

    // ── Call AI Router (handles provider selection, fallback, quota) ──
    let parsed: Record<string, string>;
    try {
      const t0 = Date.now();
      const aiResult = await callAiForFunction({
        functionName: "trends-insights",
        userId: userData.user.id,
        request: aiRequest,
        requestId,
      });

      log("info", requestId, "ai_router_success", {
        provider: aiResult.used_provider_slug,
        model: aiResult.used_model_name,
        attempts: aiResult.attempts,
        fallback_used: aiResult.fallback_used,
        duration_ms: Date.now() - t0,
        input_tokens: aiResult.usage.input_tokens,
        output_tokens: aiResult.usage.output_tokens,
      });

      // Extract structured data from tool_calls
      const toolCall = aiResult.tool_calls?.[0];
      if (toolCall?.name === "report_insights" && toolCall.arguments) {
        parsed = toolCall.arguments as Record<string, string>;
      } else if (aiResult.content) {
        // Some providers return tool args in content as JSON
        try {
          parsed = JSON.parse(aiResult.content);
        } catch {
          log("warn", requestId, "ai_content_not_json", { content_preview: aiResult.content.slice(0, 200) });
          parsed = { ...FALLBACK_INSIGHTS };
        }
      } else {
        log("warn", requestId, "ai_no_tool_call", { finish_reason: aiResult.finish_reason });
        parsed = { ...FALLBACK_INSIGHTS };
      }
    } catch (aiErr) {
      // AI Router handles all fallbacks internally; if we get here, ALL providers failed
      const isAdapter = aiErr instanceof AdapterError;
      log("error", requestId, "ai_router_failed", {
        error_kind: isAdapter ? aiErr.errorKind : "unknown",
        error_message: (aiErr as Error)?.message?.slice(0, 300),
        retryable: isAdapter ? aiErr.retryable : false,
      });

      // Graceful degradation: return fallback insights instead of error
      parsed = { ...FALLBACK_INSIGHTS };
    }

    // ── Validate response shape ─────────────────────────────────────
    const result = {
      summary: typeof parsed.summary === "string" ? parsed.summary : FALLBACK_INSIGHTS.summary,
      what_changed: typeof parsed.what_changed === "string" ? parsed.what_changed : FALLBACK_INSIGHTS.what_changed,
      why: typeof parsed.why === "string" ? parsed.why : FALLBACK_INSIGHTS.why,
      next_action: typeof parsed.next_action === "string" ? parsed.next_action : FALLBACK_INSIGHTS.next_action,
    };

    log("info", requestId, "response_ok", {
      summary_length: result.summary.length,
      is_fallback: result.summary === FALLBACK_INSIGHTS.summary,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    log("error", requestId, "unhandled_error", {
      error: e instanceof Error ? e.message : "Unknown error",
      stack: e instanceof Error ? e.stack?.slice(0, 500) : undefined,
    });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
