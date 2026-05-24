import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { runBotProtection } from '../_shared/bot-protection.ts';

const BodySchema = z.object({
  productImageUrl: z.string().url(),
  logoBase64: z.string().optional(),
  logoUrl: z.string().url().optional(),
  productName: z.string().optional(),
  productColor: z.string().optional(),
  techniqueName: z.string().optional(),
  locationName: z.string().optional(),
  scenePrompt: z.string().min(1, "Scene prompt is required"),
  sceneCategory: z.string().optional(),
  brandColorHex: z.string().optional(),
  brandColorName: z.string().optional(),
  campaignBrief: z.record(z.unknown()).optional(),
  outputChannel: z.string().optional(),
  aspectRatio: z.string().optional(),
  qualityMode: z.string().optional(),
  compositionMode: z.string().optional(),
  creativeMode: z.string().optional(),
  negativePrompt: z.array(z.string()).optional(),
  brandKit: z.object({
    primaryColor: z.string().nullable().optional(),
    secondaryColor: z.string().nullable().optional(),
    toneOfVoice: z.string().optional(),
    visualStyle: z.string().optional(),
    requiredWords: z.array(z.string()).optional(),
    forbiddenWords: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }).optional(),
  refinementInstruction: z.string().nullable().optional(),
  batchVariant: z.record(z.unknown()).nullable().optional(),
  // Magic Up "fast mode": quando 'fast', usa Gemini 2.5 Flash Image Preview
  // ("nano-banana") em vez do Gemini 3 Pro Image. Permite previews/iterações
  // mais baratas e rápidas. Default: 'pro' (qualidade máxima, comportamento
  // legado preservado para chamadores que não setam o campo).
  imageModel: z.enum(["pro", "fast"]).optional().default("pro"),
}).refine(data => data.logoBase64 || data.logoUrl, {
  message: "Either logoBase64 or logoUrl must be provided",
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticateRequest(req);
    const user = { id: auth.userId };

    // Anti-scraping/abuse protection (image generation is expensive)
    const protection = await runBotProtection(req, {
      endpoint: 'generate-ad-image',
      maxRequests: 10,
      windowSeconds: 60,
      blockSeconds: 3600,
      customIdentifier: `user:${user.id}`,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      productImageUrl, logoBase64, logoUrl, productName, productColor,
      techniqueName, locationName, scenePrompt, sceneCategory,
      brandColorHex, brandColorName, campaignBrief, outputChannel,
      aspectRatio, qualityMode, compositionMode, creativeMode, negativePrompt,
      brandKit, refinementInstruction, batchVariant, imageModel,
    } = parsed.data;

    const logoImageSrc = logoBase64 || logoUrl!;

    console.log(`[ad-image] Product: ${productName} (${productColor})`);
    console.log(`[ad-image] Technique: ${techniqueName} @ ${locationName}`);
    console.log(`[ad-image] Scene category: ${sceneCategory}`);

    // ─── Smart Product Type Detection ─────────────────────────────
    const nameLower = (productName || "").toLowerCase();

    type ProductHint = { type: string; material: string; angle: string; logoTip: string };

    const PRODUCT_HINTS: { keywords: string[]; hint: ProductHint }[] = [
      { keywords: ["caneca", "mug", "xícara", "copo térmico", "copo"],
        hint: { type: "drinkware", material: "ceramic/porcelain surface with subtle reflections and gloss", angle: "slight 3/4 angle to show the printed area clearly, handle visible", logoTip: "Logo wraps naturally around the curved cylindrical surface" } },
      { keywords: ["camiseta", "camisa", "t-shirt", "blusa", "polo"],
        hint: { type: "apparel", material: "soft fabric with realistic textile folds and weave texture", angle: "front-facing, worn on a person or on a mannequin/flatlay", logoTip: "Logo appears as screen-printed or embroidered on the fabric, following the cloth's natural folds" } },
      { keywords: ["mochila", "bolsa", "bag", "sacola", "necessaire", "pochete", "pasta"],
        hint: { type: "bag", material: "durable nylon/polyester or leather with realistic stitching and zippers", angle: "front or slight 3/4 to show the main panel where the logo is", logoTip: "Logo applied via heat transfer or embroidery on the bag's main face" } },
      { keywords: ["caderno", "agenda", "bloco", "moleskine", "notebook"],
        hint: { type: "notebook", material: "smooth cover material (leatherette, paper, or hardcover) with edge details", angle: "flatlay or slight tilt showing the cover, spine visible", logoTip: "Logo debossed, foil-stamped, or printed on the cover surface" } },
      { keywords: ["caneta", "pen", "lápis", "lapiseira"],
        hint: { type: "pen", material: "metal or plastic barrel with realistic sheen and clip detail", angle: "macro close-up or angled on a desk surface to show the print area", logoTip: "Logo laser-engraved or pad-printed on the narrow barrel" } },
      { keywords: ["garrafa", "squeeze", "tumbler", "garrafinha", "térmica"],
        hint: { type: "bottle", material: "stainless steel or BPA-free plastic with reflective metallic or matte finish", angle: "upright 3/4 angle showing the label/print area and cap", logoTip: "Logo laser-engraved or silk-screened on the cylindrical body" } },
      { keywords: ["boné", "chapéu", "cap", "viseira", "bucket"],
        hint: { type: "headwear", material: "structured fabric with realistic stitching, eyelets, and brim", angle: "3/4 front showing the panel where the logo is embroidered", logoTip: "Logo embroidered with visible thread texture on the front panel" } },
      { keywords: ["guarda-chuva", "sombrinha", "umbrella"],
        hint: { type: "umbrella", material: "nylon fabric canopy with metal frame details", angle: "open position angled to show the printed panel", logoTip: "Logo screen-printed on one or more canopy panels" } },
      { keywords: ["power bank", "carregador", "charger", "cabo", "fone", "earphone", "caixa de som", "speaker"],
        hint: { type: "tech", material: "sleek plastic or aluminum housing with precise edges and LED indicators", angle: "product hero shot on a clean surface, slightly elevated angle", logoTip: "Logo pad-printed or laser-engraved on the flat surface" } },
      { keywords: ["kit", "combo", "conjunto", "set"],
        hint: { type: "kit", material: "multiple items arranged in an elegant gift-box composition", angle: "flatlay or 3/4 elevated angle showing all items in the kit", logoTip: "Logo visible on the main item and/or on the packaging" } },
      { keywords: ["toalha", "towel", "roupão"],
        hint: { type: "textile", material: "soft terry cloth or microfiber with visible texture and nap", angle: "folded arrangement or draped to show the embroidered area", logoTip: "Logo embroidered with satin stitch on the fabric" } },
    ];

    let productHint: ProductHint | null = null;
    for (const { keywords, hint } of PRODUCT_HINTS) {
      if (keywords.some(kw => nameLower.includes(kw))) {
        productHint = hint;
        break;
      }
    }

    const materialInstruction = productHint
      ? `\nPRODUCT TYPE DETECTED: ${productHint.type}
MATERIAL RENDERING: ${productHint.material}
RECOMMENDED ANGLE: ${productHint.angle}
LOGO APPLICATION: ${productHint.logoTip}`
      : '';

    console.log(`[ad-image] Product type: ${productHint?.type || 'generic'}`);

    const brandColorInstruction = brandColorHex
      ? `\nBRAND COLORS: The client brand uses ${brandColorName || brandColorHex} (${brandColorHex}). Subtly incorporate this color in the scene elements (props, background accents, clothing details) for brand harmony.`
      : '';

    const brandKitInstruction = brandKit
      ? `\nBRAND KIT:\n- Primary color: ${brandKit.primaryColor || brandColorHex || 'not provided'}\n- Secondary color: ${brandKit.secondaryColor || 'not provided'}\n- Tone of voice: ${brandKit.toneOfVoice || 'premium consultative'}\n- Visual style: ${brandKit.visualStyle || 'clean corporate'}\n- Required words/concepts: ${(brandKit.requiredWords || []).join(', ') || 'none'}\n- Forbidden words/concepts: ${(brandKit.forbiddenWords || []).join(', ') || 'none'}\n- Internal notes: ${brandKit.notes || 'none'}`
      : '\nBRAND KIT: Use the provided logo and keep a consistent, professional B2B brand expression.';

    const refinementBlock = refinementInstruction
      ? `\nREFINEMENT INSTRUCTION: ${refinementInstruction}`
      : '\nREFINEMENT INSTRUCTION: none';

    const batchBlock = batchVariant
      ? `\nBATCH VARIANT: ${JSON.stringify(batchVariant)}`
      : '';

    const strategyInstruction = `
CAMPAIGN BRIEF:
${campaignBrief ? JSON.stringify(campaignBrief, null, 2) : 'general B2B promotional sales campaign'}
${brandKitInstruction}
PRODUCT DIRECTION:
Product must stay faithful to the reference image, color, material, and personalization area.
CREATIVE MODE: ${creativeMode || 'product hero'}
COMPOSITION: ${compositionMode || 'clean centered product hero'}
FORMAT: ${aspectRatio || '1:1'} for ${outputChannel || 'whatsapp'}
QUALITY MODE: ${qualityMode || 'pro-final'}
NEGATIVE PROMPT: ${(negativePrompt || ['text inside image', 'distorted logo', 'busy background']).join(', ')}
${refinementBlock}${batchBlock}`;

    const prompt = `Create a HIGH-QUALITY commercial advertising photograph for a promotional product company.

PRODUCT: ${productName}${productColor ? ` in ${productColor} color` : ''}
CUSTOMIZATION: The product has the company logo applied via ${techniqueName || 'printing'} on the ${locationName || 'front'}.
${materialInstruction}
SCENE: ${scenePrompt}
${brandColorInstruction}
${strategyInstruction}

CRITICAL REQUIREMENTS:
1. The product shown in the reference image MUST appear prominently in the scene, clearly visible
2. The company logo from the second image MUST be visible on the product, applied realistically via ${techniqueName || 'printing'}
3. The logo should look naturally integrated into the product surface (not floating or pasted on)${productHint ? `\n4. Render the product with accurate ${productHint.material}` : ''}
${productHint ? `5` : `4`}. The overall image should look like a professional advertising campaign photo
${productHint ? `6` : `5`}. High resolution, perfect lighting, commercial photography quality
${productHint ? `7` : `6`}. The product should be the HERO of the image — the focal point
${productHint ? `8` : `7`}. People, environments, and props should complement but not overshadow the product
${productHint ? `9` : `8`}. Colors should be vibrant and appealing, suitable for marketing materials

Style: Professional commercial photography, advertising campaign quality, magazine-worthy.`;

    // Modo rápido (nano-banana) vs Modo pro: Magic Up controla via body.
    // - 'fast': Gemini 2.5 Flash Image Preview (modelo "nano-banana"), mais barato
    //   e rápido, ideal para iterações/refinamentos.
    // - 'pro' (default): Gemini 3 Pro Image Preview, qualidade máxima.
    // Cada modo usa um function_name distinto para que analytics, quotas e
    // routing (ai_function_routing) possam ser configurados de forma independente.
    const isFastMode = imageModel === "fast";
    const model = isFastMode
      ? "google/gemini-2.5-flash-image-preview"
      : "google/gemini-3-pro-image-preview";
    const functionName = isFastMode ? "generate-ad-image-fast" : "generate-ad-image";

    console.log(`[ad-image] Sending request to AI Gateway (mode: ${imageModel}, function: ${functionName}, model: ${model})...`);

    const response = await callAiWithTracking({
      userId: user.id,
      functionName,
      model,
      apiKey: LOVABLE_API_KEY,
      requestBody: {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: productImageUrl } },
              { type: "image_url", image_url: { url: logoImageSrc } },
            ],
          },
        ],
        modalities: ["image", "text"],
      },
    });

    if (!response.ok) {
      await response.text();
      console.error("[ad-image] AI Gateway error:", { status: response.status });

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione mais créditos." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      console.error("[ad-image] No image in response:", JSON.stringify(data).slice(0, 500));
      throw new Error("Nenhuma imagem gerada na resposta");
    }

    console.log("[ad-image] Ad image generated successfully");

    return new Response(
      JSON.stringify({
        imageUrl: generatedImage,
        message: data.choices?.[0]?.message?.content || "Imagem publicitária gerada com sucesso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    if (error instanceof QuotaExceededError) {
      return new Response(
        JSON.stringify({ error: "Limite mensal de IA atingido. Contate o administrador." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if ((error as any)?.status === 401 || (error as any)?.status === 403) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("[ad-image] Error:", error);
    const message = error instanceof Error ? error.message : "Falha ao gerar imagem publicitária";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
