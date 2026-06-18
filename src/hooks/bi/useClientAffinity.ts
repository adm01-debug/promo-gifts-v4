/**
 * useClientAffinity — produtos reais já orçados pelo cliente + sugestões similares.
 * Estratégia: usa quote_items via RPC get_client_top_products (proxy de "interesse confirmado").
 * Quando vazio → fallback mock determinístico por ramo.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MOCK_CLIENT_STATS } from '@/lib/bi/mockData';

export interface ClientTopProduct {
  product_id: string | null;
  product_name: string;
  product_image_url: string | null;
  total_quantity: number;
  occurrences: number;
  total_revenue: number;
  avg_unit_price: number;
  last_quoted_at: string | null;
}

export interface AffinityCategory {
  category: string;
  count: number;
  revenue: number;
  suggestions: Array<{
    name: string;
    priceFrom: number;
    priceTo: number;
    reason: string;
    imageUrl?: string | null;
    productId?: string | null;
  }>;
}

export interface ClientAffinityResult {
  isMock: boolean;
  realProductsCount: number;
  categories: AffinityCategory[];
  topProducts: ClientTopProduct[];
}

const MOCK_SUGGESTIONS: Record<string, AffinityCategory['suggestions']> = {
  'Garrafas e Squeezes': [
    {
      name: 'Garrafa Térmica Inox 750ml',
      priceFrom: 45,
      priceTo: 95,
      reason: 'Upgrade da linha que ele já compra',
    },
    {
      name: 'Squeeze Esportivo Premium',
      priceFrom: 22,
      priceTo: 48,
      reason: 'Categoria favorita do cliente',
    },
    {
      name: 'Garrafa Vidro com Capa Silicone',
      priceFrom: 30,
      priceTo: 65,
      reason: 'Novidade na categoria preferida',
    },
  ],
  'Canetas Premium': [
    {
      name: 'Caneta Roller Premium',
      priceFrom: 28,
      priceTo: 75,
      reason: 'Próximo nível em canetas executivas',
    },
    {
      name: 'Kit Caneta + Lapiseira',
      priceFrom: 45,
      priceTo: 120,
      reason: 'Bundle dentro da categoria forte',
    },
    { name: 'Caneta Bambu Sustentável', priceFrom: 12, priceTo: 30, reason: 'Alternativa ESG' },
  ],
  'Mochilas e Bolsas': [
    {
      name: 'Mochila Antifurto Premium',
      priceFrom: 95,
      priceTo: 220,
      reason: 'Upgrade da linha mochilas',
    },
    { name: 'Bolsa Térmica Executiva', priceFrom: 55, priceTo: 130, reason: 'Complemento natural' },
    { name: 'Sling Bag Compacta', priceFrom: 38, priceTo: 90, reason: 'Tendência atual' },
  ],
  Agendas: [
    {
      name: 'Agenda Permanente Couro',
      priceFrom: 60,
      priceTo: 150,
      reason: 'Linha premium da categoria',
    },
    { name: 'Planner Mensal A4', priceFrom: 25, priceTo: 65, reason: 'Variação útil' },
  ],
  'Brindes Tecnológicos': [
    { name: 'Carregador Wireless 15W', priceFrom: 40, priceTo: 110, reason: 'Tech atualizado' },
    { name: 'Caixa de Som Bluetooth', priceFrom: 60, priceTo: 180, reason: 'Categoria em alta' },
  ],
};

/**
 * Agrupa top produtos reais em "categorias" derivadas do nome do produto.
 * Heurística simples: primeira palavra significativa.
 */
function deriveCategoryFromName(name: string): string {
  const lower = name.toLowerCase();
  if (/garrafa|squeeze|t[eé]rmic/.test(lower)) return 'Garrafas e Squeezes';
  if (/caneta|lapiseira|roller/.test(lower)) return 'Canetas Premium';
  if (/mochila|bolsa|sling/.test(lower)) return 'Mochilas e Bolsas';
  if (/agenda|planner|caderno/.test(lower)) return 'Agendas';
  if (/power\s*bank|carregador|wireless|bluetooth|fone/.test(lower)) return 'Brindes Tecnológicos';
  if (/bloco|notas/.test(lower)) return 'Blocos e Notas';
  if (/camis|polo|jaqueta|moletom/.test(lower)) return 'Vestuário';
  if (/kit/.test(lower)) return 'Kits';
  return 'Outros';
}

export function useClientAffinity(clientId?: string) {
  return useQuery<ClientAffinityResult>({
    queryKey: ['bi-client-affinity-v2', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) {
        return { isMock: true, realProductsCount: 0, categories: [], topProducts: [] };
      }

      // 1) Tenta dados reais via RPC
      const { data: rpcData, error } = await supabase.rpc('get_client_top_products', {
        _client_id: clientId,
        _limit: 15,
      });

      const realProducts = (!error && Array.isArray(rpcData) ? rpcData : []) as ClientTopProduct[];

      if (realProducts.length > 0) {
        // Agrupa por categoria derivada
        const byCategory = new Map<
          string,
          { count: number; revenue: number; products: ClientTopProduct[] }
        >();
        for (const p of realProducts) {
          const cat = deriveCategoryFromName(p.product_name);
          const cur = byCategory.get(cat) ?? { count: 0, revenue: 0, products: [] };
          cur.count += Number(p.occurrences) || 0;
          cur.revenue += Number(p.total_revenue) || 0;
          cur.products.push(p);
          byCategory.set(cat, cur);
        }

        const categories: AffinityCategory[] = [...byCategory.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 4)
          .map(([category, agg]) => ({
            category,
            count: agg.count,
            revenue: agg.revenue,
            suggestions: agg.products.slice(0, 3).map((p) => ({
              name: p.product_name,
              priceFrom: Math.round(Number(p.avg_unit_price) * 0.85) || 0,
              priceTo: Math.round(Number(p.avg_unit_price) * 1.25) || 0,
              reason: `Cliente já comprou ${p.occurrences}x · ${p.total_quantity} unidades`,
              imageUrl: p.product_image_url,
              productId: p.product_id,
            })),
          }));

        return {
          isMock: false,
          realProductsCount: realProducts.length,
          categories,
          topProducts: realProducts,
        };
      }

      // 2) Fallback mock
      const mockCategories: AffinityCategory[] = MOCK_CLIENT_STATS.topCategories.map((c) => ({
        ...c,
        suggestions: MOCK_SUGGESTIONS[c.category] ?? [],
      }));
      return { isMock: true, realProductsCount: 0, categories: mockCategories, topProducts: [] };
    },
    staleTime: 5 * 60 * 1000,
  });
}
