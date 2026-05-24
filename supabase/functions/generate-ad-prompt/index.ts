import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { z } from '../_shared/zod-validate.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticateRequest(req);
    const user = { id: auth.userId };

    const protection = await runBotProtection(req, {
      endpoint: 'generate-ad-prompt',
      maxRequests: 30,
      windowSeconds: 60,
      blockSeconds: 1800,
      customIdentifier: `user:${user.id}`,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const AdPromptSchema = z.object({
      productName: z.string().trim().min(1, 'Product name is required').max(255),
      productColor: z.string().max(100).optional(),
      productCategory: z.string().max(100).optional(),
      techniqueName: z.string().max(100).optional(),
      locationName: z.string().max(100).optional(),
      maxWidth: z.union([z.string(), z.number()]).optional(),
      maxHeight: z.union([z.string(), z.number()]).optional(),
      dimensionUnit: z.string().max(10).optional(),
      isCurved: z.boolean().optional(),
      clientSegment: z.string().max(200).optional(),
      clientName: z.string().max(200).optional(),
      brandColorName: z.string().max(100).optional(),
      objective: z.string().max(500).optional(),
      tone: z.string().max(100).optional(),
      targetAudience: z.string().max(200).optional(),
      season: z.string().max(100).optional(),
      numberOfPrompts: z.number().int().min(1).max(6).optional(),
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = AdPromptSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      productName, productColor, productCategory, techniqueName, locationName,
      maxWidth, maxHeight, dimensionUnit, isCurved, clientSegment, clientName,
      brandColorName, objective, tone, targetAudience, season, numberOfPrompts,
    } = parsed.data;

    const numPrompts = Math.min(numberOfPrompts || 4, 6);

    const customizationParts: string[] = [];
    if (techniqueName) customizationParts.push(`Technique: ${techniqueName}`);
    if (locationName) customizationParts.push(`Location: ${locationName}`);
    if (maxWidth && maxHeight) customizationParts.push(`Max print area: ${maxWidth}×${maxHeight}${dimensionUnit || 'cm'}`);
    if (isCurved) customizationParts.push(`Surface type: curved/cylindrical`);
    const customizationDetail = customizationParts.length > 0 ? customizationParts.join(' | ') : 'standard printing on front';

    const systemPrompt = `You are a world-class advertising creative director specialized in promotional product photography. 

Your expertise:
- You've directed campaigns for brands like Nike, Apple, Starbucks, and Coca-Cola
- You understand how promotional products (mugs, pens, t-shirts, bags, bottles, caps, notebooks, tech accessories) are used in real-world marketing scenarios
- You create scene descriptions that result in stunning, magazine-worthy commercial photographs
- You know how to make branded products look premium and desirable

RULES:
1. Each prompt must describe a COMPLETE photographic scene with specific details about lighting, environment, mood, and composition
2. Write prompts in English (they will be sent to an image AI model)
3. Each prompt should be 2-3 sentences, detailed but focused
4. The product must ALWAYS be the hero/focal point of the scene
5. Include specific photography terms: lighting setup, depth of field, color palette, composition style
6. Vary the scenes significantly — different environments, times of day, moods, and compositions
7. Consider the product type and how it's naturally used
8. If a client segment is provided, tailor scenes to that industry
9. Never use generic descriptions — be specific and evocative
10. Think about what would make someone STOP scrolling on Instagram
11. CRITICAL: The customization details (technique, location, dimensions) are REAL specifications from the factory database. Your prompts MUST accurately describe the logo placement matching these specs. If the surface is curved, ensure the scene angle shows the curved print area clearly.

RESPOND ONLY with a valid JSON array. No markdown, no explanation. Example:
[
  {
    "title": "Short scene title in Portuguese (3-5 words)",
    "prompt": "Detailed scene description in English...",
    "category": "lifestyle|corporativo|outdoor|esporte|gastronomia|varejo|evento|educacao",
    "mood": "One-word mood descriptor",
    "bestFor": "Brief note in Portuguese about when to use this prompt (1 sentence)"
  }
]`;

    const userMessage = `Generate ${numPrompts} UNIQUE advertising scene prompts for this product:

PRODUCT: ${productName}${productColor ? ` (color: ${productColor})` : ''}${productCategory ? `\nPRODUCT CATEGORY: ${productCategory}` : ''}
CUSTOMIZATION SPECS: ${customizationDetail}
${clientName ? `CLIENT: ${clientName}` : ''}
${clientSegment ? `CLIENT INDUSTRY: ${clientSegment}` : ''}
${brandColorName ? `BRAND COLOR: ${brandColorName}` : ''}
${objective ? `CAMPAIGN OBJECTIVE: ${objective}` : ''}
${tone ? `DESIRED TONE: ${tone}` : ''}
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
${season ? `SEASON/OCCASION: ${season}` : ''}

Create ${numPrompts} distinct scene concepts that:
- Show the product in different, compelling real-world contexts
- Range from aspirational to relatable scenarios
- Would each produce a visually stunning commercial photograph
- Consider the specific product type, its materials, and how people actually use it
- The logo/branding MUST be shown applied via ${techniqueName || 'printing'} on the ${locationName || 'front'}${maxWidth && maxHeight ? `, within a ${maxWidth}×${maxHeight}${dimensionUnit || 'cm'} area` : ''}
- If the surface is curved, ensure camera angles show the curved print area prominently
- If a client industry is given, include at least 2 scenes relevant to that industry`;

    console.log("[ad-prompt] Generating prompts for:", productName);

    const model = "google/gemini-3-flash-preview";

    const response = await callAiWithTracking({
      userId: user.id,
      functionName: "generate-ad-prompt",
      model,
      apiKey: LOVABLE_API_KEY,
      requestBody: {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      },
    });

    if (!response.ok) {
      await response.text();
      console.error("[ad-prompt] AI error:", { status: response.status });
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let prompts;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      prompts = JSON.parse(cleaned);
    } catch {
      console.error("[ad-prompt] Failed to parse:", content.slice(0, 500));
      throw new Error("Falha ao processar resposta da IA");
    }

    if (!Array.isArray(prompts) || prompts.length === 0) {
      throw new Error("Nenhum prompt gerado");
    }

    console.log(`[ad-prompt] Generated ${prompts.length} prompts successfully`);

    return new Response(
      JSON.stringify({ prompts }),
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
    console.error("[ad-prompt] Error:", error);
    const message = error instanceof Error ? error.message : "Falha ao gerar prompts";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
