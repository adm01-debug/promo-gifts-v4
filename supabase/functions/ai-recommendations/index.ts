// build-tag: 2026-04-16-fix-nonneg
import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { z } from '../_shared/zod-validate.ts';
import { rateLimiters, applyRateLimit } from '../_shared/rate-limiter.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { extractAndParseAIJSON, safeJson } from '../_shared/json-parser.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';

const ClientSchema = z.object({
  name: z.string().trim().min(1).max(255),
  company: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  preferences: z.array(z.string().max(100)).max(20).optional(),
  purchaseHistory: z.array(z.string().max(200)).max(50).optional(),
  budget: z.string().max(100).optional(),
});

const ProductSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  priceRange: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

const RecommendationRequestSchema = z.object({
  client: ClientSchema,
  products: z.array(ProductSchema).min(1).max(100),
});

/**
 * JSON robustness is now handled by _shared/json-parser.ts
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Anti-scraping: bot UA check + rate limit por IP (camada externa antes do auth)
    const protection = await runBotProtection(
      req,
      {
        endpoint: 'ai-recommendations',
        maxRequests: 60,
        windowSeconds: 60,
        blockSeconds: 1800,
      },
      corsHeaders,
    );
    if (!protection.allowed) return protection.blockResponse!;

    // Auth guard: require authenticated user
    const auth = await authenticateRequest(req);
    const user = { id: auth.userId };

    // Rate limit: 20 req/min por usuário
    const rl = await applyRateLimit(req, rateLimiters.ai, () => user.id);
    if (rl) {
      const headers = new Headers(rl.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(rl.body, { status: rl.status, headers });
    }

    const rawBody = await safeJson(req);
    if (!rawBody) {
      return new Response(JSON.stringify({ error: 'Invalid or empty request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = RecommendationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
    const { client, products } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      // Key not configured in this environment — return empty recommendations gracefully
      // instead of throwing 500 (which causes the frontend to retry 3x unnecessarily).
      console.warn('[ai-recommendations] LOVABLE_API_KEY not configured — returning empty result');
      return new Response(
        JSON.stringify({ recommendations: [], insights: 'Servi\u00e7o de IA n\u00e3o configurado neste ambiente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const systemPrompt = `Voc\u00ea \u00e9 um especialista em brindes promocionais e marketing corporativo. \nSua tarefa \u00e9 analisar o perfil de um cliente e recomendar os melhores produtos para ele.\n\nConsidere:\n- O segmento/ind\u00fastria do cliente\n- Hist\u00f3rico de compras anteriores\n- Prefer\u00eancias de cores e estilos\n- Or\u00e7amento dispon\u00edvel\n- Ocasi\u00f5es e datas comemorativas relevantes\n\nRetorne EXATAMENTE em formato JSON com a estrutura:\n{\n  "recommendations": [\n    {\n      "productId": "id do produto",\n      "score": 0.95,\n      "reason": "Motivo breve da recomenda\u00e7\u00e3o"\n    }\n  ],\n  "insights": "Uma an\u00e1lise geral do perfil do cliente e sugest\u00f5es"\n}\n\nOrdene por score (maior primeiro). Retorne no m\u00e1ximo 6 recomenda\u00e7\u00f5es.`;

    const userPrompt = `\n## Perfil do Cliente\n- Nome: ${client.name}\n${client.company ? `- Empresa: ${client.company}` : ''}\n${client.industry ? `- Segmento: ${client.industry}` : ''}\n${client.preferences?.length ? `- Prefer\u00eancias: ${client.preferences.join(', ')}` : ''}\n${client.purchaseHistory?.length ? `- Hist\u00f3rico de Compras: ${client.purchaseHistory.join(', ')}` : ''}\n${client.budget ? `- Or\u00e7amento: ${client.budget}` : ''}\n\n## Produtos Dispon\u00edveis\n${products.map((p) => `- ID: ${p.id} | ${p.name} | Categoria: ${p.category}${p.tags?.length ? ` | Tags: ${p.tags.join(', ')}` : ''}`).join('\n')}\n\nCom base no perfil do cliente, recomende os produtos mais adequados.`;

    const model = 'google/gemini-2.5-flash';

    const response = await callAiWithTracking({
      userId: user.id,
      functionName: 'ai-recommendations',
      model,
      apiKey: LOVABLE_API_KEY,
      requestBody: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: 'Limite de requisi\u00e7\u00f5es excedido. Tente novamente em alguns minutos.',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Cr\u00e9ditos de IA esgotados. Adicione cr\u00e9ditos na sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      await response.text();
      console.error('AI Gateway error:', { status: response.status });
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from response — robust extraction + sanitization to survive
    // markdown fences, trailing commas, prose around the JSON, and minor truncation.
    const recommendations = extractAndParseAIJSON(content);

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return new Response(
        JSON.stringify({ error: 'Limite mensal de IA atingido. Contate o administrador.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if ((error as any)?.status === 401 || (error as any)?.status === 403) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error('Error in ai-recommendations:', safeErrorFields(error));
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro ao gerar recomenda\u00e7\u00f5es',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
