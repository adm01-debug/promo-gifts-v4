import {
  buildPublicCorsHeaders,
  getCorsHeaders,
  handleCorsPreflightIfNeeded,
} from '../_shared/cors.ts';
// BUG-011 FIX: Changed from 'https://esm.sh/@supabase/supabase-js@2.49.4' to npm: direct —
// removes import_map dependency for deployment. Same pattern used by all other edge functions.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { z } from 'npm:zod@3.23.8';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { rateLimiters, applyRateLimit } from '../_shared/rate-limiter.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { resolveCredential, getCredential } from '../_shared/credentials.ts';
import { extractAndParseAIJSON, safeJson } from '../_shared/json-parser.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';
import { assertSwitchEnabled } from '../_shared/kill_switch.ts';

// ============================================
// SCHEMAS
// ============================================

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10000),
});

const TextFilterSchema = z
  .union([z.string().min(1).max(200), z.array(z.string().min(1).max(200)).max(25)])
  .optional()
  .nullable();

const ExpertChatBodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  clientId: z.string().uuid().optional().nullable(),
  categoryFilter: TextFilterSchema,
  priceMin: z.number().nonnegative().optional().nullable(),
  priceMax: z.number().nonnegative().optional().nullable(),
  materialFilter: TextFilterSchema,
  colorFilter: TextFilterSchema,
  genderFilter: TextFilterSchema,
  supplierFilter: TextFilterSchema,
  techniqueFilter: TextFilterSchema,
  publicoFilter: TextFilterSchema,
  dataComemorativaFilter: TextFilterSchema,
  endomarketingFilter: TextFilterSchema,
  nichoFilter: TextFilterSchema,
  tagFilter: TextFilterSchema,
  onlyInStock: z.boolean().optional().nullable(),
  onlyNew: z.boolean().optional().nullable(),
  onlyKit: z.boolean().optional().nullable(),
  onlyBestseller: z.boolean().optional().nullable(),
  onlyFeatured: z.boolean().optional().nullable(),
  hasPersonalization: z.boolean().optional().nullable(),
});

// ============================================
// TYPES
// ============================================

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ClientData {
  id: string;
  name: string;
  razao_social: string;
  nome_fantasia?: string | null;
  ramo_atividade?: string | null;
  cnpj?: string | null;
  logo_url?: string | null;
  cidade?: string | null;
  estado?: string | null;
  website?: string | null;
  instagram?: string | null;
}

interface CustomerData {
  cliente_ativado?: boolean;
  data_primeira_compra?: string | null;
  data_ultima_compra?: string | null;
  total_pedidos?: number;
  valor_total_compras?: number;
  ticket_medio?: number | null;
  poder_compra?: string | null;
  perfil_preco?: string | null;
  vendedor_nome?: string | null;
  sobre?: string | null;
  observacoes?: string | null;
}

interface OrderData {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  client_name?: string;
  fulfillment_status?: string;
}

interface SemanticExpansion {
  searchTerms: string[];
  categories: string[];
  materials: string[];
  useCases: string[];
  synonyms: string[];
  intent: 'product_search' | 'client_analysis' | 'proposal' | 'followup' | 'general';
}

// ============================================
// SEMANTIC QUERY EXPANSION (AI-POWERED)
// ============================================

