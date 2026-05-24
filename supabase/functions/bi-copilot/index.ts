import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, requireRole, authErrorResponse } from '../_shared/auth.ts';
import { parseContract } from '../_shared/contracts/index.ts';
import { BiCopilotSchemas } from '../_shared/contracts/schemas/bi-copilot.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';
/**
 * Edge function `bi-copilot` — responde perguntas do vendedor sobre um cliente
 * com base no contexto BI (score, sazonalidade, afinidade, tendências, benchmarks).
 *
 * Chama Lovable AI Gateway (gemini-2.5-flash) — nada de credencial extra.
 */
// deno-lint-ignore-file no-explicit-any

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const MODEL = 'google/gemini-2.5-flash';

interface RequestBody {
  question: string;
  context: Record<string, any>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  // Auth: exige vendedor autenticado (agente ou acima)
  try {
    const authCtx = await authenticateRequest(req);
    requireRole(authCtx, 'agente');
  } catch (authErr) {
    return authErrorResponse(authErr, corsHeaders);
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY ausente — habilite Lovable AI.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const contractResult = await parseContract(req, BiCopilotSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    const { data: body, responseHeaders } = contractResult;

    const systemPrompt = `Você é um copiloto de Business Intelligence comercial para vendedores B2B de brindes corporativos.
Você analisa dados reais de UM cliente específico e responde perguntas estratégicas com clareza, brevidade e ação.

REGRAS:
- Responda em português brasileiro, tom consultivo direto.
- Máximo 4 frases curtas. Sem listas longas.
- Sempre baseie a resposta nos dados do CONTEXTO. Se faltar dado, diga "não tenho esse dado, mas posso dizer que...".
- Termine com uma SUGESTÃO DE AÇÃO acionável (ligar, enviar amostra, agendar, etc.).
- Use números reais do contexto. Não invente.
- Não use jargão; fale como vendedor sênior orientando colega.

CONTEXTO DO CLIENTE:
${JSON.stringify(body.context, null, 2)}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(body.history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: body.question },
    ];

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 400,
      }),
    });

    if (!aiResponse.ok) {
      await aiResponse.text();
      console.error('AI Gateway error:', { status: aiResponse.status });
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Muitas requisições. Tente em instantes.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos esgotados — adicione fundos no Lovable AI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ error: 'Erro no provedor de IA.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiResponse.json();
    const answer =
      data?.choices?.[0]?.message?.content?.trim() ?? 'Não consegui formular resposta.';

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...corsHeaders, ...responseHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('bi-copilot error:', safeErrorFields(e));
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
