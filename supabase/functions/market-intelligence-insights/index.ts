import { getCorsHeaders } from "../_shared/cors.ts";
// supabase/functions/market-intelligence-insights/index.ts
// Generates AI-powered insights for the Market Intelligence dashboard.
// v2: server-side cache, structured logging, telemetry, quota check, smart empty state.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { authenticateRequest, authErrorResponse } from "../_shared/auth.ts";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  MarketIntelligenceInsightsSchemas,
} from "../_shared/contracts/schemas/market-intelligence-insights.ts";

const FUNCTION_NAME = "market-intelligence-insights";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

type InsightFocus = "auto" | "conversion" | "ticket" | "rupture";

interface RequestBody {
  days?: number;
  categoryId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  categoryName?: string | null;
  supplierName?: string | null;
  productName?: string | null;
  forceRefresh?: boolean;
  focus?: InsightFocus;
}

interface AggregatedSummary {
  period_days: number;
  filters: { category?: string | null; supplier?: string | null; product?: string | null };
  current: { revenue: number; orders: number; quotes: number; avg_ticket: number; conversion_rate: number };
  previous: { revenue: number; orders: number; quotes: number; avg_ticket: number; conversion_rate: number };
  deltas: {
    revenue_pct: number | null;
    orders_pct: number | null;
    quotes_pct: number | null;
    conversion_pct_points: number | null;
  };
  top_products: Array<{ name: string; quantity: number; revenue: number }>;
  top_suppliers: Array<{ name: string; revenue: number; share_pct: number }>;
}

interface InsightPayload {
  summary: string;
  what_changed: string;
  why: string;
  next_action: string;
  highlights?: string[];
  empty?: boolean;
  cached?: boolean;
  generated_at?: string;
}

function log(level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: FUNCTION_NAME, level, event, ts: new Date().toISOString(), ...data }));
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildCacheKey(b: RequestBody): Promise<string> {
  return sha256(
    JSON.stringify({
      d: b.days ?? 30,
      c: b.categoryId ?? null,
      s: b.supplierId ?? null,
      p: b.productId ?? null,
      f: b.focus ?? "auto",
      day: new Date().toISOString().slice(0, 10),
    }),
  );
}

const FOCUS_LABELS: Record<InsightFocus, string> = {
  auto: "priorização automática (identifique o gargalo mais crítico)",
  conversion: "CONVERSÃO — orçamentos que não viraram pedido, follow-up, taxa de fechamento",
  ticket: "TICKET MÉDIO — cross-sell, upsell, mix de produtos, precificação",
  rupture: "RUPTURA/ESTOQUE — risco de falta, cobertura, reposição, produtos em risco",
};

function focusDirective(focus: InsightFocus): string {
  return `Foco solicitado pelo analista: ${FOCUS_LABELS[focus]}. Enviese "next_action" para esse eixo, sem inventar dados.`;
}

function focusFallbackNextAction(focus: InsightFocus, s: AggregatedSummary): string {
  const conv = s.current.conversion_rate;
  const avg = s.current.avg_ticket;
  const top = s.top_products[0]?.name;
  if (focus === "conversion") {
    return conv < 60
      ? `Conversão em ${conv}% — priorize follow-up dos ${s.current.quotes} orçamentos abertos para destravar pedidos.`
      : `Conversão saudável (${conv}%). Documente o playbook de fechamento e replique nos vendedores com menor performance.`;
  }
  if (focus === "ticket") {
    const avgFmt = avg.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return top
      ? `Ticket médio ${avgFmt} — proponha combos/cross-sell a partir de "${top}" para elevar o valor por pedido.`
      : `Ticket médio ${avgFmt} — construa kits e faixas de desconto por volume para elevar o valor por pedido.`;
  }
  if (focus === "rupture") {
    return top
      ? `Valide cobertura de estoque de "${top}" e demais top 5 do período; acione compras para os itens com giro alto e saldo baixo.`
      : `Rode o painel de Ruptura para os produtos com maior giro e antecipe pedidos de reposição aos fornecedores prioritários.`;
  }
  return conv < 30
    ? `Conversão em ${conv}% — revise follow-up dos orçamentos abertos para destravar pedidos.`
    : "Mantenha o ritmo: foque os 5 produtos de maior giro para sustentar o faturamento.";
}

function buildEmptyState(s: AggregatedSummary): InsightPayload {
  const filterCtx =
    [s.filters.category, s.filters.supplier, s.filters.product].filter(Boolean).join(" · ") ||
    "este recorte";
  return {
    empty: true,
    summary: `Sem volume suficiente em ${filterCtx} nos últimos ${s.period_days} dias para gerar insights.`,
    what_changed: "Não há pedidos nem orçamentos registrados no período selecionado.",
    why: "O filtro pode estar muito restritivo, ou ainda não houve atividade comercial neste recorte.",
    next_action: "Amplie o período (ex: 60 ou 90 dias) ou remova filtros para ver o panorama geral.",
    highlights: [],
  };
}

