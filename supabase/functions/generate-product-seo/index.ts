import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { z } from '../_shared/zod-validate.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate
    const auth = await authenticateRequest(req);

    const protection = await runBotProtection(
      req,
      {
        endpoint: 'generate-product-seo',
        maxRequests: 30,
        windowSeconds: 60,
        blockSeconds: 1800,
        customIdentifier: `user:${auth.userId}`,
      },
      corsHeaders,
    );
    if (!protection.allowed) return protection.blockResponse!;
    const ProductSeoSchema = z.object({
      product: z.object({
        name: z.string().trim().min(1, 'Nome do produto é obrigatório').max(255),
        sku: z.string().max(100).optional(),
        description: z.string().max(5000).optional(),
        short_description: z.string().max(1000).optional(),
        brand: z.string().max(200).optional(),
        category_name: z.string().max(200).optional(),
        country_of_origin: z.string().max(100).optional(),
        materials: z.string().max(500).optional(),
        sale_price: z.union([z.string(), z.number()]).optional(),
      }),
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const parsed = ProductSeoSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
    const { product } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `Você é um especialista em SEO e marketing para e-commerce de brindes corporativos e produtos promocionais no Brasil.
Gere conteúdo de alta qualidade, otimizado para buscadores brasileiros (Google Brasil).
Use linguagem profissional, persuasiva e orientada à conversão.
Responda APENAS com o JSON solicitado, sem markdown.`;

    const userPrompt = `Dados do produto:
- Nome: ${product.name}
- SKU: ${product.sku || 'N/A'}
- Descrição: ${product.description || 'N/A'}
- Descrição curta: ${product.short_description || 'N/A'}
- Marca: ${product.brand || 'N/A'}
- Categoria: ${product.category_name || 'N/A'}
- País de origem: ${product.country_of_origin || 'N/A'}
- Materiais: ${product.materials || 'N/A'}
- Preço: ${product.sale_price ? `R$ ${product.sale_price}` : 'N/A'}

Gere os seguintes campos SEO e marketing. Use as informações acima como contexto:

1. meta_title: Título SEO entre 50-60 caracteres. Inclua a palavra-chave principal.
2. meta_description: Meta descrição entre 120-155 caracteres. Persuasiva, com call-to-action.
3. meta_keywords: 5-8 palavras-chave separadas por vírgula, relevantes para o nicho de brindes.
4. slug: URL amigável a partir do nome (lowercase, hífens, sem acentos, max 60 chars).
5. key_benefits: 4-6 benefícios principais, um por linha. Foque em diferenciais para compradores corporativos.
6. use_cases: 4-6 casos de uso/ocasiões, um por linha. Pense em eventos, campanhas, datas comemorativas.

Retorne um JSON com exatamente essas chaves: meta_title, meta_description, meta_keywords, slug, key_benefits, use_cases.`;

    const model = 'google/gemini-3-flash-preview';

    const aiResponse = await callAiWithTracking({
      userId: auth.userId,
      functionName: 'generate-product-seo',
      model,
      apiKey: LOVABLE_API_KEY,
      requestBody: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'fill_seo_marketing',
              description: 'Fill SEO and marketing fields for a product',
              parameters: {
                type: 'object',
                properties: {
                  meta_title: { type: 'string', description: 'SEO title 50-60 chars' },
                  meta_description: {
                    type: 'string',
                    description: 'Meta description 120-155 chars',
                  },
                  meta_keywords: { type: 'string', description: 'Comma-separated keywords' },
                  slug: { type: 'string', description: 'URL-friendly slug' },
                  key_benefits: { type: 'string', description: 'Key benefits, one per line' },
                  use_cases: { type: 'string', description: 'Use cases, one per line' },
                },
                required: [
                  'meta_title',
                  'meta_description',
                  'meta_keywords',
                  'slug',
                  'key_benefits',
                  'use_cases',
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'fill_seo_marketing' } },
      },
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: 'Limite de requisições excedido. Tente novamente em alguns segundos.',
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await aiResponse.text();
      console.error('AI gateway error:', { status: aiResponse.status });
      throw new Error('AI gateway error');
    }

    const data = await aiResponse.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('No structured output from AI');
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return new Response(JSON.stringify({ error: 'Cota de IA excedida este mês.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if ((e as any)?.status === 401 || (e as any)?.status === 403) {
      return authErrorResponse(e, corsHeaders);
    }
    console.error('generate-product-seo error:', safeErrorFields(e));
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
