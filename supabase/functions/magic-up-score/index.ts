import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { buildValidationErrorResponse } from "../_shared/validation-errors.ts";

const CriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  weight: z.number().min(1).max(5),
  recommendation: z.string().min(1),
});

const BodySchema = z.object({
  imageUrl: z.string().min(10),
  productName: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  campaignBrief: z.record(z.unknown()).optional().nullable(),
  brandKit: z.record(z.unknown()).optional().nullable(),
  creativeControls: z.record(z.unknown()).optional().nullable(),
  promptText: z.string().optional().nullable(),
  channel: z.string().optional().nullable(),
  aspectRatio: z.string().optional().nullable(),
});

const DiagnosisSchema = z.object({
  total: z.number().min(0).max(100),
  label: z.string().min(1),
  summary: z.string().min(1),
  criteria: z.array(CriterionSchema).min(4).max(10),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});

function safeJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI response did not contain JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await authenticateRequest(req);
    const protection = await runBotProtection(req, {
      endpoint: 'magic-up-score',
      maxRequests: 20,
      windowSeconds: 60,
      blockSeconds: 900,
      customIdentifier: `user:${auth.userId}`,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, req, corsHeaders);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const model = 'google/gemini-2.5-pro';
    const context = JSON.stringify({
      productName: parsed.data.productName,
      clientName: parsed.data.clientName,
      campaignBrief: parsed.data.campaignBrief,
      brandKit: parsed.data.brandKit,
      creativeControls: parsed.data.creativeControls,
      promptText: parsed.data.promptText,
      channel: parsed.data.channel,
      aspectRatio: parsed.data.aspectRatio,
    }, null, 2);

    const response = await callAiWithTracking({
      userId: auth.userId,
      functionName: 'magic-up-score',
      model,
      apiKey: LOVABLE_API_KEY,
      requestBody: {
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `Avalie esta peça publicitária B2B para brindes personalizados. Retorne somente JSON válido com total, label, summary, criteria, strengths, risks e recommendations. Critérios obrigatórios: clareza do produto, visibilidade do logo, adequação ao canal, coerência com marca, qualidade visual, potencial comercial, realismo e espaço para copy/CTA. Contexto:\n${context}` },
            { type: 'image_url', image_url: { url: parsed.data.imageUrl } },
          ],
        }],
      },
    });

    if (!response.ok) {
      const message = response.status === 429 ? 'Limite de IA excedido para análise de score.' : response.status === 402 ? 'Créditos de IA esgotados para análise de score.' : 'Falha na análise de score.';
      return new Response(JSON.stringify({ error: message }), { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('AI response missing content');
    const diagnosis = DiagnosisSchema.parse(safeJson(content));

    return new Response(JSON.stringify({ ...diagnosis, source: 'ai' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    if (error instanceof QuotaExceededError) {
      return new Response(JSON.stringify({ error: 'Limite mensal de IA atingido.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const authStatus = (error as { status?: number })?.status;
    if (authStatus === 401 || authStatus === 403) return authErrorResponse(error, corsHeaders);
    console.error('[magic-up-score] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro ao analisar Magic Score';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