function buildFallback(s: AggregatedSummary, focus: InsightFocus = "auto"): InsightPayload {
  const filterCtx =
    [s.filters.category, s.filters.supplier, s.filters.product].filter(Boolean).join(" · ") ||
    "todo o catálogo";
  const rev = s.current.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dRev = s.deltas.revenue_pct;
  const dQuotes = s.deltas.quotes_pct;
  const top = s.top_products[0]?.name;

  return {
    summary: `Nos últimos ${s.period_days} dias, ${filterCtx} faturou ${rev} com ${s.current.orders} pedidos.`,
    what_changed:
      dRev !== null
        ? `Faturamento ${dRev >= 0 ? "subiu" : "caiu"} ${Math.abs(dRev)}% vs. período anterior; ${
            s.current.quotes
          } orçamentos${dQuotes !== null ? ` (${dQuotes >= 0 ? "+" : ""}${dQuotes}%)` : ""}.`
        : `${s.current.quotes} orçamentos e ${s.current.orders} pedidos no período.`,
    why: top
      ? `Performance puxada por "${top}" e concentração nos 5 principais fornecedores.`
      : "Volume distribuído entre múltiplos produtos sem concentração clara.",
    next_action: focusFallbackNextAction(focus, s),
    highlights: [
      s.top_suppliers[0]
        ? `${s.top_suppliers[0].name} representa ${s.top_suppliers[0].share_pct}% do faturamento.`
        : null,
      s.current.avg_ticket > 0
        ? `Ticket médio: ${s.current.avg_ticket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
        : null,
    ].filter(Boolean) as string[],
  };
}

async function aggregateData(
  supabase: import("../_shared/supabase-client-adapter.ts").CompatibleSupabaseClient,
  body: RequestBody,
): Promise<AggregatedSummary> {
  const days = Math.max(1, Math.min(body.days ?? 30, 365));
  const now = new Date();
  const startCurr = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const startPrev = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);

  const buildQuoteQuery = (from: Date, to: Date) =>
    supabase
      .from("quotes")
      .select("id, total, status, created_at", { count: "exact" })
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString());

  const buildOrderQuery = (from: Date, to: Date) =>
    supabase
      .from("orders")
      .select("id, total, created_at", { count: "exact" })
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString());

  const [currQuotes, prevQuotes, currOrders, prevOrders] = await Promise.all([
    buildQuoteQuery(startCurr, now),
    buildQuoteQuery(startPrev, startCurr),
    buildOrderQuery(startCurr, now),
    buildOrderQuery(startPrev, startCurr),
  ]);

  const calcMetrics = (quotes: { data: any[] | null }, orders: { data: any[] | null }) => {
    const qData = quotes.data ?? [];
    const oData = orders.data ?? [];
    const revenue = oData.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const orderCount = oData.length;
    const quoteCount = qData.length;
    const avg_ticket = orderCount > 0 ? revenue / orderCount : 0;
    const conversion_rate = quoteCount > 0 ? Number(((orderCount / quoteCount) * 100).toFixed(1)) : 0;
    return { revenue, orders: orderCount, quotes: quoteCount, avg_ticket, conversion_rate };
  };

  const current = calcMetrics(currQuotes, currOrders);
  const previous = calcMetrics(prevQuotes, prevOrders);

  const orderIds = (currOrders.data ?? []).map((o: any) => o.id);
  let top_products: AggregatedSummary["top_products"] = [];
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, product_name, quantity, unit_price")
      .in("order_id", orderIds)
      .limit(2000);
    const acc: Record<string, { name: string; quantity: number; revenue: number }> = {};
    (items ?? []).forEach((it: any) => {
      if (body.productId && it.product_id !== body.productId) return;
      const key = it.product_id || it.product_name || "unknown";
      if (!acc[key]) acc[key] = { name: it.product_name || "Produto", quantity: 0, revenue: 0 };
      acc[key].quantity += Number(it.quantity) || 0;
      acc[key].revenue += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    });
    top_products = Object.values(acc).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }

  const top_suppliers: AggregatedSummary["top_suppliers"] = body.supplierName
    ? [{ name: body.supplierName, revenue: current.revenue, share_pct: 100 }]
    : [];

  return {
    period_days: days,
    filters: {
      category: body.categoryName ?? null,
      supplier: body.supplierName ?? null,
      product: body.productName ?? null,
    },
    current,
    previous,
    deltas: {
      revenue_pct: pctChange(current.revenue, previous.revenue),
      orders_pct: pctChange(current.orders, previous.orders),
      quotes_pct: pctChange(current.quotes, previous.quotes),
      conversion_pct_points: Number((current.conversion_rate - previous.conversion_rate).toFixed(1)),
    },
    top_products,
    top_suppliers,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const t0 = Date.now();
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  let userId: string | null = null;
  let responseHeaders: Record<string, string> = {};
  try {
    const auth = await authenticateRequest(req);
    userId = auth.userId;
    const contractResult = await parseContract(req, MarketIntelligenceInsightsSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    const body = contractResult.data as RequestBody;
    const focus: InsightFocus = body.focus ?? "auto";
    responseHeaders = contractResult.responseHeaders;
    const cacheKey = await buildCacheKey({ ...body, focus });

    // 1) Cache lookup (skip if forceRefresh)
    if (!body.forceRefresh) {
      const { data: cached } = await auth.localServiceClient
        .from("ai_insights_cache")
        .select("payload, created_at, expires_at")
        .eq("user_id", userId)
        .eq("function_name", FUNCTION_NAME)
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (cached?.payload) {
        log("info", "cache_hit", { user_id: userId, cache_key: cacheKey, duration_ms: Date.now() - t0 });
        await auth.localServiceClient.from("ai_usage_events").insert({
          user_id: userId,
          function_name: FUNCTION_NAME,
          event_type: "cache_hit",
          metadata: { cache_key: cacheKey },
        });
        return new Response(
          JSON.stringify({ ...(cached.payload as object), cached: true, generated_at: cached.created_at }),
          { headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 2) Quota check
    const { data: quota } = await auth.localServiceClient.rpc("check_ai_quota", { _user_id: userId });
    if (quota && quota.allowed === false) {
      log("warn", "quota_exceeded", { user_id: userId, used: quota.used, limit: quota.limit });
      return new Response(
        JSON.stringify({
          error: "quota_exceeded",
          message: `Limite mensal de IA atingido (${quota.used}/${quota.limit}).`,
        }),
        { status: 429, headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Aggregate data
    const summary = await aggregateData(auth.localServiceClient, body);

    // 4) Smart empty state
    if (summary.current.orders === 0 && summary.current.quotes === 0) {
      const empty = buildEmptyState(summary);
      log("info", "empty_state", { user_id: userId, period_days: summary.period_days });
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      log("warn", "missing_api_key", { user_id: userId });
      return new Response(JSON.stringify(buildFallback(summary)), {
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Call AI Gateway
    const aiT0 = Date.now();
    const systemPrompt = `Você é analista comercial sênior. Gere insights ACIONÁVEIS e ESPECÍFICOS em pt-BR sobre o desempenho de vendas. Use números concretos do JSON fornecido. Seja direto: 1 frase por campo. Nunca invente dados.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados:\n${JSON.stringify(summary, null, 2)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_insights",
              description: "Retorna insights estruturados sobre o desempenho comercial",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  what_changed: { type: "string" },
                  why: { type: "string" },
                  next_action: { type: "string" },
                  highlights: { type: "array", items: { type: "string" } },
                },
                required: ["summary", "what_changed", "why", "next_action"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_insights" } },
      }),
    });
    const aiDuration = Date.now() - aiT0;

    if (aiResp.status === 429) {
      log("warn", "ai_rate_limited", { user_id: userId, ai_duration_ms: aiDuration });
      return new Response(JSON.stringify({ error: "rate_limited", ...buildFallback(summary) }), {
        status: 429,
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      log("warn", "ai_no_credits", { user_id: userId });
      return new Response(JSON.stringify({ error: "no_credits", ...buildFallback(summary) }), {
        status: 402,
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      log("error", "ai_error", { user_id: userId, status: aiResp.status, body: txt.slice(0, 300) });
      return new Response(JSON.stringify(buildFallback(summary)), {
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const usage = aiJson?.usage ?? {};
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: InsightPayload | null = null;
    try {
      const args = toolCall?.function?.arguments;
      parsed = typeof args === "string" ? JSON.parse(args) : args;
    } catch {
      parsed = null;
    }
    if (!parsed || !parsed.summary) {
      log("warn", "ai_parse_failed", { user_id: userId });
      return new Response(JSON.stringify(buildFallback(summary)), {
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }

    // 6) Persist cache + telemetry (fire-and-forget but awaited briefly)
    const totalDuration = Date.now() - t0;
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    await Promise.all([
      auth.localServiceClient.from("ai_insights_cache").upsert(
        {
          user_id: userId,
          function_name: FUNCTION_NAME,
          cache_key: cacheKey,
          payload: parsed,
          model: "google/gemini-2.5-flash",
          // NOTE: tokens_input and tokens_output removed — columns dropped from
          // dashboard_insights_cache by migration 20260615172748.
          // Token counts are still available in ai_usage_events.metadata below.
          duration_ms: aiDuration,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,function_name,cache_key" },
      ),
      auth.localServiceClient.from("ai_usage_events").insert({
        user_id: userId,
        function_name: FUNCTION_NAME,
        event_type: body.forceRefresh ? "regenerate" : "generate",
        metadata: {
          cache_key: cacheKey,
          ai_duration_ms: aiDuration,
          total_duration_ms: totalDuration,
          tokens_input: usage.prompt_tokens ?? null,
          tokens_output: usage.completion_tokens ?? null,
          period_days: summary.period_days,
        },
      }),
    ]);

    log("info", "ai_success", {
      user_id: userId,
      ai_duration_ms: aiDuration,
      total_duration_ms: totalDuration,
      tokens_input: usage.prompt_tokens,
      tokens_output: usage.completion_tokens,
    });

    return new Response(JSON.stringify({ ...parsed, cached: false, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e?.status) return authErrorResponse(e, getCorsHeaders(req));
    log("error", "internal_error", { user_id: userId, message: e?.message ?? String(e) });
    return new Response(JSON.stringify({ error: e?.message ?? "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
