import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from '../_shared/cors.ts';
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { z } from '../_shared/zod-validate.ts';
import { rateLimiters, applyRateLimit } from '../_shared/rate-limiter.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { buildValidationErrorResponse } from "../_shared/validation-errors.ts";

// ========================================
// PG_TRGM RE-RANK via RPC search_products_semantic
// ========================================
interface RankResult {
  product_id: string;
  score: number;
  matched_field: string;
}

async function rerankProducts(
  query: string,
  products: Array<{ id: string; name?: string; description?: string; tags?: string[]; category?: string }>,
  limit: number,
): Promise<RankResult[]> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return [];
    const client = createClient(url, serviceKey);
    const { data, error } = await castRpcResult<{
      data: RankResult[] | null;
      error: { message: string } | null;
    }>(client.rpc("search_products_semantic", {
      _query: query,
      _products: products,
      _limit: limit,
    }));
    if (error) {
      console.warn("[rerank] RPC error:", error.message);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.warn("[rerank] exception:", (e as Error).message);
    return [];
  }
}


// ========================================
// CACHE IMPLEMENTATION - TTL 5 minutes
// ========================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(ttlMs: number = 5 * 60 * 1000, maxEntries: number = 1000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  generateKey(query: string): string {
    const normalized = query.toLowerCase().trim();
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `search:${hash.toString(16)}`;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); this.misses++; return null; }
    this.hits++;
    return entry.data;
  }

  set(key: string, data: T): void {
    if (this.cache.size >= this.maxEntries) this.evictOldest();
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  private evictOldest(): void {
    const now = Date.now();
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) { this.cache.delete(key); return; }
      if (entry.expiresAt < oldestTime) { oldestTime = entry.expiresAt; oldestKey = key; }
    }
    if (oldestKey) this.cache.delete(oldestKey);
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) { this.cache.delete(key); cleaned++; }
    }
    return cleaned;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%';
    return { hits: this.hits, misses: this.misses, size: this.cache.size, hitRate };
  }
}

// ========================================
// GLOBAL CACHE INSTANCE
// ========================================
const searchCache = new TTLCache<SearchIntent>(5 * 60 * 1000, 1000);
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60 * 1000;

type EntityType = 'product' | 'client' | 'quote' | 'order' | 'collection' | 'kit' | 'mockup' | 'art_file' | 'cart_template' | 'reminder' | 'conversation' | 'magic_up' | 'category' | 'component' | 'media' | 'mixed';

interface SearchIntent {
  type: EntityType;
  entities?: EntityType[]; // multiple targets when mixed
  filters: {
    category?: string;
    color?: string;
    material?: string;
    priceRange?: 'low' | 'medium' | 'high';
    status?: string;
    clientName?: string;
    dateRange?: 'today' | 'week' | 'month' | 'year';
  };
  keywords: string[];
  originalQuery: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate
    const auth = await authenticateRequest(req);

