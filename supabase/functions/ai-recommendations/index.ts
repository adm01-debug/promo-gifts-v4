import { getCorsHeaders } from '../_shared/cors.ts';
import { z } from 'npm:zod@3.23.8';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { safeJson } from '../_shared/json-parser.ts';
import { resolveCredential } from '../_shared/credentials.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';
import { applyRateLimit, createRateLimiters } from '../_shared/rate-limiter.ts';

const HF_ENDPOINT = 'https://api-inference.huggingface.co/v1/chat/completions';
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

const rateLimiters = createRateLimiters({
  ai: { maxRequests: 10, windowSeconds: 60 },
});

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

    // BUG-008 FIX: resolveCredential() returns CredentialResolution (object), not string.
    // Previously: `const HF_API_KEY = await resolveCredential(...)` was always truthy (object),
    // so the null-check never fired and `Bearer [object Object]` was sent to HuggingFace,
    // causing 100% of AI recommendation requests to fail with 401.
    const { value: HF_API_KEY } = await resolveCredential('HUGGINGFACE_API_KEY');
    if (!HF_API_KEY) {
      console.warn('[ai-recommendations] HUGGINGFACE_API_KEY not configured');
      return new Response(
        JSON.stringify({ recommendations: [], insights: 'Servi\u00e7o de IA n\u00e3o configurado.' }),
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

    const systemPrompt = `Voc\u00ea \u00e9 um especialista em brindes promocionais e marketing corporativo.
Retorne EXATAMENTE em formato JSON (sem markdown):
{"recommendations":[{"productId":"id","score":0.95,"reason":"Motivo"}],"insights":"An\u00e1lise"}`;

    const userPrompt = `Cliente: ${client.name}${client.industry ? ` | Segmento: ${client.industry}` : ''}\nProdutos: ${products.map(p => `${p.id}|${p.name}|${p.category}`).join(', ')}`;

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
      }),
    });

    if (!hfResponse.ok) {
      await hfResponse.text();
      console.error('[ai-recommendations] HuggingFace API error:', hfResponse.status);
      return new Response(
        JSON.stringify({ recommendations: [], insights: 'Servi\u00e7o de IA temporariamente indispon\u00edvel.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const hfData = await hfResponse.json();
    const content = hfData?.choices?.[0]?.message?.content || '{}';

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
