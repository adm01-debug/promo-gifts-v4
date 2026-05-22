import { getCorsHeaders } from "../_shared/cors.ts";
// Edge function: trends-insights
// Agrega métricas de Tendências e gera narrativa via Lovable AI Gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  TrendsInsightsSchemas,
} from "../_shared/contracts/schemas/trends-insights.ts";

interface Body {
  days?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const contractResult = await parseContract(req, TrendsInsightsSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    const { data: body, responseHeaders } = contractResult;
    const days = body.days ?? 30;

    const sinceCurrent = new Date(Date.now() - days * 86400000).toISOString();
    const sincePrevious = new Date(Date.now() - days * 2 * 86400000).toISOString();

    // Buscar dados — ambas tabelas têm RLS, mas admin/manager têm acesso amplo
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

    const prompt = `Você é um analista comercial sênior. Com base nas métricas abaixo de um catálogo B2B de brindes, gere insights acionáveis em português brasileiro. Seja específico, cite produtos/termos reais, e foque em ações práticas.

DADOS (últimos ${days} dias):
${JSON.stringify(summary, null, 2)}

Retorne via tool call.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você gera insights comerciais concisos e acionáveis em português brasileiro." },
          { role: "user", content: prompt },
        ],
        tools: [{
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
        }],
        tool_choice: { type: "function", function: { name: "report_insights" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({
        summary: "Sem dados suficientes para gerar insights ainda.",
        what_changed: "Aguardando mais atividade no catálogo.",
        why: "Volume baixo de eventos no período.",
        next_action: "Continue acompanhando — em breve haverá padrões claros.",
      }), { headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" } });
    }
    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trends-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
