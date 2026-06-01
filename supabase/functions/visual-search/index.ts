import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { callAiWithTracking } from '../_shared/ai-usage.ts';
import { z } from '../_shared/zod-validate.ts';
import { applyRateLimit, rateLimiters } from '../_shared/rate-limiter.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { getOrCreateRequestId } from '../_shared/request-id.ts';
import { resolveCredential } from '../_shared/credentials.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = getOrCreateRequestId(req);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceRole);

  let userId: string | undefined;
  let currentStep = "initializing";

  const logToDb = async (error: any, metadata: any = {}) => {
    try {
      await serviceClient.from('system_error_logs').insert({
        user_id: userId,
        function_name: 'visual-search',
        error_message: error.message || String(error),
        stack_trace: error.stack,
        metadata: {
          ...metadata,
          requestId,
          currentStep,
          timestamp: new Date().toISOString()
        }
      });
    } catch (dbErr) {
      console.error("Critical: Failed to log error to DB", dbErr);
    }
  };

  try {
    // 1. Authentication & Config Validation
    currentStep = "config_validation";
    const AI_LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    // SSOT: HF_ACCESS_TOKEN resolvido via resolveCredential (DB-first → env fallback),
    // não Deno.env.get direto — alinhado com ai-recommendations/elevenlabs e o audit de credenciais.
    const { value: AI_HF_ACCESS_TOKEN } = await resolveCredential("HF_ACCESS_TOKEN");

    if (!AI_LOVABLE_API_KEY && !AI_HF_ACCESS_TOKEN) {
      throw new Error("Configuração ausente: LOVABLE_API_KEY ou HF_ACCESS_TOKEN não configurados no backend.");
    }

    // Bypass mechanism for simulations/tests
    const bypassKey = Deno.env.get("SIMULATION_BYPASS_KEY");
    const providedBypass = req.headers.get("X-Simulation-Bypass");
    
    let auth;
    if (bypassKey && providedBypass === bypassKey) {
      console.log("Bypass authentication active");
      userId = "00000000-0000-0000-0000-000000000000";
      auth = { userId, localServiceClient: serviceClient };
    } else {
      auth = await authenticateRequest(req);
      userId = auth.userId;
    }

    const user = { id: userId };

    // 2. Protection & Rate Limiting
    currentStep = "protection_check";
    const protection = await runBotProtection(req, {
      endpoint: 'visual-search',
      maxRequests: 20,
      windowSeconds: 60,
      blockSeconds: 1800,
      customIdentifier: `user:${user.id}`,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;

    const rl = await applyRateLimit(req, rateLimiters.ai, () => user.id);
    if (rl) {
      const headers = new Headers(rl.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(rl.body, { status: rl.status, headers });
    }

    // 3. Input Validation
    currentStep = "input_validation";
    const ImageSchema = z.object({
      imageBase64: z.string().min(10, 'Image is required').max(10_000_000, 'Image too large'),
      category: z.string().optional(),
      color: z.string().optional(),
    });

    let rawBody: any;
    try { 
      rawBody = await req.json(); 
    } catch {
      throw new Error("Corpo da requisição inválido (esperado JSON).");
    }
    
    const parsed = ImageSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || "Input inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { imageBase64 } = parsed.data;

    // 4. AI Analysis
    currentStep = "ai_analysis";
    console.log(`[${requestId}] Starting AI analysis...`);
    
    const requestBody = {
      messages: [
        {
          role: "system",
          content: `Você é um Especialista Sênior em Identificação de Produtos e Estrategista de Merchandising.
Analise imagens de brindes corporativos e extraia metadados precisos.
Responda APENAS em JSON com este formato:
{
  "productType": "tipo específico",
  "material": "material predominante",
  "colors": ["Lista de cores"],
  "category": "categoria",
  "keywords": ["5-7 termos de busca"],
  "description": "Descrição técnica sumária (20 palavras)",
  "confidence": 0.0 a 1.0,
  "rationale": "explicação",
  "visualEvidence": { "material": "...", "silhouette": "...", "finish": "..." },
  "visualHighlights": [{"label": "...", "x": 0-100, "y": 0-100, "description": "..."}]
}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analise esta imagem." },
            { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ]
    };

    let analysisContent = "";
    let usedProvider = "none";

    if (AI_HF_ACCESS_TOKEN) {
      try {
        const hfModel = "meta-llama/Llama-3.2-11B-Vision-Instruct";
        const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${hfModel}/v1/chat/completions`, {
          headers: { Authorization: `Bearer ${AI_HF_ACCESS_TOKEN}`, "Content-Type": "application/json" },
          method: "POST",
          body: JSON.stringify({ model: hfModel, messages: requestBody.messages, max_tokens: 1024 }),
        });

        if (hfResponse.ok) {
          const hfData = await hfResponse.json();
          analysisContent = hfData.choices?.[0]?.message?.content || "";
          usedProvider = "huggingface";
        } else {
          console.warn(`HF Provider failed: ${hfResponse.status} ${hfResponse.statusText}`);
        }
      } catch (err) { 
        console.error("HF Error:", err); 
      }
    }

    if (!analysisContent && AI_LOVABLE_API_KEY) {
      try {
        const model = "google/gemini-2.5-flash";
        const analysisResponse = await callAiWithTracking({
          userId: user.id,
          functionName: "visual-search",
          model,
          apiKey: AI_LOVABLE_API_KEY,
          requestBody,
        });

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          analysisContent = analysisData.choices?.[0]?.message?.content || "";
          usedProvider = "lovable";
        }
      } catch (err) {
        console.error("Lovable AI Error:", err);
      }
    }

    if (!analysisContent) {
      throw new Error("Não foi possível realizar a análise visual. Verifique as configurações de IA (Hugging Face/Lovable) e se há créditos disponíveis.");
    }

    // 5. Database Search
    currentStep = "database_search";
    let productAnalysis;
    const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { productAnalysis = JSON.parse(jsonMatch[0]); } catch { /* fallback */ }
    }
    
    if (!productAnalysis) {
      productAnalysis = { productType: "Produto", material: "N/A", colors: [], keywords: [analysisContent.slice(0, 50)], confidence: 0.5 };
    }

    const supabase = auth.localServiceClient;
    const searchTerms = [productAnalysis.productType, ...productAnalysis.keywords].join(" ");
    console.log(`[${requestId}] Searching products:`, searchTerms);

    const { data: directProducts, error: directError } = await supabase
      .from("products")
      .select("id, name, sku, category_name, description, price, images, colors, tags")
      .eq("is_active", true)
      .or(`name.ilike.%${productAnalysis.productType}%,description.ilike.%${productAnalysis.productType}%`)
      .limit(50);

    if (directError) throw directError;

    let finalProducts = directProducts || [];

    // 6. Semantic Ranking
    currentStep = "semantic_ranking";
    if (finalProducts.length > 0) {
      const { data: rankedResults, error: rankError } = await supabase
        .rpc("search_products_semantic", {
          _query: searchTerms,
          _products: finalProducts,
          _limit: 24
        });

      if (!rankError && rankedResults) {
        const rankedIds = rankedResults.map(r => r.product_id);
        finalProducts = finalProducts
          .filter(p => rankedIds.includes(p.id))
          .map(p => {
            const rank = rankedResults.find(r => r.product_id === p.id);
            return { 
              ...p, 
              relevance: rank?.score || 0.4,
              matchRationale: `Encontrado por similaridade em: ${rank?.matched_field || 'vários campos'}`
            };
          })
          .sort((a, b) => b.relevance - a.relevance);
      } else {
        finalProducts = finalProducts.map(p => ({ ...p, relevance: 0.5 }));
      }
    }

    console.log(`[${requestId}] Success. Provider: ${usedProvider}, Products found: ${finalProducts.length}`);

    return new Response(JSON.stringify({ 
      analysis: productAnalysis, 
      products: finalProducts, 
      searchTerms,
      usedProvider,
      requestId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[${requestId}] Visual search error at step "${currentStep}":`, error);
    
    // Log to DB
    await logToDb(error, { provider: usedProvider || 'none' });

    return new Response(JSON.stringify({ 
      error: error.message,
      step: currentStep,
      requestId
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
