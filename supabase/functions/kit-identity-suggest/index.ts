import { getCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/error-response.ts";
// ============================================================
// EDGE FUNCTION: kit-identity-suggest
// Recebe nome + lista de itens do kit e sugere identidade visual
// (tag curta + cor hex + ícone lucide). Usa Lovable AI Gateway
// com tool-calling para JSON estrito. Modelo barato e rápido.
// Hardening: Zod validation + bot protection (rate limit).
// ============================================================
import { z } from '../_shared/zod-validate.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';

const PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#0EA5E9',
];

const ICONS = [
  'Package', 'Gift', 'Briefcase', 'Coffee', 'Heart',
  'Sparkles', 'Trophy', 'Leaf', 'Star', 'Rocket',
  'Sun', 'Moon', 'Zap', 'Flame', 'Award',
];

const BodySchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        name: z.string().max(200).optional(),
        sku: z.string().max(100).optional(),
      }),
    )
    .max(50)
    .optional(),
});

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: getCorsHeaders(req) });

  try {
    // Bot protection + rate limit (10 req / 60s, block 1h)
    const protection = await runBotProtection(req, {
      endpoint: 'kit-identity-suggest',
      maxRequests: 10,
      windowSeconds: 60,
      blockSeconds: 3600,
      allowSearchBots: false,
    }, getCorsHeaders(req));
    if (!protection.allowed) return protection.blockResponse!;

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros inválidos', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const name = (parsed.data.name ?? '').trim();
    const items = parsed.data.items ?? [];
    if (!name && items.length === 0) {
      return new Response(JSON.stringify({ error: 'Forneça name ou items' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const itemList = items.map((i) => i?.name).filter(Boolean).join(', ').slice(0, 800);

    const systemPrompt = `Você nomeia identidades visuais de kits corporativos brasileiros.
Devolva: tag curta (1-2 palavras CAPSLOCK), cor (HEX da paleta) e ícone (lucide).
Paleta cores: ${PALETTE.join(', ')}.
Ícones disponíveis: ${ICONS.join(', ')}.
Escolha o que melhor combina com o tema. Tag deve ser MARKETING, ex.: ONBOARDING, NATAL, VIP.`;

    const userPrompt = `Kit: "${name || 'sem nome'}"\nItens: ${itemList || 'nenhum'}\n${parsed.data.description ? `Descrição: ${parsed.data.description}` : ''}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'suggest_identity',
            description: 'Devolve a identidade sugerida',
            parameters: {
              type: 'object',
              properties: {
                tag: { type: 'string', maxLength: 20 },
                color: { type: 'string', enum: PALETTE },
                icon: { type: 'string', enum: ICONS },
                rationale: { type: 'string', maxLength: 120 },
              },
              required: ['tag', 'color', 'icon'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'suggest_identity' } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI ${aiRes.status}`, details: text.slice(0, 200) }), {
        status: aiRes.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await aiRes.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: 'Resposta IA inválida' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const out = JSON.parse(call.function.arguments);
    return new Response(JSON.stringify({ suggestion: out }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return safeErrorResponse(err, { corsHeaders, publicMessage: 'internal_error', logLabel: 'kit-identity-suggest error:' });
  }
});
