import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { z } from '../_shared/zod-validate.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate
    const auth = await authenticateRequest(req);

    const protection = await runBotProtection(
      req,
      {
        endpoint: 'analyze-logo-colors',
        maxRequests: 20,
        windowSeconds: 60,
        blockSeconds: 1800,
        customIdentifier: `user:${auth.userId}`,
      },
      corsHeaders,
    );
    if (!protection.allowed) return protection.blockResponse!;
    const LogoSchema = z.object({
      imageBase64: z.string().min(10, 'imageBase64 is required').max(10_000_000, 'Image too large'),
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
    const parsed = LogoSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || 'Invalid input' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
    const { imageBase64 } = parsed.data;

    // Handle HTTP URLs: fetch the image and convert to base64
    let imageContent = imageBase64;
    if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
      try {
        const imgResponse = await fetch(imageBase64);
        if (!imgResponse.ok) throw new Error(`Failed to fetch image: ${imgResponse.status}`);
        const contentType = imgResponse.headers.get('content-type') || 'image/png';

        if (contentType.includes('svg')) {
          return new Response(
            JSON.stringify({
              error:
                'Formato SVG não é suportado para análise de cores. Por favor, envie a logo em PNG, JPG ou WEBP.',
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }

        const arrayBuffer = await imgResponse.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        imageContent = `data:${contentType};base64,${base64}`;
      } catch (fetchErr) {
        console.error('Error fetching image URL:', safeErrorFields(fetchErr));
        return new Response(JSON.stringify({ error: 'Failed to fetch image from URL' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (imageContent.startsWith('data:image/svg')) {
      return new Response(
        JSON.stringify({
          error:
            'Formato SVG não é suportado para análise de cores. Por favor, envie a logo em PNG, JPG ou WEBP.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const model = 'google/gemini-2.5-flash';

    const aiResponse = await callAiWithTracking({
      userId: auth.userId,
      functionName: 'analyze-logo-colors',
      model,
      apiKey: LOVABLE_API_KEY,
      requestBody: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this logo image and extract ALL distinct colors present in it.
For each color, return:
- name: a human-readable color name in Portuguese (e.g. "Azul Escuro", "Vermelho")
- hex: the exact hex color code (e.g. "#003DA5")

Rules:
- Ignore white backgrounds (but include white if it's PART of the logo design)
- Ignore transparency
- Extract between 1-10 colors
- Order by visual prominence (most dominant first)
- Be precise with the hex values — match the actual pixel colors

Return ONLY a JSON array, no markdown, no explanation. Example:
[{"name":"Azul Marinho","hex":"#003DA5"},{"name":"Vermelho","hex":"#E4002B"}]`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageContent.startsWith('data:')
                    ? imageContent
                    : `data:image/png;base64,${imageContent}`,
                },
              },
            ],
          },
        ],
      },
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, tente novamente em alguns segundos.' }),
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
      console.error('AI error:', { status: aiResponse.status });
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const data = await aiResponse.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    let colors;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      colors = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      console.error('Failed to parse AI response:', { contentLength: content.length });
      colors = [];
    }

    return new Response(JSON.stringify({ colors }), {
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
    console.error('analyze-logo-colors error:', safeErrorFields(e));
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