async function expandQuerySemantically(
  userMessage: string,
  apiKey: string,
  conversationContext: string = '',
): Promise<SemanticExpansion> {
  const defaultResult: SemanticExpansion = {
    searchTerms: [],
    categories: [],
    materials: [],
    useCases: [],
    synonyms: [],
    intent: 'general',
  };

  try {
    const expansionPrompt = `Analise a mensagem do vendedor e extraia informações para busca de produtos no catálogo de brindes corporativos/promocionais.

MENSAGEM: "${userMessage}"
${conversationContext ? `CONTEXTO DA CONVERSA: ${conversationContext}` : ''}

Retorne APENAS um JSON válido (sem markdown, sem \`\`\`) com esta estrutura:
{
  "searchTerms": ["termo1", "termo2"],
  "categories": ["categoria1"],
  "materials": ["material1"],
  "useCases": ["caso_de_uso1"],
  "synonyms": ["sinonimo1", "variacao1"],
  "intent": "product_search|client_analysis|proposal|followup|general"
}

REGRAS:
- searchTerms: palavras-chave DIRETAS para buscar no nome/descrição do produto (ex: "caneta", "squeeze", "mochila")
- categories: categorias prováveis (ex: "Escritório", "Tecnologia", "Esporte", "Cozinha", "Bolsas e Mochilas")
- materials: materiais mencionados ou implícitos (ex: "bambu", "metal", "plástico", "algodão", "couro", "silicone")
- useCases: contextos de uso (ex: "brinde corporativo", "evento", "onboarding", "fim de ano", "dia das mães")
- synonyms: sinônimos e variações dos termos (ex: "garrafa" para "squeeze", "bolsa" para "sacola", "caderno" para "bloco")
- intent: classifique a intenção principal

MAPEAMENTO SEMÂNTICO (use para gerar synonyms):
- "sustentável/ecológico/eco" → bambu, cortiça, papel reciclado, algodão orgânico, madeira, fibra de coco
- "tecnológico/tech" → carregador, power bank, pen drive, fone, cabo, suporte notebook, mouse pad
- "escritório/office" → caneta, caderno, bloco, agenda, organizador, porta-canetas, mouse pad
- "premium/executivo/luxo" → couro, metal, kit, caixa especial, gravação laser
- "esportivo/fitness" → squeeze, toalha, mochila, pochete, viseira, camiseta dry-fit
- "cozinha/gastronomia" → caneca, copo, talheres, avental, tábua de corte, kit churrasco
- "infantil/criança" → brinquedo, jogo, mochila infantil, lápis de cor, estojo
- "viagem/travel" → mala, necessaire, tag de mala, travesseiro, adaptador

Seja GENEROSO nos sinônimos — quanto mais variações, melhor a busca.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content:
              'Você é um motor de expansão de queries para busca semântica em catálogo de brindes. Responda APENAS com JSON válido, sem markdown.',
          },
          { role: 'user', content: expansionPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.warn('Query expansion failed:', response.status);
      return defaultResult;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return defaultResult;

    const parsed = extractAndParseAIJSON(content) as any;

    return {
      searchTerms: Array.isArray(parsed.searchTerms)
        ? parsed.searchTerms.filter((t: any) => typeof t === 'string')
        : [],
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.filter((t: any) => typeof t === 'string')
        : [],
      materials: Array.isArray(parsed.materials)
        ? parsed.materials.filter((t: any) => typeof t === 'string')
        : [],
      useCases: Array.isArray(parsed.useCases)
        ? parsed.useCases.filter((t: any) => typeof t === 'string')
        : [],
      synonyms: Array.isArray(parsed.synonyms)
        ? parsed.synonyms.filter((t: any) => typeof t === 'string')
        : [],
      intent: ['product_search', 'client_analysis', 'proposal', 'followup', 'general'].includes(
        parsed.intent,
      )
        ? parsed.intent
        : 'general',
    };
  } catch (err) {
    console.warn('Query expansion parse error:', safeErrorFields(err));
    return defaultResult;
  }
}

// ============================================
// LEGACY SEARCH TERM EXTRACTION (FALLBACK)
// ============================================

function extractSearchTermsFallback(messages: Message[]): string[] {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) return [];

  const content = lastUserMessage.content.toLowerCase();
  const stopWords = new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos',
    'em', 'na', 'no', 'nas', 'nos', 'por', 'para', 'com', 'sem', 'que', 'qual', 'quais',
    'como', 'onde', 'quando', 'porque', 'se', 'ou', 'e', 'mas', 'mais', 'menos', 'muito',
    'muita', 'muitos', 'muitas', 'pouco', 'pouca', 'poucos', 'poucas', 'esse', 'essa',
    'esses', 'essas', 'este', 'esta', 'estes', 'estas', 'aquele', 'aquela', 'isso', 'isto',
    'aquilo', 'meu', 'minha', 'seu', 'sua', 'nosso', 'nossa', 'algum', 'alguma', 'alguns',
    'algumas', 'nenhum', 'nenhuma', 'todo', 'toda', 'todos', 'todas', 'outro', 'outra',
    'outros', 'outras', 'mesmo', 'mesma', 'próprio', 'própria', 'você', 'vocês', 'ele',
    'ela', 'eles', 'elas', 'nós', 'eu', 'me', 'te', 'lhe', 'nos', 'preciso', 'quero',
    'gostaria', 'poderia', 'pode', 'tem', 'tenho', 'ter', 'haver', 'ser', 'estar', 'fazer',
    'dar', 'ver', 'ir', 'vir', 'saber', 'querer', 'poder', 'cliente', 'produto', 'produtos',
    'brinde', 'brindes', 'recomenda', 'recomende', 'sugira', 'sugere', 'melhor', 'melhores',
    'bom', 'boa', 'bons', 'boas', 'ótimo', 'ótima', 'excelente',
  ]);

  const words = content
    .replace(/[^\w\sàáâãéêíóôõúç]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)];
}

// ============================================
// FILTER HELPERS
// ============================================

function normalizeFilterValues(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => item.trim()).filter(Boolean);
}

function normalizeValueList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return item.trim() ? [item.trim()] : [];
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const candidate =
          typeof record.name === 'string'
            ? record.name
            : typeof record.label === 'string'
              ? record.label
              : typeof record.value === 'string'
                ? record.value
                : null;
        return candidate?.trim() ? [candidate.trim()] : [];
      }
      return [];
    });
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function readTagValues(tags: unknown, keys: string[]): string[] {
  if (!tags || typeof tags !== 'object') return [];
  const record = tags as Record<string, unknown>;
  return keys.flatMap((key) => normalizeValueList(record[key]));
}

function matchesTextFilter(value: unknown, filters: string[]): boolean {
  if (!filters.length) return true;
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return filters.some(
    (filter) => normalized === filter.toLowerCase() || normalized.includes(filter.toLowerCase()),
  );
}

function matchesListFilter(value: unknown, filters: string[]): boolean {
  if (!filters.length) return true;
  const normalizedValues = normalizeValueList(value).map((item) => item.toLowerCase());
  return filters.some((filter) =>
    normalizedValues.some(
      (item) => item === filter.toLowerCase() || item.includes(filter.toLowerCase()),
    ),
  );
}

function matchesTagFilter(tags: unknown, keys: string[], filters: string[]): boolean {
  if (!filters.length) return true;
  return matchesListFilter(readTagValues(tags, keys), filters);
}

function applyProductFilters(
  products: any[],
  filters: {
    categoryFilters: string[];
    materialFilters: string[];
    colorFilters: string[];
    genderFilters: string[];
    supplierFilters: string[];
    techniqueFilters: string[];
    publicoFilters: string[];
    dataComemorativaFilters: string[];
    endomarketingFilters: string[];
    nichoFilters: string[];
    tagFilters: string[];
    onlyInStock: boolean;
    onlyNew: boolean;
    onlyKit: boolean;
    onlyBestseller: boolean;
    onlyFeatured: boolean;
    hasPersonalization: boolean;
  },
) {
  return products.filter((product: any) => {
    if (!matchesListFilter(product.materials, filters.materialFilters)) return false;
    if (!matchesListFilter(product.colors, filters.colorFilters)) return false;
    if (!matchesTextFilter(product.gender, filters.genderFilters)) return false;
    if (!matchesTagFilter(product.tags, ['publicoAlvo', 'publico_alvo'], filters.publicoFilters))
      return false;
    if (
      !matchesTagFilter(
        product.tags,
        ['datasComemorativas', 'datas_comemorativas'],
        filters.dataComemorativaFilters,
      )
    )
      return false;
    if (!matchesTagFilter(product.tags, ['endomarketing'], filters.endomarketingFilters))
      return false;
    if (
      !matchesTagFilter(
        product.tags,
        [
          'nicho',
          'segmentosAtividade',
          'segmentos_atividade',
          'ramo',
          'ramosAtividade',
          'ramos_atividade',
        ],
        filters.nichoFilters,
      )
    )
      return false;
    if (filters.tagFilters.length > 0) {
      const topLevelTags = normalizeValueList(product.tags);
      const nestedTags = readTagValues(product.tags, ['tags']);
      const allTags = [...topLevelTags, ...nestedTags].map((t) => t.toLowerCase());
      if (
        !filters.tagFilters.some((f) =>
          allTags.some((t) => t === f.toLowerCase() || t.includes(f.toLowerCase())),
        )
      )
        return false;
    }
    if (filters.techniqueFilters.length > 0) {
      const techFromTags = readTagValues(product.tags, ['tecnicas', 'techniques', 'tecnica']);
      const techDirect = normalizeValueList(product.techniques);
      const allTech = [...techFromTags, ...techDirect].map((t) => t.toLowerCase());
      if (
        !filters.techniqueFilters.some((f) =>
          allTech.some((t) => t === f.toLowerCase() || t.includes(f.toLowerCase())),
        )
      )
        return false;
    }
    if (filters.onlyInStock && Number(product.stock_quantity ?? product.stock ?? 0) <= 0)
      return false;
    if (filters.onlyNew && !Boolean(product.new_arrival ?? product.is_new)) return false;
    if (filters.onlyKit && !Boolean(product.is_kit)) return false;
    if (filters.onlyFeatured && !Boolean(product.featured ?? product.is_featured)) return false;
    if (filters.onlyBestseller && !Boolean(product.best_seller ?? product.is_bestseller))
      return false;
    if (
      filters.hasPersonalization &&
      !Boolean(product.has_personalization ?? product.personalizable ?? product.is_personalizable)
    )
      return false;
    return true;
  });
}

// ============================================
// SEMANTIC RELEVANCE SCORING
// ============================================

function scoreProductRelevance(
  product: any,
  expansion: SemanticExpansion,
  categoryMap: Record<string, string>,
): number {
  let score = 0;
  const name = (product.name || '').toLowerCase();
  const description = (product.description || '').toLowerCase();
  const catName = (categoryMap[product.category_id] || '').toLowerCase();
  const materials = normalizeValueList(product.materials)
    .map((m) => m.toLowerCase())
    .join(' ');
  const tagsText = JSON.stringify(product.tags || {}).toLowerCase();
  const allText = `${name} ${description} ${materials} ${tagsText} ${catName}`;

  for (const term of expansion.searchTerms) {
    const t = term.toLowerCase();
    if (name.includes(t)) score += 10;
    else if (description.includes(t)) score += 5;
    else if (allText.includes(t)) score += 3;
  }

  for (const syn of expansion.synonyms) {
    const s = syn.toLowerCase();
    if (name.includes(s)) score += 8;
    else if (description.includes(s)) score += 4;
    else if (allText.includes(s)) score += 2;
  }

  for (const cat of expansion.categories) {
    if (catName.includes(cat.toLowerCase())) score += 6;
  }

  for (const mat of expansion.materials) {
    if (materials.includes(mat.toLowerCase())) score += 5;
    else if (allText.includes(mat.toLowerCase())) score += 2;
  }

  for (const uc of expansion.useCases) {
    if (allText.includes(uc.toLowerCase())) score += 3;
  }

  return score;
}

// ============================================
// MULTI-STRATEGY SEARCH
// ============================================

async function semanticProductSearch(
  extClient: any,
  expansion: SemanticExpansion,
  fallbackTerms: string[],
  productCols: string,
  limit: number = 60,
): Promise<{ products: any[]; searchMethod: string }> {
  const allTerms = [
    ...expansion.searchTerms,
    ...expansion.synonyms,
    ...expansion.materials,
    ...expansion.useCases,
  ];

  const uniqueTerms = [
    ...new Set(
      [...allTerms, ...fallbackTerms].map((t) =>
        t
          .toLowerCase()
          .replace(/[(),.]/g, ' ')
          .trim(),
      ),
    ),
  ]
    .filter((t) => t.length >= 3)
    .slice(0, 15);

  if (uniqueTerms.length === 0) {
    return { products: [], searchMethod: 'none' };
  }

  console.log('Semantic search terms prepared:', { count: uniqueTerms.length });

  const exactResults: any[] = [];
  for (const term of expansion.searchTerms.slice(0, 3)) {
    if (term.length < 3) continue;
    const { data } = await extClient
      .from('products')
      .select(productCols)
      .eq('is_active', true)
      .ilike('name', `%${term}%`)
      .limit(15);
    if (data) exactResults.push(...data);
  }

  const orParts: string[] = [];
  for (const term of uniqueTerms.slice(0, 8)) {
    if (term.length < 3) continue;
    orParts.push(`name.ilike.%${term}%`);
    orParts.push(`description.ilike.%${term}%`);
  }

  let broadResults: any[] = [];
  if (orParts.length > 0) {
    const { data, error } = await extClient
      .from('products')
      .select(productCols)
      .eq('is_active', true)
      .or(orParts.join(','))
      .limit(limit);

    if (error) {
      console.error('Broad search error:', safeErrorFields(error));
    } else {
      broadResults = data || [];
    }
  }

  let categoryResults: any[] = [];
  if (expansion.categories.length > 0) {
    const catOrFilter = expansion.categories.map((c) => `name.ilike.%${c}%`).join(',');

    const { data: cats } = await extClient
      .from('categories')
      .select('id')
      .or(catOrFilter)
      .limit(10);

    if (cats?.length) {
      const catIds = cats.map((c: any) => c.id);
      const { data } = await extClient
        .from('products')
        .select(productCols)
        .eq('is_active', true)
        .in('category_id', catIds)
        .limit(30);
      if (data) categoryResults = data;
    }
  }

  const seen = new Set<string>();
  const merged: any[] = [];

  for (const p of [...exactResults, ...broadResults, ...categoryResults]) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }

  const method = [
    exactResults.length > 0 ? `exact(${exactResults.length})` : null,
    broadResults.length > 0 ? `broad(${broadResults.length})` : null,
    categoryResults.length > 0 ? `category(${categoryResults.length})` : null,
  ]
    .filter(Boolean)
    .join('+');

  console.log('Semantic search results:', { count: merged.length, method });

  return { products: merged, searchMethod: method || 'fallback' };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  let corsHeaders: Record<string, string>;
  try {
    corsHeaders = getCorsHeaders(req);
  } catch {
    corsHeaders = buildPublicCorsHeaders();
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const killResponse = await assertSwitchEnabled('edge_expert_chat', req, corsHeaders);
  if (killResponse) return killResponse;

  try {
    const auth = await authenticateRequest(req);
    const userId = auth.userId;

    const protection = await runBotProtection(
      req,
      {
        endpoint: 'expert-chat',
        maxRequests: 30,
        windowSeconds: 60,
        blockSeconds: 1800,
        customIdentifier: `user:${userId}`,
      },
      corsHeaders,
    );
    if (!protection.allowed) return protection.blockResponse!;

    const rl = await applyRateLimit(req, rateLimiters.ai, () => userId);
    if (rl) {
      const headers = new Headers(rl.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(rl.body, { status: rl.status, headers });
    }

    console.log('Authenticated expert-chat request');

    const rawBody = await safeJson(req);
    if (!rawBody) {
      return new Response(JSON.stringify({ error: 'Invalid or empty request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = ExpertChatBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      console.error('Validation errors:', JSON.stringify(parsed.error.flatten()));
      return new Response(
        JSON.stringify({ error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const {
      messages,
      clientId,
      categoryFilter,
      priceMin,
      priceMax,
      materialFilter,
      colorFilter,
      genderFilter,
      supplierFilter,
      techniqueFilter,
      publicoFilter,
      dataComemorativaFilter,
      endomarketingFilter,
      nichoFilter,
      tagFilter,
      onlyInStock,
      onlyNew,
      onlyKit,
      onlyBestseller,
      onlyFeatured,
      hasPersonalization,
    } = parsed.data;

    const normalizedFilters = {
      categoryFilters: normalizeFilterValues(categoryFilter),
      materialFilters: normalizeFilterValues(materialFilter),
      colorFilters: normalizeFilterValues(colorFilter),
      genderFilters: normalizeFilterValues(genderFilter),
      supplierFilters: normalizeFilterValues(supplierFilter),
      techniqueFilters: normalizeFilterValues(techniqueFilter),
      publicoFilters: normalizeFilterValues(publicoFilter),
      dataComemorativaFilters: normalizeFilterValues(dataComemorativaFilter),
      endomarketingFilters: normalizeFilterValues(endomarketingFilter),
      nichoFilters: normalizeFilterValues(nichoFilter),
      tagFilters: normalizeFilterValues(tagFilter),
      onlyInStock: Boolean(onlyInStock),
      onlyNew: Boolean(onlyNew),
      onlyKit: Boolean(onlyKit),
      onlyBestseller: Boolean(onlyBestseller),
      onlyFeatured: Boolean(onlyFeatured),
      hasPersonalization: Boolean(hasPersonalization),
    };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não está configurada');

    const supabase = auth.localServiceClient;

    let sellerFirstName = '';
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single();
    if (sellerProfile?.full_name) {
      sellerFirstName = sellerProfile.full_name.split(' ')[0];
    }

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const conversationSummary = messages
      .slice(-4)
      .map((m) => `${m.role}: ${m.content.substring(0, 100)}`)
      .join('\n');

    const expansionPromise = expandQuerySemantically(
      lastUserMsg,
      LOVABLE_API_KEY,
      conversationSummary,
    );
    const fallbackTerms = extractSearchTermsFallback(messages);

    let clientContext = '';
    let clientData: ClientData | null = null;
    let customerData: CustomerData | null = null;

    if (clientId) {
      console.log('Fetching client data from CRM');

      const [urlRes, svcRes, anonRes] = await Promise.all([
        resolveCredential('EXTERNAL_CRM_URL'),
        resolveCredential('EXTERNAL_CRM_SERVICE_ROLE_KEY'),
        resolveCredential('EXTERNAL_CRM_ANON_KEY'),
      ]);
      const CRM_URL = urlRes.value;
      const CRM_KEY = svcRes.value ?? anonRes.value;

      if (CRM_URL && CRM_KEY) {
        const crmClient = createClient(CRM_URL, CRM_KEY);

        const { data: company, error: companyError } = await crmClient
          .from('companies')
          .select(
            'id, razao_social, nome_fantasia, title, ramo_atividade, cnpj, logo_url, cidade, estado, website, instagram, is_customer, is_supplier',
          )
          .eq('id', clientId)
          .single();

        if (companyError) {
          console.error('Error fetching CRM company:', safeErrorFields(companyError));
        } else if (company) {
          clientData = {
            id: company.id,
            name: company.title || company.nome_fantasia || company.razao_social,
            razao_social: company.razao_social,
            nome_fantasia: company.nome_fantasia,
            ramo_atividade: company.ramo_atividade,
            cnpj: company.cnpj,
            logo_url: company.logo_url,
            cidade: company.cidade,
            estado: company.estado,
            website: company.website,
            instagram: company.instagram,
          };
          console.log('CRM company data loaded');
        }

        const { data: customer, error: customerError } = await crmClient
          .from('customers')
          .select(
            'cliente_ativado, data_primeira_compra, data_ultima_compra, total_pedidos, valor_total_compras, ticket_medio, poder_compra, perfil_preco, vendedor_nome, sobre, observacoes',
          )
          .eq('company_id', clientId)
          .single();

        if (!customerError && customer) {
          customerData = customer;
          console.log('CRM customer data loaded', {
            hasOrdersTotal: customerData?.total_pedidos !== undefined,
          });
        }

        const { data: contacts } = await crmClient
          .from('contacts')
          .select('first_name, last_name, cargo, departamento')
          .eq('company_id', clientId)
          .is('deleted_at', null)
          .limit(5);

        if (contacts?.length) console.log('CRM contacts loaded', { count: contacts.length });
      } else {
        console.warn('CRM env vars not set, skipping CRM data');
      }

      let quoteProductHistory: any[] = [];
      const { data: clientQuotes, error: quotesError } = await supabase
        .from('quotes')
        .select(
          `id, quote_number, status, total, created_at, valid_until, sent_at, client_response,
          quote_items (product_name, product_sku, quantity, unit_price, subtotal)`,
        )
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (!quotesError && clientQuotes) {
        quoteProductHistory = clientQuotes;
        console.log('Client quote history loaded', { count: quoteProductHistory.length });
      }

      let clientOrders: OrderData[] = [];
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, client_name, fulfillment_status')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!ordersError && orders) {
        clientOrders = orders;
        console.log('Client orders loaded', { count: clientOrders.length });
      }

      const productPreferences = new Map<
        string,
        { count: number; totalValue: number; lastPurchase: string }
      >();
      quoteProductHistory.forEach((quote) => {
        if (quote.quote_items) {
          quote.quote_items.forEach((item: any) => {
            const existing = productPreferences.get(item.product_name) || {
              count: 0,
              totalValue: 0,
              lastPurchase: quote.created_at,
            };
            productPreferences.set(item.product_name, {
              count: existing.count + item.quantity,
              totalValue: existing.totalValue + (item.subtotal || 0),
              lastPurchase:
                quote.created_at > existing.lastPurchase ? quote.created_at : existing.lastPurchase,
            });
          });
        }
      });

      const topProducts = Array.from(productPreferences.entries())
        .sort((a, b) => b[1].totalValue - a[1].totalValue)
        .slice(0, 5);

      const averageOrderValue =
        quoteProductHistory.length > 0
          ? quoteProductHistory.reduce((sum, q) => sum + (q.total || 0), 0) /
            quoteProductHistory.length
          : 0;

      const pendingQuotes = quoteProductHistory.filter(
        (q) => q.status === 'sent' && !q.client_response,
      );
      const expiringQuotes = quoteProductHistory.filter((q) => {
        if (!q.valid_until) return false;
        const daysUntilExpiry =
          (new Date(q.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return (
          daysUntilExpiry > 0 &&
          daysUntilExpiry <= 7 &&
          q.status !== 'approved' &&
          q.status !== 'converted'
        );
      });

      const daysSinceLastInteraction =
        quoteProductHistory.length > 0
          ? Math.floor(
              (Date.now() - new Date(quoteProductHistory[0].created_at).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;

      const totalRevenue = clientOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const conversionRate =
        quoteProductHistory.length > 0
          ? (
              (quoteProductHistory.filter(
                (q) => q.status === 'approved' || q.status === 'converted',
              ).length /
                quoteProductHistory.length) *
              100
            ).toFixed(0)
          : '0';

      if (clientData) {
        clientContext = `
CONTEXTO COMPLETO DO CLIENTE (CRM):
- Nome: ${clientData.name}
- Razão Social: ${clientData.razao_social}
${clientData.nome_fantasia ? `- Nome Fantasia: ${clientData.nome_fantasia}` : ''}
- Ramo de atividade: ${clientData.ramo_atividade || 'Não informado'}
${clientData.cnpj ? `- CNPJ: ${clientData.cnpj}` : ''}
- Localização: ${[clientData.cidade, clientData.estado].filter(Boolean).join(', ') || 'Não informada'}
- Logo disponível: ${clientData.logo_url ? 'Sim' : 'Não'}
${clientData.website ? `- Website: ${clientData.website}` : ''}
${clientData.instagram ? `- Instagram: ${clientData.instagram}` : ''}
- Dias desde última interação: ${daysSinceLastInteraction !== null ? `${daysSinceLastInteraction} dias` : 'N/A'}

DADOS COMERCIAIS (CRM):
${
  customerData
    ? `- Status: ${customerData.cliente_ativado ? 'Ativo' : 'Inativo'}
- Total de pedidos (CRM): ${customerData.total_pedidos || 0}
- Valor total compras: ${customerData.valor_total_compras ? `R$ ${customerData.valor_total_compras.toLocaleString('pt-BR')}` : 'N/A'}
- Ticket médio (CRM): ${customerData.ticket_medio ? `R$ ${customerData.ticket_medio.toFixed(2)}` : 'N/A'}
- Poder de compra: ${customerData.poder_compra || 'N/A'}
- Perfil de preço: ${customerData.perfil_preco || 'N/A'}
- Primeira compra: ${customerData.data_primeira_compra ? new Date(customerData.data_primeira_compra).toLocaleDateString('pt-BR') : 'N/A'}
- Última compra: ${customerData.data_ultima_compra ? new Date(customerData.data_ultima_compra).toLocaleDateString('pt-BR') : 'N/A'}
- Vendedor responsável: ${customerData.vendedor_nome || 'N/A'}
${customerData.sobre ? `- Sobre: ${customerData.sobre}` : ''}
${customerData.observacoes ? `- Observações: ${customerData.observacoes}` : ''}`
    : '- Sem dados comerciais no CRM'
}

MÉTRICAS DE VENDAS (PLATAFORMA):
- Ticket médio orçamentos: ${averageOrderValue > 0 ? `R$ ${averageOrderValue.toFixed(2)}` : 'Sem dados'}
- Total de orçamentos: ${quoteProductHistory.length}
- Pedidos confirmados: ${clientOrders.length}
- Receita total em pedidos: R$ ${totalRevenue.toFixed(2)}
- Taxa de conversão: ${conversionRate}%

ORÇAMENTOS RECENTES:
${
  quoteProductHistory.length > 0
    ? quoteProductHistory
        .slice(0, 8)
        .map((q, i) => {
          const statusMap: Record<string, string> = {
            draft: 'Rascunho',
            sent: 'Enviado',
            approved: 'Aprovado',
            rejected: 'Rejeitado',
            converted: 'Convertido',
            expired: 'Expirado',
          };
          return `${i + 1}. ${q.quote_number} - R$ ${q.total?.toFixed(2)} - ${statusMap[q.status] || q.status} - ${new Date(q.created_at).toLocaleDateString('pt-BR')}${q.client_response ? ` [Resposta: ${q.client_response}]` : ''}`;
        })
        .join('\n')
    : 'Nenhum orçamento encontrado'
}

PEDIDOS CONFIRMADOS:
${
  clientOrders.length > 0
    ? clientOrders
        .map((o, i) => {
          const statusMap: Record<string, string> = {
            pending: 'Pendente',
            confirmed: 'Confirmado',
            production: 'Em Produção',
            shipped: 'Enviado',
            delivered: 'Entregue',
          };
          return `${i + 1}. ${o.order_number} - R$ ${o.total?.toFixed(2)} - ${statusMap[o.status] || o.status} - ${new Date(o.created_at).toLocaleDateString('pt-BR')}`;
        })
        .join('\n')
    : 'Nenhum pedido encontrado'
}

ALERTAS E FOLLOW-UPS:
${pendingQuotes.length > 0 ? `⚠️ ${pendingQuotes.length} orçamento(s) enviado(s) aguardando resposta do cliente` : ''}
${expiringQuotes.length > 0 ? `⏰ ${expiringQuotes.length} orçamento(s) prestes a vencer nos próximos 7 dias` : ''}
${daysSinceLastInteraction !== null && daysSinceLastInteraction > 30 ? `🔔 Cliente inativo há ${daysSinceLastInteraction} dias - considere retomar contato` : ''}
${!pendingQuotes.length && !expiringQuotes.length && (daysSinceLastInteraction === null || daysSinceLastInteraction <= 30) ? '✅ Nenhum alerta pendente' : ''}

PRODUTOS MAIS COMPRADOS:
${
  topProducts.length > 0
    ? topProducts
        .map(
          ([name, data], i) =>
            `  ${i + 1}. ${name} - ${data.count} unidades, R$ ${data.totalValue.toFixed(2)} total`,
        )
        .join('\n')
    : '  Nenhum histórico de produtos'
}

INTELIGÊNCIA DE UPSELL:
${
  topProducts.length > 0
    ? `- Preferências: ${topProducts.map(([name]) => name).join(', ')}
- Sugira versões premium ou complementares dos itens já comprados
- Ticket médio de R$ ${averageOrderValue.toFixed(2)} para calibrar sugestões
- Ofereça kits com produtos que ele já conhece`
    : '- Cliente novo - foque em entender necessidades e construir relacionamento'
}
`;
      }
    }

    const expansion = await expansionPromise;
    console.log('Semantic expansion prepared:', {
      intent: expansion.intent,
      searchTerms: expansion.searchTerms.length,
      synonyms: expansion.synonyms.length,
      categories: expansion.categories.length,
      materials: expansion.materials.length,
    });

    let productsContext = '';
    let semanticResults: any[] = [];

    // fix: ssot-bypass — credential vault
    const EXT_URL = await getCredential('EXTERNAL_PROMOBRIND_URL');
    const EXT_KEY = await getCredential('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY');

    if (!EXT_URL || !EXT_KEY) {
      console.error('External DB env vars not set — cannot fetch products');
    } else if (
      expansion.intent === 'product_search' ||
      expansion.intent === 'proposal' ||
      expansion.searchTerms.length > 0 ||
      fallbackTerms.length > 0
    ) {
      const extClient = createClient(EXT_URL, EXT_KEY);
      const PRODUCT_COLS =
        'id, name, sku, sale_price, primary_image_url, category_id, supplier_id, description, brand, gender, is_kit, stock_quantity, min_quantity, tags, active';

      let resolvedCategoryIds: string[] = [];
      if (normalizedFilters.categoryFilters.length > 0) {
        const catOrFilter = normalizedFilters.categoryFilters
          .map((c) => `name.ilike.%${c}%`)
          .join(',');
        const { data: matchedCats } = await extClient
          .from('categories')
          .select('id')
          .or(catOrFilter)
          .limit(50);

        if (matchedCats?.length) {
          const parentIds = matchedCats.map((c: any) => c.id);
          const { data: allCats } = await extClient
            .from('categories')
            .select('id, parent_id')
            .limit(1000);

          if (allCats) {
            const childMap = new Map<string, string[]>();
            for (const cat of allCats) {
              if (cat.parent_id) {
                const children = childMap.get(cat.parent_id) || [];
                children.push(cat.id);
                childMap.set(cat.parent_id, children);
              }
            }
            const queue = [...parentIds];
            const visited = new Set<string>(parentIds);
            while (queue.length > 0) {
              const current = queue.shift()!;
              const children = childMap.get(current) || [];
              for (const childId of children) {
                if (!visited.has(childId)) {
                  visited.add(childId);
                  queue.push(childId);
                }
              }
            }
            resolvedCategoryIds = [...visited];
          } else {
            resolvedCategoryIds = parentIds;
          }
          console.log('Category filter resolved', {
            inputCount: normalizedFilters.categoryFilters.length,
            resolvedCount: resolvedCategoryIds.length,
          });
        } else {
          console.warn('No categories matched filter', {
            inputCount: normalizedFilters.categoryFilters.length,
          });
        }
      }

      let resolvedSupplierIds: string[] = [];
      if (normalizedFilters.supplierFilters.length > 0) {
        const supOrFilter = normalizedFilters.supplierFilters
          .map((s) => `name.ilike.%${s}%`)
          .join(',');
        const { data: matchedSups } = await extClient
          .from('suppliers')
          .select('id')
          .or(supOrFilter)
          .limit(50);

        if (matchedSups?.length) {
          resolvedSupplierIds = matchedSups.map((s: any) => s.id);
          console.log('Supplier filter resolved', {
            inputCount: normalizedFilters.supplierFilters.length,
            resolvedCount: resolvedSupplierIds.length,
          });
        } else {
          console.warn('No suppliers matched filter', {
            inputCount: normalizedFilters.supplierFilters.length,
          });
        }
      }

      const { products: searchProducts, searchMethod } = await semanticProductSearch(
        extClient,
        expansion,
        fallbackTerms,
        PRODUCT_COLS,
        60,
      );
      semanticResults = searchProducts;
      console.log('Semantic search method', { searchMethod });

      let productsQuery = extClient.from('products').select(PRODUCT_COLS).eq('is_active', true);

      if (priceMin !== null && priceMin !== undefined)
        productsQuery = productsQuery.gte('sale_price', priceMin);
      if (priceMax !== null && priceMax !== undefined)
        productsQuery = productsQuery.lte('sale_price', priceMax);

      if (resolvedCategoryIds.length > 0) {
        productsQuery = productsQuery.in('category_id', resolvedCategoryIds);
      } else if (normalizedFilters.categoryFilters.length > 0) {
        productsQuery = productsQuery.eq('category_id', '00000000-0000-0000-0000-000000000000');
      }

      if (resolvedSupplierIds.length > 0) {
        productsQuery = productsQuery.in('supplier_id', resolvedSupplierIds);
      } else if (normalizedFilters.supplierFilters.length > 0) {
        productsQuery = productsQuery.eq('supplier_id', '00000000-0000-0000-0000-000000000000');
      }

      if (normalizedFilters.genderFilters.length === 1) {
        productsQuery = productsQuery.eq('gender', normalizedFilters.genderFilters[0]);
      } else if (normalizedFilters.genderFilters.length > 1) {
        productsQuery = productsQuery.in('gender', normalizedFilters.genderFilters);
      }

      if (normalizedFilters.onlyInStock) productsQuery = productsQuery.gt('stock_quantity', 0);
      if (normalizedFilters.onlyKit) productsQuery = productsQuery.eq('is_kit', true);

      const { data: products, error: productsError } = await productsQuery.limit(120);
      if (productsError) console.error('Error fetching products:', safeErrorFields(productsError));

      let categoryAssignProducts: any[] = [];
      if (resolvedCategoryIds.length > 0) {
        const { data: assignments } = await extClient
          .from('product_category_assignments')
          .select('product_id')
          .in('category_id', resolvedCategoryIds.slice(0, 100))
          .limit(200);

        if (assignments?.length) {
          const assignedIds = [...new Set(assignments.map((a: any) => a.product_id))];
          const existingIds = new Set((products || []).map((p: any) => p.id));
          const missingIds = assignedIds.filter((id) => !existingIds.has(id)).slice(0, 50);

          if (missingIds.length > 0) {
            const { data: extraProducts } = await extClient
              .from('products')
              .select(PRODUCT_COLS)
              .eq('is_active', true)
              .in('id', missingIds);
            if (extraProducts) categoryAssignProducts = extraProducts;
            console.log('N:N category assignments added products', {
              count: categoryAssignProducts.length,
            });
          }
        }
      }

      const allRawProducts = [
        ...(semanticResults || []),
        ...(products || []).filter((p: any) => !semanticResults.some((s: any) => s.id === p.id)),
        ...categoryAssignProducts.filter(
          (p: any) =>
            !semanticResults.some((s: any) => s.id === p.id) &&
            !(products || []).some((q: any) => q.id === p.id),
        ),
      ];

      let preFiltered = allRawProducts;
      if (resolvedCategoryIds.length > 0) {
        const catSet = new Set(resolvedCategoryIds);
        const assignedProductIds = new Set(categoryAssignProducts.map((p: any) => p.id));
        preFiltered = preFiltered.filter(
          (p: any) => catSet.has(p.category_id) || assignedProductIds.has(p.id),
        );
      }
      if (resolvedSupplierIds.length > 0) {
        const supSet = new Set(resolvedSupplierIds);
        preFiltered = preFiltered.filter((p: any) => supSet.has(p.supplier_id));
      }

      const filteredProducts = applyProductFilters(preFiltered, normalizedFilters);

      let finalProducts = filteredProducts;
      if (priceMin !== null && priceMin !== undefined) {
        finalProducts = finalProducts.filter((p: any) => (p.sale_price ?? 0) >= priceMin);
      }
      if (priceMax !== null && priceMax !== undefined) {
        finalProducts = finalProducts.filter((p: any) => (p.sale_price ?? 0) <= priceMax);
      }

      console.log('Total products after all filters', { count: finalProducts.length });

      const categoryIds = [
        ...new Set(finalProducts.map((p: any) => p.category_id).filter(Boolean)),
      ];
      const supplierIds = [
        ...new Set(finalProducts.map((p: any) => p.supplier_id).filter(Boolean)),
      ];

      let categoryMap: Record<string, string> = {};
      let supplierMap: Record<string, string> = {};

      const enrichPromises: Promise<void>[] = [];
      if (categoryIds.length > 0) {
        enrichPromises.push(
          (async () => {
            const { data } = await extClient
              .from('categories')
              .select('id, name')
              .in('id', categoryIds.slice(0, 50));
            if (data) categoryMap = Object.fromEntries(data.map((c: any) => [c.id, c.name]));
          })(),
        );
      }
      if (supplierIds.length > 0) {
        enrichPromises.push(
          (async () => {
            const { data } = await extClient
              .from('suppliers')
              .select('id, name')
              .in('id', supplierIds.slice(0, 50));
            if (data) supplierMap = Object.fromEntries(data.map((s: any) => [s.id, s.name]));
          })(),
        );
      }
      await Promise.all(enrichPromises);

      const scoredProducts = finalProducts.map((p: any) => ({
        ...p,
        _relevanceScore: scoreProductRelevance(p, expansion, categoryMap),
      }));

      scoredProducts.sort((a: any, b: any) => b._relevanceScore - a._relevanceScore);

      const buildProductDescription = (p: any): string => {
        const catName = categoryMap[p.category_id] || null;
        const supName = supplierMap[p.supplier_id] || null;
        const price = p.sale_price;
        const parts = [
          `ID: ${p.id}`,
          `Nome: ${p.name}`,
          p.sku ? `SKU: ${p.sku}` : null,
          catName ? `Categoria: ${catName}` : null,
          price ? `Preço: R$ ${Number(price).toFixed(2)}` : null,
          p.description ? `Descrição: ${p.description.substring(0, 150)}` : null,
          p.materials?.length
            ? `Materiais: ${Array.isArray(p.materials) ? p.materials.join(', ') : p.materials}`
            : null,
          p.brand ? `Marca: ${p.brand}` : null,
          supName ? `Fornecedor: ${supName}` : null,
          p.stock_quantity ? `Estoque: ${p.stock_quantity}` : null,
          p.primary_image_url ? `Imagem: ${p.primary_image_url}` : null,
          `Relevância: ${p._relevanceScore}`,
        ].filter(Boolean);
        return parts.join(' | ');
      };

      const semanticTop = scoredProducts.filter((p: any) => p._relevanceScore > 0).slice(0, 15);
      const generalPool = scoredProducts.filter((p: any) => p._relevanceScore === 0).slice(0, 15);

      if (semanticTop.length > 0) {
        productsContext = `
PRODUTOS ENCONTRADOS POR BUSCA SEMÂNTICA (ordenados por relevância — PRIORIZE estes):
Busca expandida: termos=${expansion.searchTerms.join(', ')} | sinônimos=${expansion.synonyms.join(', ')} | categorias=${expansion.categories.join(', ')} | materiais=${expansion.materials.join(', ')}

${semanticTop.map((p) => buildProductDescription(p)).join('\n\n')}
`;
      }

      if (generalPool.length > 0) {
        productsContext += `

OUTROS PRODUTOS DO CATÁLOGO (para contexto adicional):
${generalPool.map((p) => buildProductDescription(p)).join('\n\n')}
`;
      }
    } else {
      // fix: ssot-bypass — credential vault
      const EXT_URL2 = await getCredential('EXTERNAL_PROMOBRIND_URL');
      const EXT_KEY2 = await getCredential('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY');
      if (EXT_URL2 && EXT_KEY2) {
        const extClient = createClient(EXT_URL2, EXT_KEY2);
        let q = extClient
          .from('products')
          .select(
            'id, name, sku, sale_price, primary_image_url, category_id, description, brand, stock_quantity',
          )
          .eq('is_active', true);

        if (priceMin !== null && priceMin !== undefined) q = q.gte('sale_price', priceMin);
        if (priceMax !== null && priceMax !== undefined) q = q.lte('sale_price', priceMax);

        const { data: bgProducts } = await q.limit(30);
        if (bgProducts?.length) {
          productsContext = `
PRODUTOS DO CATÁLOGO (amostra geral):
${bgProducts.map((p: any) => `ID: ${p.id} | Nome: ${p.name} | SKU: ${p.sku} | Preço: R$ ${Number(p.sale_price || 0).toFixed(2)} | ${p.primary_image_url ? `Imagem: ${p.primary_image_url}` : ''}`).join('\n')}
`;
        }
      }
    }

    const filterParts: string[] = [];
    const pushValues = (label: string, values: string[]) => {
      if (values.length > 0) filterParts.push(`${label}: ${values.join(', ')}`);
    };

    pushValues('Categorias', normalizedFilters.categoryFilters);
    pushValues('Materiais', normalizedFilters.materialFilters);
    pushValues('Cores', normalizedFilters.colorFilters);
    pushValues('Gêneros', normalizedFilters.genderFilters);
    pushValues('Fornecedores', normalizedFilters.supplierFilters);
    pushValues('Técnicas', normalizedFilters.techniqueFilters);
    pushValues('Público-alvo', normalizedFilters.publicoFilters);
    pushValues('Datas comemorativas', normalizedFilters.dataComemorativaFilters);
    pushValues('Endomarketing', normalizedFilters.endomarketingFilters);
    pushValues('Nichos/segmentos', normalizedFilters.nichoFilters);
    pushValues('Tags', normalizedFilters.tagFilters);

    if (
      priceMin !== null &&
      priceMin !== undefined &&
      priceMax !== null &&
      priceMax !== undefined
    ) {
      filterParts.push(`Preço: R$ ${priceMin} - R$ ${priceMax}`);
    } else if (priceMin !== null && priceMin !== undefined) {
      filterParts.push(`Preço: acima de R$ ${priceMin}`);
    } else if (priceMax !== null && priceMax !== undefined) {
      filterParts.push(`Preço: até R$ ${priceMax}`);
    }

    if (normalizedFilters.onlyInStock) filterParts.push('Apenas em estoque');
    if (normalizedFilters.onlyNew) filterParts.push('Apenas novidades');
    if (normalizedFilters.onlyKit) filterParts.push('Apenas kits');
    if (normalizedFilters.onlyBestseller) filterParts.push('Priorizar mais vendidos');
    if (normalizedFilters.onlyFeatured) filterParts.push('Apenas destaques');
    if (normalizedFilters.hasPersonalization) filterParts.push('Com personalização');

    const filterInfo =
      filterParts.length > 0
        ? `\nFILTROS ATIVOS DO VENDEDOR: ${filterParts.join(', ')}\nIMPORTANTE: APENAS mostre produtos que atendam a TODOS os filtros. NÃO sugira produtos fora dos critérios. O vendedor já definiu esses filtros — NÃO pergunte novamente sobre faixa de preço ou critérios que já estão filtrados.`
        : '';

    if (productsContext) {
      productsContext = `
CATÁLOGO DE PRODUTOS (use o formato [[PRODUTO:id:nome:imageUrl]] para criar links clicáveis):${filterInfo}
${productsContext}`;
    }

    const sellerGreeting = sellerFirstName || 'parceiro';

    const systemPrompt = `Você é o FLOW, assistente pessoal de vendas da Promo Brindes. Você é um parceiro estratégico humano e próximo do vendedor.

NOME DO VENDEDOR: ${sellerGreeting}
REGRA OBRIGATÓRIA: Na PRIMEIRA mensagem de cada conversa, SEMPRE cumprimente o vendedor pelo primeiro nome de forma calorosa e natural. Exemplo: "${sellerGreeting}, ótima pergunta!" ou "E aí ${sellerGreeting}, vamos lá!" ou "Fala ${sellerGreeting}! Olha só o que encontrei...". Nas mensagens seguintes, use o nome ocasionalmente (não em todas) para manter naturalidade.

PERSONALIDADE E TOM:
- Você é como um colega experiente e animado — não um robô
- Use expressões naturais: "olha só", "cara", "show", "perfeito", "massa", "bora", "vamos nessa"
- Demonstre entusiasmo genuíno quando encontrar boas oportunidades
- Seja empático — reconheça frustrações ("sei que é chato ficar sem resposta...")
- Use emojis com moderação para dar calor humano (1-3 por mensagem)
- Evite linguagem corporativa engessada — seja profissional mas acessível
- Quando não souber algo, seja honesto: "Não tenho essa info aqui, mas sugiro..."

SEU PAPEL COMPLETO:
1. **Consultor de Produtos** — Conhece profundamente o catálogo e faz recomendações personalizadas
2. **Analista de CRM** — Interpreta dados do cliente para gerar insights
3. **Gerador de Propostas** — Sugere composições de orçamento com produtos, quantidades e argumentos de venda
4. **Estrategista de Follow-up** — Identifica oportunidades de retomada
5. **Detector de Oportunidades** — Identifica cross-sell, upsell, sazonalidade

BUSCA SEMÂNTICA INTELIGENTE:
Os produtos listados abaixo foram encontrados usando busca semântica com expansão de query por IA.
Os produtos no topo (maior relevância) são os que MELHOR correspondem à intenção do vendedor.
PRIORIZE FORTEMENTE os produtos com maior score de relevância.
${expansion.intent !== 'general' ? `INTENÇÃO DETECTADA: ${expansion.intent}` : ''}
${expansion.searchTerms.length > 0 ? `CONCEITOS SEMÂNTICOS IDENTIFICADOS: ${[...expansion.searchTerms, ...expansion.synonyms].join(', ')}` : ''}

FORMATO DE LINKS DE PRODUTOS (OBRIGATÓRIO):
[[PRODUTO:id_do_produto:Nome do Produto:url_da_imagem]]
Se não houver imagem: [[PRODUTO:id_do_produto:Nome do Produto]]
REGRA CRÍTICA: SEMPRE que mencionar um produto, use o formato [[PRODUTO:...]] com o ID real do banco de dados.

DIRETRIZES DE COMPORTAMENTO:
1. Seja proativo — não espere perguntas, ofereça insights
2. Sempre explique o PORQUÊ de cada recomendação
3. Use dados concretos (ticket médio, taxa de conversão, histórico)
4. Seja conciso mas estratégico
5. Linguagem profissional e acessível (português brasileiro informal)
6. SEMPRE use [[PRODUTO:id:nome:imageUrl]] ao mencionar produtos — NUNCA mencione produtos sem link
7. Quando gerar propostas, organize em formato de tabela quando possível
8. REGRA DE FILTROS: Se filtros já estão ativos, NÃO pergunte sobre eles novamente
9. Limite suas recomendações a 3-5 produtos bem selecionados

${clientContext}
${productsContext}

IMPORTANTE: Você tem acesso completo aos dados do cliente em tempo real — CRM, orçamentos, pedidos, follow-ups e análise comportamental. Seu objetivo é ajudar o vendedor ${sellerGreeting} a fechar mais negócios com mais inteligência.`;

    const apiMessages: Message[] = [{ role: 'system', content: systemPrompt }, ...messages];

    console.log('Calling Lovable AI', {
      messageCount: apiMessages.length,
      systemPromptLength: systemPrompt.length,
    });

    const response = await callAiWithTracking({
      userId,
      functionName: 'expert-chat',
      model: 'google/gemini-2.5-flash',
      apiKey: LOVABLE_API_KEY,
      stream: true,
      requestBody: { messages: apiMessages },
    });

    if (!response.ok) {
      await response.text();
      console.error('AI Gateway error:', { status: response.status });

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Aguarde alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos na workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return new Response(
        JSON.stringify({ error: 'Limite mensal de IA atingido. Contate o administrador.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if ((error as any)?.status === 401 || (error as any)?.status === 403) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error('Expert chat error:', safeErrorFields(error));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
