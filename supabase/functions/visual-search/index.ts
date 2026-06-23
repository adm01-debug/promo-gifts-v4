import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { callAiWithTracking } from '../_shared/ai-usage.ts';
import { z } from '../_shared/zod-validate.ts';
import { applyRateLimit, rateLimiters } from '../_shared/rate-limiter.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { getOrCreateRequestId } from '../_shared/request-id.ts';
import { resolveCredential } from '../_shared/credentials.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitiza um termo para uso seguro dentro de um filtro PostgREST `.or(...)`.
 * Vírgulas, parênteses e curingas quebram o parser do PostgREST (a string é
 * `coluna.operador.valor` separada por vírgulas), então removemos esses
 * caracteres. O texto vem da IA (livre), logo NÃO é confiável.
 */
function sanitizeTerm(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[,()%*\\"'`{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/** Garante array de strings limpas (sem vazios/duplicatas), com teto opcional. */
function cleanList(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) out.push(t);
    }
    if (out.length >= max) break;
  }
  return [...new Set(out)];
}

/** Converte numeric/text vindo do PG em number seguro (0 se inválido). */
function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza imagens (jsonb pode ser array de strings ou de objetos {url}). */
function normalizeImages(images: unknown, fallback?: unknown): string[] {
  const list: string[] = [];
  if (Array.isArray(images)) {
    for (const img of images) {
      if (typeof img === 'string' && img) list.push(img);
      else if (
        img &&
        typeof img === 'object' &&
        typeof (img as { url?: string }).url === 'string'
      ) {
        list.push((img as { url: string }).url);
      }
    }
  }
  if (!list.length && typeof fallback === 'string' && fallback) list.push(fallback);
  return list;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = getOrCreateRequestId(req);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceRole);

  let userId: string | undefined;
  let usedProvider = 'none';
  let currentStep = 'initializing';

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
          timestamp: new Date().toISOString(),
        },
      });
    } catch (dbErr) {
      console.error('Critical: Failed to log error to DB', dbErr);
    }
  };

  try {
    // 1. Authentication & Config Validation
    currentStep = 'config_validation';
    const AI_LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    // SSOT: HF_ACCESS_TOKEN resolvido via resolveCredential (DB-first → env fallback),
    // não Deno.env.get direto — alinhado com ai-recommendations/elevenlabs e o audit de credenciais.
    const { value: AI_HF_ACCESS_TOKEN } = await resolveCredential('HF_ACCESS_TOKEN');

    if (!AI_LOVABLE_API_KEY && !AI_HF_ACCESS_TOKEN) {
      // BUG-VS-CREDS (2026-06-23): Retorna 503 (não 500) para credencial ausente.
      // 500 implica bug no código; 503 implica serviço/infra não configurado.
      // Ação: configurar HF_ACCESS_TOKEN ou LOVABLE_API_KEY como Supabase EF secret
      // via dashboard ou inserir em integration_credentials.
      console.error('[visual-search] Nenhuma credencial de IA configurada. Configure HF_ACCESS_TOKEN ou LOVABLE_API_KEY.');
      return new Response(
        JSON.stringify({
          error: 'Busca visual temporariamente indisponível. Configure as credenciais de IA no painel administrativo.',
          code: 'AI_CREDENTIALS_MISSING',
          step: currentStep,
          requestId,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Bypass mechanism for simulations/tests
    const bypassKey = Deno.env.get('SIMULATION_BYPASS_KEY');
    const providedBypass = req.headers.get('X-Simulation-Bypass');

    let auth;
    if (bypassKey && providedBypass === bypassKey) {
      console.log('Bypass authentication active');
      userId = '00000000-0000-0000-0000-000000000000';
      auth = { userId, localServiceClient: serviceClient };
    } else {
      auth = await authenticateRequest(req);
      userId = auth.userId;
    }

    const user = { id: userId };

    // 2. Protection & Rate Limiting
    currentStep = 'protection_check';
    const protection = await runBotProtection(
      req,
      {
        endpoint: 'visual-search',
        maxRequests: 20,
        windowSeconds: 60,
        blockSeconds: 1800,
        customIdentifier: `user:${user.id}`,
      },
      corsHeaders,
    );
    if (!protection.allowed) return protection.blockResponse!;

    const rl = await applyRateLimit(req, rateLimiters.ai, () => user.id);
    if (rl) {
      const headers = new Headers(rl.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(rl.body, { status: rl.status, headers });
    }

    // 3. Input Validation
    currentStep = 'input_validation';
    const ImageSchema = z.object({
      imageBase64: z.string().min(10, 'Image is required').max(10_000_000, 'Image too large'),
      category: z.string().optional(),
      color: z.string().optional(),
      manualKeywords: z.string().optional(),
    });

    let rawBody: any;
    try {
      rawBody = await req.json();
    } catch {
      throw new Error('Corpo da requisição inválido (esperado JSON).');
    }

    const parsed = ImageSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || 'Input inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { imageBase64, category, color, manualKeywords } = parsed.data;

    // Filtros manuais enviados pela UI (nomes separados por vírgula).
    const selectedCategories = (category ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const selectedColors = (color ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // 4. AI Analysis
    currentStep = 'ai_analysis';
    console.log(`[${requestId}] Starting AI analysis...`);

    // Pistas do usuário melhoram a precisão da identificação.
    const hints: string[] = [];
    if (selectedCategories.length)
      hints.push(`Categoria provável: ${selectedCategories.join(', ')}.`);
    if (selectedColors.length)
      hints.push(`Cor predominante informada: ${selectedColors.join(', ')}.`);
    if (manualKeywords) hints.push(`Foco da busca: ${manualKeywords}.`);
    const userText = hints.length
      ? `Analise esta imagem. ${hints.join(' ')}`
      : 'Analise esta imagem.';

    const requestBody = {
      messages: [
        {
          role: 'system',
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
}`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:')
                  ? imageBase64
                  : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    };

    let analysisContent = '';

    if (AI_HF_ACCESS_TOKEN) {
      try {
        const hfModel = 'meta-llama/Llama-3.2-11B-Vision-Instruct';
        const hfResponse = await fetch(
          `https://api-inference.huggingface.co/models/${hfModel}/v1/chat/completions`,
          {
            headers: {
              Authorization: `Bearer ${AI_HF_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify({
              model: hfModel,
              messages: requestBody.messages,
              max_tokens: 1024,
            }),
          },
        );

        if (hfResponse.ok) {
          const hfData = await hfResponse.json();
          analysisContent = hfData.choices?.[0]?.message?.content || '';
          usedProvider = 'huggingface';
        } else {
          console.warn(`HF Provider failed: ${hfResponse.status} ${hfResponse.statusText}`);
        }
      } catch (err) {
        console.error('HF Error:', err);
      }
    }

    if (!analysisContent && AI_LOVABLE_API_KEY) {
      try {
        const model = 'google/gemini-2.5-flash';
        const analysisResponse = await callAiWithTracking({
          userId: user.id,
          functionName: 'visual-search',
          model,
          apiKey: AI_LOVABLE_API_KEY,
          requestBody,
        });

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          analysisContent = analysisData.choices?.[0]?.message?.content || '';
          usedProvider = 'lovable';
        }
      } catch (err) {
        console.error('Lovable AI Error:', err);
      }
    }

    if (!analysisContent) {
      // BUG-VS-AI-FAIL (2026-06-23): providers AI retornaram sem conteúdo.
      // Retorna 503 (não 500) — falha de provider, não bug no código.
      console.error('[visual-search] Ambos os providers de IA falharam em retornar análise.');
      return new Response(
        JSON.stringify({
          error: 'Análise visual indisponível no momento. Tente novamente em instantes.',
          code: 'AI_ANALYSIS_FAILED',
          step: currentStep,
          requestId,
          usedProvider,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 5. Parse & normalize analysis
    currentStep = 'parse_analysis';
    let rawAnalysis: any;
    const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        rawAnalysis = JSON.parse(jsonMatch[0]);
      } catch {
        /* fallback below */
      }
    }
    if (!rawAnalysis || typeof rawAnalysis !== 'object') {
      rawAnalysis = { productType: analysisContent.slice(0, 60), keywords: [] };
    }

    // Contrato estável p/ o frontend — todos os campos sempre presentes.
    const productAnalysis = {
      productType:
        typeof rawAnalysis.productType === 'string' && rawAnalysis.productType.trim()
          ? rawAnalysis.productType.trim()
          : 'Produto',
      material: typeof rawAnalysis.material === 'string' ? rawAnalysis.material : 'N/A',
      colors: cleanList(rawAnalysis.colors),
      category: typeof rawAnalysis.category === 'string' ? rawAnalysis.category : '',
      keywords: cleanList(rawAnalysis.keywords),
      description: typeof rawAnalysis.description === 'string' ? rawAnalysis.description : '',
      confidence:
        typeof rawAnalysis.confidence === 'number'
          ? Math.max(0, Math.min(1, rawAnalysis.confidence))
          : 0.5,
      rationale: typeof rawAnalysis.rationale === 'string' ? rawAnalysis.rationale : '',
      visualEvidence:
        rawAnalysis.visualEvidence && typeof rawAnalysis.visualEvidence === 'object'
          ? rawAnalysis.visualEvidence
          : undefined,
      visualHighlights: Array.isArray(rawAnalysis.visualHighlights)
        ? rawAnalysis.visualHighlights.slice(0, 8)
        : undefined,
    };

    const supabase = auth.localServiceClient;
    const searchTermsArr = [productAnalysis.productType, ...productAnalysis.keywords];
    if (manualKeywords) searchTermsArr.push(...manualKeywords.split(/\s+/));
    const searchTerms = searchTermsArr.join(' ');
    console.log(`[${requestId}] Searching products:`, searchTerms);

    // 6. Category map (id <-> name). Catálogo tem ~400 categorias: cabe em memória.
    currentStep = 'load_categories';
    const categoryNameById = new Map<string, string>();
    const selectedCategoryIds: string[] = [];
    {
      const { data: cats } = await supabase.from('categories').select('id, name');
      for (const c of (cats ?? []) as Array<{ id: string; name: string }>) {
        categoryNameById.set(c.id, c.name);
        if (selectedCategories.includes((c.name ?? '').toLowerCase()))
          selectedCategoryIds.push(c.id);
      }
    }

    // 7. Candidate products
    currentStep = 'database_search';
    const PRODUCT_COLS =
      'id, name, sku, category_id, description, sale_price, stock_quantity, images, primary_image_url, colors, tags';

    const sanitizedTerms = [
      ...new Set(
        [
          productAnalysis.productType,
          ...productAnalysis.keywords,
          ...(manualKeywords ? manualKeywords.split(/\s+/) : []),
        ]
          .map(sanitizeTerm)
          .filter((t) => t.length >= 2),
      ),
    ].slice(0, 6);

    const orFilter = sanitizedTerms
      .flatMap((t) => [`name.ilike.%${t}%`, `description.ilike.%${t}%`])
      .join(',');

    const candidatesById = new Map<string, any>();

    if (orFilter) {
      const { data: textMatches, error: textErr } = await supabase
        .from('products')
        .select(PRODUCT_COLS)
        .eq('is_active', true)
        .or(orFilter)
        .limit(50);
      if (textErr) throw textErr;
      for (const p of textMatches ?? []) candidatesById.set(p.id, p);
    }

    // Quando o usuário fixa categoria, garante que itens da categoria apareçam
    // mesmo que o nome/descrição não contenham exatamente o termo da IA.
    if (selectedCategoryIds.length) {
      const { data: catMatches, error: catErr } = await supabase
        .from('products')
        .select(PRODUCT_COLS)
        .eq('is_active', true)
        .in('category_id', selectedCategoryIds)
        .limit(50);
      if (catErr) throw catErr;
      for (const p of catMatches ?? []) if (!candidatesById.has(p.id)) candidatesById.set(p.id, p);
    }

    const candidates = [...candidatesById.values()];

    // 8. Semantic ranking (pg_trgm) sobre os candidatos
    currentStep = 'semantic_ranking';
    const scoreById = new Map<string, { score: number; field: string }>();
    if (candidates.length > 0) {
      const rankInput = candidates.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        tags: Array.isArray(p.tags) ? p.tags : [],
        category: categoryNameById.get(p.category_id) ?? '',
      }));
      const { data: ranked, error: rankError } = await supabase.rpc('search_products_semantic', {
        _query: searchTerms,
        _products: rankInput,
        _limit: 50,
      });
      if (!rankError && Array.isArray(ranked)) {
        for (const r of ranked as Array<{
          product_id: string;
          score: number;
          matched_field: string;
        }>) {
          scoreById.set(r.product_id, { score: r.score, field: r.matched_field });
        }
      }
    }

    // 9. Build final products with corrected field mapping + filter boosts
    currentStep = 'build_results';
    const hasFilters = selectedCategoryIds.length > 0 || selectedColors.length > 0;
    const finalProducts = candidates.map((p) => {
      const categoryName = categoryNameById.get(p.category_id) ?? '';
      const productColors = (Array.isArray(p.colors) ? p.colors : []).map((c: unknown) =>
        String(c).toLowerCase(),
      );

      const ranked = scoreById.get(p.id);
      let relevance = ranked ? ranked.score : 0.5;

      const reasons: string[] = [];
      if (ranked)
        reasons.push(
          `similaridade em ${ranked.field === 'name' ? 'nome' : ranked.field === 'tags' ? 'tags' : ranked.field === 'category' ? 'categoria' : 'descrição'}`,
        );

      const categoryMatch =
        selectedCategoryIds.length > 0 && selectedCategoryIds.includes(p.category_id);
      if (categoryMatch) {
        relevance += 0.15;
        reasons.push('categoria do filtro');
      }

      const colorMatch =
        selectedColors.length > 0 && productColors.some((c) => selectedColors.includes(c));
      if (colorMatch) {
        relevance += 0.15;
        reasons.push('cor do filtro');
      }

      relevance = Math.max(0, Math.min(1, relevance));

      return {
        id: p.id,
        name: p.name,
        sku: p.sku ?? '',
        category_name: categoryName,
        price: toNumber(p.sale_price),
        stock: typeof p.stock_quantity === 'number' ? p.stock_quantity : toNumber(p.stock_quantity),
        images: normalizeImages(p.images, p.primary_image_url),
        colors: Array.isArray(p.colors) ? p.colors : [],
        relevance,
        matchRationale: reasons.length
          ? `Match por ${reasons.join(' + ')}.`
          : 'Correspondência por similaridade visual.',
        _categoryMatch: categoryMatch,
        _colorMatch: colorMatch,
      };
    });

    // Com filtros ativos, prioriza quem casa com eles; depois por relevância.
    finalProducts.sort((a, b) => {
      if (hasFilters) {
        const fa = (a._categoryMatch ? 1 : 0) + (a._colorMatch ? 1 : 0);
        const fb = (b._categoryMatch ? 1 : 0) + (b._colorMatch ? 1 : 0);
        if (fb !== fa) return fb - fa;
      }
      return b.relevance - a.relevance;
    });

    const products = finalProducts
      .slice(0, 24)
      .map(({ _categoryMatch, _colorMatch, ...rest }) => rest);

    console.log(
      `[${requestId}] Success. Provider: ${usedProvider}, Candidates: ${candidates.length}, Returned: ${products.length}`,
    );

    return new Response(
      JSON.stringify({
        analysis: productAnalysis,
        products,
        searchTerms,
        usedProvider,
        requestId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    // Auth errors → status correto (401/403) em vez de 500 genérico.
    const status = typeof error?.status === 'number' ? error.status : 500;
    console.error(`[${requestId}] Visual search error at step "${currentStep}":`, error);

    await logToDb(error, { provider: usedProvider });

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro interno',
        step: currentStep,
        requestId,
      }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
