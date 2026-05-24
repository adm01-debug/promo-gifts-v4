import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { z } from 'npm:zod@3.23.8';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { safeJson } from '../_shared/json-parser.ts';
import { assertAllowedExternalUrl, ExternalUrlError } from '../_shared/url-allowlist.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';

const MockupBodySchema = z.object({
  productImageUrl: z.string().url().max(2000),
  logoBase64: z.string().max(5_000_000).optional(),
  logoUrl: z.string().url().max(2000).optional(),
  techniqueName: z.string().max(200).optional(),
  techniquePrompt: z.string().max(5000).optional(),
  techniqueId: z.string().max(100).optional(),
  positionX: z.number().min(0).max(100),
  positionY: z.number().min(0).max(100),
  logoWidthCm: z.number().positive().max(200).optional(),
  logoHeightCm: z.number().positive().max(200).optional(),
  logoRotation: z.number().min(-360).max(360).optional().default(0),
  logoScale: z.number().min(1).max(500).optional().default(100),
  productName: z.string().max(500).optional(),
});

// CORS headers are now dynamic — use getCorsHeaders(req) inside the handler
// See _shared/cors.ts for the centralized configuration

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticateRequest(req);
    const user = { id: auth.userId };

    const protection = await runBotProtection(
      req,
      {
        endpoint: 'generate-mockup',
        maxRequests: 15,
        windowSeconds: 60,
        blockSeconds: 3600,
        customIdentifier: `user:${user.id}`,
      },
      corsHeaders,
    );
    if (!protection.allowed) return protection.blockResponse!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const rawBody = await safeJson(req);
    if (!rawBody) {
      return new Response(JSON.stringify({ error: 'Invalid or empty request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const parsed = MockupBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const {
      productImageUrl,
      logoBase64,
      logoUrl,
      techniqueName,
      techniquePrompt,
      techniqueId,
      positionX,
      positionY,
      logoWidthCm,
      logoHeightCm,
      logoRotation,
      logoScale,
      productName,
    } = parsed.data;

    // Onda 14 / item 3.7: SSRF allowlist. Rejeita URLs externas fora dos hostnames conhecidos
    // (Cloudflare Images, fornecedores ativos, Supabase Storage). Bloqueia IPs privados.
    try {
      assertAllowedExternalUrl(productImageUrl, 'productImageUrl');
      if (logoUrl) assertAllowedExternalUrl(logoUrl, 'logoUrl');
    } catch (err) {
      if (err instanceof ExternalUrlError) {
        return new Response(
          JSON.stringify({
            error: err.message,
            errorCode: 'URL_NOT_ALLOWED',
            field: err.fieldName,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw err;
    }

    let logoImageSrc = logoBase64 || logoUrl;

    if (!logoImageSrc) {
      return new Response(JSON.stringify({ error: 'Product image and logo are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isSvg =
      typeof logoImageSrc === 'string' &&
      (logoImageSrc.startsWith('data:image/svg+xml') || logoImageSrc.endsWith('.svg'));

    if (isSvg) {
      return new Response(
        JSON.stringify({
          error: 'Logos em formato SVG não são suportados. Por favor, converta para PNG ou JPG.',
          errorCode: 'SVG_NOT_SUPPORTED',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('Generating mockup', {
      hasProductName: !!productName,
      hasTechniqueName: !!techniqueName,
      hasLogoBase64: !!logoBase64,
      hasLogoUrl: !!logoUrl,
    });

    // Calculate position descriptions
    const horizontalPos =
      positionX < 25
        ? 'far left'
        : positionX < 40
          ? 'left of center'
          : positionX > 75
            ? 'far right'
            : positionX > 60
              ? 'right of center'
              : 'horizontally centered';
    const verticalPos =
      positionY < 25
        ? 'near the very top'
        : positionY < 40
          ? 'in the upper third'
          : positionY > 75
            ? 'near the very bottom'
            : positionY > 60
              ? 'in the lower third'
              : 'vertically centered';
    const positionDesc = `${verticalPos}, ${horizontalPos}`;
    // logoWidthCm/logoHeightCm são opcionais no schema; usar fallback de 10cm
    // (tamanho médio típico de área de gravação) quando ausentes.
    const safeLogoWidthCm = logoWidthCm ?? 10;
    const safeLogoHeightCm = logoHeightCm ?? 10;
    const relativeSize = (safeLogoWidthCm + safeLogoHeightCm) / 2 / 30;
    const sizeDesc = relativeSize < 0.15 ? 'small' : relativeSize < 0.3 ? 'medium-sized' : 'large';

    const scaleInstruction =
      logoScale < 100
        ? `\n- Logo fill: the logo should fill only ${logoScale}% of the engraving area, leaving proportional empty space around it`
        : logoScale > 100
          ? `\n- Logo fill: the logo should OVERFLOW beyond the engraving area boundaries, scaled to ${logoScale}% of the area (the logo appears ${Math.round((logoScale / 100) * 10) / 10}x larger than the base engraving zone)`
          : '';
    const rotationInstruction = logoRotation
      ? `\n- Logo rotation: ${logoRotation}° clockwise from its natural upright orientation`
      : '';

    // Try to load prompt from database
    let promptTemplate: string | null = null;
    let aiModel = 'google/gemini-2.5-flash-image-preview';

    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      // Try technique-specific prompt first
      if (techniqueId) {
        const { data: techConfig } = await supabaseClient
          .from('mockup_prompt_configs')
          .select('prompt_text, ai_model')
          .eq('config_key', `technique_${techniqueId}`)
          .eq('is_active', true)
          .single();

        if (techConfig) {
          console.log('Using technique-specific prompt config');
          // Technique prompt is appended to technique description
        }
      }

      // Load main prompt
      const { data: mainConfig } = await supabaseClient
        .from('mockup_prompt_configs')
        .select('prompt_text, ai_model')
        .eq('config_key', 'main_prompt')
        .eq('is_active', true)
        .single();

      if (mainConfig) {
        promptTemplate = mainConfig.prompt_text;
        aiModel = mainConfig.ai_model;
        console.log('Using DB prompt template', { hasModel: !!aiModel });
      }
    } catch (dbErr) {
      console.warn('Could not load prompt from DB, using default:', safeErrorFields(dbErr));
    }

    // Build the final prompt
    let prompt: string;

    if (promptTemplate) {
      // Replace template variables — todos os valores são coagidos para string
      // (productName/techniquePrompt são opcionais no schema; default '').
      prompt = promptTemplate
        .replace(/\{\{productName\}\}/g, productName ?? '')
        .replace(/\{\{techniquePrompt\}\}/g, techniquePrompt ?? '')
        .replace(/\{\{positionX\}\}/g, String(positionX))
        .replace(/\{\{positionY\}\}/g, String(positionY))
        .replace(/\{\{horizontalPos\}\}/g, horizontalPos)
        .replace(/\{\{verticalPos\}\}/g, verticalPos)
        .replace(/\{\{positionDesc\}\}/g, positionDesc)
        .replace(/\{\{sizeDesc\}\}/g, sizeDesc)
        .replace(/\{\{logoWidthCm\}\}/g, String(logoWidthCm))
        .replace(/\{\{logoHeightCm\}\}/g, String(logoHeightCm))
        .replace(/\{\{scaleInstruction\}\}/g, scaleInstruction)
        .replace(/\{\{rotationInstruction\}\}/g, rotationInstruction);
    } else {
      // Fallback hardcoded prompt (legacy)
      prompt = `You are a professional product mockup generator. Apply the provided company logo onto the product image at the EXACT position specified.

Product: ${productName}
Technique: ${techniquePrompt}

EXACT LOGO POSITION (this is critical, do NOT deviate):
- Horizontal: ${positionX}% from the left edge (${horizontalPos})
- Vertical: ${positionY}% from the top edge (${verticalPos})
- The logo must be placed at EXACTLY this coordinate on the product surface: ${positionDesc}
- Logo size: ${sizeDesc} (approximately ${logoWidthCm}cm x ${logoHeightCm}cm)${scaleInstruction}${rotationInstruction}

STRICT RULES - MUST FOLLOW ALL:
1. Place the logo at EXACTLY the specified position (${positionX}% horizontal, ${positionY}% vertical). This is the most important rule.
2. DO NOT move the logo to a different location than specified. If the position says "lower third", the logo MUST be in the lower third, NOT in the middle or upper area.
3. DO NOT change the product size, proportions, dimensions, framing, or crop in any way.
4. The output must have the exact same composition and scale as the input product image.
5. The logo should follow the contours/curves of the product surface naturally.
6. Apply realistic lighting and shadows matching the product.
7. Maintain identical background, lighting, and photography style.

Output the final image maintaining the exact same dimensions and aspect ratio as the original product photo.`;
    }

    console.log('Sending request to Lovable AI Gateway', { model: aiModel });

    const response = await callAiWithTracking({
      userId: user.id,
      functionName: 'generate-mockup',
      model: aiModel,
      apiKey: LOVABLE_API_KEY,
      requestBody: {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: productImageUrl } },
              { type: 'image_url', image_url: { url: logoImageSrc } },
            ],
          },
        ],
        modalities: ['image', 'text'],
      },
    });

    if (!response.ok) {
      await response.text();
      console.error('AI Gateway error:', { status: response.status });

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI Gateway response received');

    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      console.error('No image in response', {
        hasChoices: Array.isArray(data?.choices),
        choiceCount: Array.isArray(data?.choices) ? data.choices.length : 0,
      });
      throw new Error('No image generated in response');
    }

    console.log('Mockup generated successfully');

    return new Response(
      JSON.stringify({
        mockupUrl: generatedImage,
        message: data.choices?.[0]?.message?.content || 'Mockup generated successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    if (error instanceof QuotaExceededError) {
      return new Response(
        JSON.stringify({ error: 'Limite mensal de IA atingido. Contate o administrador.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if ((error as any)?.status === 401 || (error as any)?.status === 403) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error('Error generating mockup:', safeErrorFields(error));
    const message = error instanceof Error ? error.message : 'Failed to generate mockup';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
