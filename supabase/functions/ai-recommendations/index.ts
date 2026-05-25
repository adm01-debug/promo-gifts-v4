// build-tag: 2026-05-25-hf
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { z } from '../_shared/zod-validate.ts';
import { rateLimiters, applyRateLimit } from '../_shared/rate-limiter.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { extractAndParseAIJSON, safeJson } from '../_shared/json-parser.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';
import { assertSwitchEnabled } from '../_shared/kill_switch.ts';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';
import { resolveCredential } from '../_shared/credentials.ts';

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

// HF Inference API — OpenAI-compatible chat completions endpoint
const HF_MODEL = 'meta-llama/Meta-Llama-3.1-8B-Instruct';
const HF_ENDPOINT = `https://api-inference.huggingface.co/models/${HF_MODEL}/v1/chat/completions`;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const killResponse = await assertSwitchEnabled('edge_ai_recommendations', req, corsHeaders);
  if (killResponse) return killResponse;

  try {
    const protection = await runBotProtection(
      req,
      { endpoint: 'ai-recommendations', maxRequests: 60, windowSeconds: 60, blockSeconds: 1800 },
      corsHeaders,
    );
    if (!protection.allowed) return protection.blockResponse!;

    const auth = await authenticateRequest(req);
    const user = { id: auth.userId };

    const rl = await applyRateLimit(req, rateLimiters.ai, () => user.id);
    if (rl) {
      const headers = new Headers(rl.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(rl.body, { status: rl.status, headers });
    }

    const HF_API_KEY = await resolveCredential('HUGGINGFACE_API_KEY');
    if (!HF_API_KEY) {
      console.warn('[ai-recommendations] HUGGINGFACE_API_KEY not configured');
      return new Response(
        JSON.stringify({ recommendations: [], insights: 'Servi\u00e7o de IA n\u00e3o configurado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { client, products } = parsed.data;

    const systemPrompt = `Voc\u00ea \u00e9 um especialista em brindes promocionais e marketing corporativo.
Sua tarefa \u00e9 analisar o perfil de um cliente e recomendar os melhores produtos para ele.

Considere:
- O segmento/ind\u00fastria do cliente
- Hist\u00f3rico de compras anteriores
- Prefer\u00eancias de cores e estilos
- Or\u00e7amento dispon\u00edvel
- Ocasi\u00f5es e datas comemorativas relevantes

Retorne EXATAMENTE em formato JSON (sem markdown, sem texto extra):
{
  "recommendations": [
    {
      "productId": "id do produto",
      "score": 0.95,
      "reason": "Motivo breve da recomenda\u00e7\u00e3o"
    }
  ],
  "insights": "An\u00e1lise geral do perfil do cliente e sugest\u00f5es"
}

Ordene por score (maior primeiro). Retorne no m\u00e1ximo 6 recomenda\u00e7\u00f5es.`;

    const userPrompt = `## Perfil do Cliente
- Nome: ${client.name}
${client.company ? `- Empresa: ${client.company}` : ''}
${client.industry ? `- Segmento: ${client.industry}` : ''}
${client.preferences?.length ? `- Prefer\u00eancias: ${client.preferences.join(', ')}` : ''}
${client.purchaseHistory?.length ? `- Hist\u00f3rico de Compras: ${client.purchaseHistory.join(', ')}` : ''}
${client.budget ? `- Or\u00e7amento: ${client.budget}` : ''}

## Produtos Dispon\u00edveis
${products.map((p) => `- ID: ${p.id} | ${p.name} | Categoria: ${p.category}${p.tags?.length ? ` | Tags: ${p.tags.join(', ')}` : ''}`).join('\n')}

Retorne APENAS o JSON de recomenda\u00e7\u00f5es, sem texto adicional.`;

    const hfResponse = await fetchWithBreaker('huggingface', HF_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!hfResponse.ok) {
      const errText = await hfResponse.text().catch(() => '');
      console.error('[ai-recommendations] HF API error:', { status: hfResponse.status, body: errText });

      if (hfResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisi\u00e7\u00f5es excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Degrade gracefully on other HF errors
      return new Response(
        JSON.stringify({ recommendations: [], insights: 'Servi\u00e7o de IA temporariamente indispon\u00edvel.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await hfResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in HF response');
    }

    // Robust JSON extraction: handles markdown fences, trailing commas, prose around JSON
    const recommendations = extractAndParseAIJSON(content);

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof CircuitOpenError) return circuitOpenResponse(error, corsHeaders);
    if ((error as any)?.status === 401 || (error as any)?.status === 403) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error('[ai-recommendations] Unexpected error:', safeErrorFields(error));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao gerar recomenda\u00e7\u00f5es' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
