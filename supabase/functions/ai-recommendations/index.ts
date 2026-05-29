import { getCorsHeaders } from '../_shared/cors.ts';
import { z } from 'npm:zod@3.23.8';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { safeJson } from '../_shared/json-parser.ts';
import { resolveCredential } from '../_shared/credentials.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';
import { applyRateLimit, rateLimiters } from '../_shared/rate-limiter.ts';

const AI_ENDPOINT = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const AI_MODEL = 'google/gemini-2.5-flash';

const RecommendationRequestSchema = z.object({
  client: z.object({
    name: z.string(),
    company: z.string().optional(),
    industry: z.string().optional(),
    preferences: z.array(z.string()).optional(),
    purchaseHistory: z.array(z.string()).optional(),
    budget: z.string().optional(),
  }),
  products: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    tags: z.array(z.string()).optional(),
  })),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    let user: { id: string };
    try {
      const authResult = await authenticateRequest(req);
      user = { id: authResult.userId };
    } catch (authErr) {
      return authErrorResponse(authErr, corsHeaders);
    }

    const rl = await applyRateLimit(req, rateLimiters.ai, () => user.id);
    if (rl) {
      const headers = new Headers(rl.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(rl.body, { status: rl.status, headers });
    }

    const { value: LOVABLE_API_KEY } = await resolveCredential('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.warn('[ai-recommendations] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ recommendations: [], insights: 'Serviço de IA não configurado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rawBody = await safeJson(req);
    if (!rawBody) {
      return new Response(JSON.stringify({ error: 'Invalid or empty request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const parsed = RecommendationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { client, products } = parsed.data;

    const systemPrompt = `Você é um especialista em brindes promocionais e marketing corporativo.
Retorne EXATAMENTE em formato JSON (sem markdown):
{"recommendations":[{"productId":"id","score":0.95,"reason":"Motivo"}],"insights":"Análise"}`;

    const userPrompt = `Cliente: ${client.name}${client.industry ? ` | Segmento: ${client.industry}` : ''}\nProdutos: ${products.map(p => `${p.id}|${p.name}|${p.category}`).join(', ')}`;

    let aiResponse: Response;
    try {
      aiResponse = await fetchWithBreaker('lovable-ai', AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
    } catch (aiErr) {
      console.error('[ai-recommendations] Lovable AI request failed:', safeErrorFields(aiErr));
      return new Response(
        JSON.stringify({ recommendations: [], insights: 'Serviço de IA temporariamente indisponível.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!aiResponse.ok) {
      await aiResponse.text();
      console.error('[ai-recommendations] Lovable AI error:', aiResponse.status);
      return new Response(
        JSON.stringify({ recommendations: [], insights: 'Serviço de IA temporariamente indisponível.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiResponse.json();
    const content = aiData?.choices?.[0]?.message?.content || '{}';

    let result: { recommendations: unknown[]; insights: string };
    try {
      const cleaned = content.replace(/```json\n?|```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      result = { recommendations: [], insights: content };
    }

    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[ai-recommendations] error:', safeErrorFields(err));
    if (err instanceof CircuitOpenError) return circuitOpenResponse(err, corsHeaders);
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
