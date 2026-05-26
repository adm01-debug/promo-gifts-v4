import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { z } from '../_shared/zod-validate.ts';
import { rateLimiters, applyRateLimit } from '../_shared/rate-limiter.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticateRequest(req);
    const user = { id: auth.userId };

    // Anti-scraping (UA blacklist + IP rate limit + bot logging)
    const protection = await runBotProtection(req, {
      endpoint: 'visual-search',
      maxRequests: 20,
      windowSeconds: 60,
      blockSeconds: 1800,
      customIdentifier: `user:${user.id}`,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;

    // Rate limit: 20 req/min por usuário
    const rl = await applyRateLimit(req, rateLimiters.ai, () => user.id);
    if (rl) {
      const headers = new Headers(rl.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(rl.body, { status: rl.status, headers });
    }

    const ImageSchema = z.object({
      imageBase64: z.string().min(10, 'Image is required').max(10_000_000, 'Image too large'),
    });

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const parsed = ImageSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || "Invalid input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { imageBase64 } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing image with AI...");

    const model = "google/gemini-1.5-flash";

    // Step 1: Analyze image to extract product characteristics
    const analysisResponse = await callAiWithTracking({
      userId: user.id,
      functionName: "visual-search",
      model,
      apiKey: LOVABLE_API_KEY,
      requestBody: {
        messages: [
          {
            role: "system",
            content: `Você é um especialista em identificação de produtos promocionais/brindes corporativos.
Analise a imagem e extraia características para busca de produtos similares.
Responda APENAS em JSON com este formato:
{
  "productType": "tipo do produto (ex: caneca, squeeze, caderno, bolsa, camiseta)",
  "material": "material principal (ex: plástico, metal, vidro, tecido, papel)",
  "colors": ["cores principais identificadas"],
  "category": "categoria (ex: escritório, cozinha, esporte, tecnologia, vestuário)",
  "keywords": ["palavras-chave para busca"],
  "description": "descrição curta do produto"
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise esta imagem de produto e extraia as características para encontrar produtos similares no catálogo de brindes promocionais."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ]
      },
    });

    if (!analysisResponse.ok) {
      await analysisResponse.text();
      console.error("AI analysis error:", { status: analysisResponse.status });
      
      if (analysisResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (analysisResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI analysis failed: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    const analysisContent = analysisData.choices?.[0]?.message?.content || "";
    const hasAnalysisContent = analysisContent.length > 0;
    
    console.log("AI analysis completed:", { hasContent: hasAnalysisContent });

    // Parse JSON from response
    let productAnalysis;
    try {
      const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        productAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      productAnalysis = {
        productType: "",
        material: "",
        colors: [],
        category: "",
        keywords: analysisContent.split(/\s+/).slice(0, 10),
        description: analysisContent.slice(0, 200)
      };
    }

    // Step 2: Search products in database using service client from auth
    const supabase = auth.localServiceClient;

    const searchTerms = [
      productAnalysis.productType,
      productAnalysis.material,
      productAnalysis.category,
      ...(productAnalysis.keywords || [])
    ].filter(Boolean).join(" ");

    console.log("Searching products with terms:", searchTerms);

    const { data: products, error: searchError } = await supabase
      .rpc("search_products_semantic", {
        search_query: searchTerms,
        max_results: 20
      });

    if (searchError) {
      console.error("Search error:", searchError);
      throw new Error(`Search failed: ${searchError.message}`);
    }

    let finalProducts = products || [];
    
    if (finalProducts.length === 0) {
      console.log("No semantic results, trying direct query...");
      
      const { data: directProducts, error: directError } = await supabase
        .from("products")
        .select("id, name, sku, category_name, subcategory, description, price, colors, materials, tags, images")
        .eq("is_active", true)
        .or(`name.ilike.%${productAnalysis.productType}%,category_name.ilike.%${productAnalysis.category}%`)
        .limit(20);

      if (!directError && directProducts) {
        finalProducts = directProducts.map(p => ({ ...p, relevance: 0.5 }));
      }
    }

    console.log(`Found ${finalProducts.length} similar products`);

    return new Response(
      JSON.stringify({
        analysis: productAnalysis,
        products: finalProducts,
        searchTerms
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return new Response(
        JSON.stringify({ error: "Limite mensal de IA atingido. Contate o administrador." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if ((error as any)?.status === 401 || (error as any)?.status === 403) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("Visual search error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro ao processar busca visual";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