    // Anti-scraping (UA blacklist + IP rate limit + bot logging)
    const protection = await runBotProtection(req, {
      endpoint: 'semantic-search',
      maxRequests: 120,
      windowSeconds: 60,
      blockSeconds: 1800,
      customIdentifier: `user:${auth.userId}`,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;

    // Rate limit: 100 req/min por usuário (busca pode ser intensa)
    const rl = await applyRateLimit(req, rateLimiters.search, () => auth.userId);
    if (rl) {
      const headers = new Headers(rl.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(rl.body, { status: rl.status, headers });
    }

    const ProductForRankSchema = z.object({
      id: z.string().min(1),
      name: z.string().optional().default(''),
      description: z.string().optional().default(''),
      tags: z.array(z.string()).optional().default([]),
      category: z.string().optional().default(''),
    });

    const SearchSchema = z.object({
      query: z.string().trim().min(2, 'Query too short').max(500, 'Query too long'),
      products: z.array(ProductForRankSchema).max(500).optional(),
      limit: z.number().int().min(1).max(100).optional().default(20),
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = SearchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, req, corsHeaders);
    }
    const { query, products: productsForRank, limit: rankLimit } = parsed.data;

    // Periodic cleanup
    if (Date.now() - lastCleanup > CLEANUP_INTERVAL) {
      const cleaned = searchCache.cleanup();
      if (cleaned > 0) console.log(`[Cache] Cleaned ${cleaned} expired entries`);
      lastCleanup = Date.now();
    }

    // Check cache
    const cacheKey = searchCache.generateKey(query);
    const cachedResult = searchCache.get(cacheKey);

    if (cachedResult) {
      const stats = searchCache.getStats();
      console.log(`[Cache HIT] Query: "${query}" | Stats: ${JSON.stringify(stats)}`);
      const rankings = productsForRank?.length
        ? await rerankProducts(query, productsForRank, rankLimit)
        : [];
      return new Response(
        JSON.stringify({ success: true, intent: cachedResult, rankings, cached: true, cacheStats: stats }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cache miss — call AI with tracking
    console.log(`[Cache MISS] Query: "${query}" - Calling AI...`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const model = "google/gemini-2.5-flash";

    const systemPrompt = `Você é um assistente de busca inteligente para um sistema de catálogo de produtos promocionais e brindes corporativos.

Analise a consulta do usuário e extraia a intenção de busca estruturada.

TIPOS DE BUSCA:
- product: busca por produtos (canecas, camisetas, brindes, etc.)
- client: busca por clientes (empresas, pessoas)
- quote: busca por orçamentos
- order: busca por pedidos
- collection: busca por coleções/wishlists do usuário
- kit: busca por kits personalizados (custom_kits)
- mockup: busca por mockups gerados
- art_file: busca por arquivos de arte/anexos
- cart_template: templates de carrinho salvos pelo vendedor
- reminder: lembretes de follow-up de orçamentos
- conversation: conversas com o assistente IA (Expert)
- magic_up: gerações Magic Up (cenas publicitárias)
- category: categorias do catálogo (atalho de filtro)
- component: componentes de produto (peças personalizáveis)
- media: mídias de componentes (imagens/vídeos)
- mixed: busca geral em múltiplas entidades (use entities[] para listar)

EXEMPLOS ADICIONAIS:
- "lembrete do orçamento da empresa X" → type: reminder, filters: { clientName: "X" }
- "conversas sobre estampa silk" → type: conversation, keywords: ["estampa","silk"]
- "magic up cliente Y praia" → type: magic_up, filters: { clientName: "Y" }, keywords: ["praia"]
- "categoria canecas" → type: category, keywords: ["canecas"]
- "componente alça mochila" → type: component, keywords: ["alça","mochila"]
- "template carrinho corporativo" → type: cart_template, keywords: ["corporativo"]

FILTROS POSSÍVEIS:
- category: categoria do produto (ex: canecas, camisetas, mochilas, escritório)
- color: cor do produto (ex: azul, vermelho, preto, branco)
- material: material (ex: algodão, plástico, metal, couro)
- priceRange: faixa de preço (low = barato, medium = médio, high = caro/premium)
- status: status (para orçamentos: draft, pending, sent, approved, rejected | para pedidos: pending, confirmed, shipped, delivered)
- clientName: nome do cliente mencionado
- dateRange: período de tempo (today, week, month, year)

EXEMPLOS:
- "canecas azuis baratas" → type: product, filters: { category: "canecas", color: "azul", priceRange: "low" }
- "orçamentos pendentes do João" → type: quote, filters: { status: "pending", clientName: "João" }
- "pedidos entregues essa semana" → type: order, filters: { status: "delivered", dateRange: "week" }
- "camisetas algodão branco" → type: product, filters: { category: "camisetas", material: "algodão", color: "branco" }
- "cliente Empresa ABC" → type: client, filters: { clientName: "Empresa ABC" }

Responda APENAS com JSON válido no formato especificado.`;

    const aiResponse = await callAiWithTracking({
      userId: auth.userId,
      functionName: "semantic-search",
      model,
      apiKey: LOVABLE_API_KEY,
      requestBody: {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise esta busca: "${query}"` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_search_intent",
              description: "Extrai a intenção estruturada de uma consulta de busca",
              parameters: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["product", "client", "quote", "order", "collection", "kit", "mockup", "art_file", "cart_template", "reminder", "conversation", "magic_up", "category", "component", "media", "mixed"] },
                  entities: { type: "array", items: { type: "string", enum: ["product", "client", "quote", "order", "collection", "kit", "mockup", "art_file", "cart_template", "reminder", "conversation", "magic_up", "category", "component", "media"] } },
                  filters: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      color: { type: "string" },
                      material: { type: "string" },
                      priceRange: { type: "string", enum: ["low", "medium", "high"] },
                      status: { type: "string" },
                      clientName: { type: "string" },
                      dateRange: { type: "string", enum: ["today", "week", "month", "year"] }
                    }
                  },
                  keywords: { type: "array", items: { type: "string" } }
                },
                required: ["type", "filters", "keywords"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "parse_search_intent" } }
      },
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();

    let searchIntent: SearchIntent = {
      type: 'mixed',
      filters: {},
      keywords: query.split(' ').filter((w: string) => w.length > 2),
      originalQuery: query
    };

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        searchIntent = { ...parsed, originalQuery: query };
      } catch (e) {
        console.error("[Error] Parsing tool response:", e);
      }
    }

    searchCache.set(cacheKey, searchIntent);
    const stats = searchCache.getStats();
    console.log(`[Cache SET] Query: "${query}" | Cache size: ${stats.size} | Hit rate: ${stats.hitRate}`);

    const rankings = productsForRank?.length
      ? await rerankProducts(query, productsForRank, rankLimit)
      : [];

    return new Response(
      JSON.stringify({ success: true, intent: searchIntent, rankings, cached: false, cacheStats: stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return new Response(JSON.stringify({ success: false, error: "Cota de IA excedida este mês." }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if ((error as any)?.status === 401 || (error as any)?.status === 403) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("[Error] semantic-search:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
