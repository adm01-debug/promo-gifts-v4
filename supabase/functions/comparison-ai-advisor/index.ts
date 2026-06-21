import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, requireRole, authErrorResponse } from '../_shared/auth.ts';
// Comparison AI Advisor — Lovable AI Gateway
// Recebe lista slim de produtos e retorna 3-5 bullets + bestFor highVolume/fastDelivery/premium.

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';

const ProductSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1).max(300),
  price: z.number().nonnegative(),
  stock: z.number().nonnegative().optional().default(0),
  minQuantity: z.number().nonnegative().optional().default(1),
  colorsCount: z.number().nonnegative().optional().default(0),
  stockStatus: z.string().optional().default('in-stock'),
  category: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
});

const BodySchema = z.object({
  products: z.array(ProductSchema).min(2).max(6),
});

const ToolSchema = {
  type: 'function',
  function: {
    name: 'comparison_recommendation',
    description: 'Devolve recomendação estruturada para uma comparação de produtos B2B.',
    parameters: {
      type: 'object',
      properties: {
        bullets: {
          type: 'array',
          items: { type: 'string' },
          description: '3 a 5 bullets curtos em português com insights acionáveis para o vendedor',
        },
        bestFor: {
          type: 'object',
          properties: {
            highVolume: {
              type: 'string',
              description: 'Nome do produto mais indicado para alto volume',
            },
            fastDelivery: {
              type: 'string',
              description: 'Nome do produto melhor para entrega rápida',
            },
            premium: {
              type: 'string',
              description: 'Nome do produto mais premium / valor agregado',
            },
          },
          additionalProperties: false,
        },
        rationale: { type: 'string', description: 'Resumo de 1 linha justificando a análise' },
      },
      required: ['bullets', 'bestFor', 'rationale'],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });

  // Request-local: never share CORS state across concurrent requests in the isolate.
  const corsHeaders = getCorsHeaders(req);
  // Auth: exige vendedor autenticado (agente ou acima)
  try {
    const authCtx = await authenticateRequest(req);
    requireRole(authCtx, 'agente');
  } catch (authErr) {
    return authErrorResponse(authErr, corsHeaders);
  }

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'ai_not_configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const products = parsed.data.products;
    const userPrompt = `Você é um especialista em brindes corporativos B2B.
Analise estes produtos e devolva insights práticos para um vendedor decidir qual recomendar ao cliente.

Produtos:
${products.map((p, i) => `${i + 1}. ${p.name} — R$ ${p.price.toFixed(2)} — estoque: ${p.stock} — qtd mín: ${p.minQuantity} — cores: ${p.colorsCount} — status: ${p.stockStatus} — fornecedor: ${p.supplier ?? '—'}`).join('\n')}

Considere preço, estoque, quantidade mínima, variedade de cores e disponibilidade. Use SOMENTE os nomes exatos passados acima ao indicar produtos.`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você responde sempre em português brasileiro de forma direta e prática.',
          },
          { role: 'user', content: userPrompt },
        ],
        tools: [ToolSchema],
        tool_choice: { type: 'function', function: { name: 'comparison_recommendation' } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: 'credits_exhausted' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!aiResp.ok) {
      await aiResp.text();
      console.error('AI gateway error', { status: aiResp.status });
      return new Response(JSON.stringify({ error: 'ai_error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: 'no_tool_call' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const args = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('comparison-ai-advisor exception:', safeErrorFields(e));
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'unknown_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
