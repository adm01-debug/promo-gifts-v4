/**
 * useSimilarKits — encontra até N templates do sistema com >=overlap% de SKUs
 * em comum com o kit atual. Útil como widget de inspiração no Builder.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TemplateRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  tag: string | null;
  total_price: number;
  cover_image_url: string | null;
  items_data: unknown;
  usage_count: number;
}

interface Options {
  currentSkus: string[];
  limit?: number;
  minOverlapRatio?: number; // 0..1
  excludeId?: string;
}

function extractSkus(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => {
      const r = i as Record<string, unknown>;
      const sku = (r?.sku ?? r?.product_sku ?? r?.code) as string | undefined;
      return sku ? String(sku).trim().toLowerCase() : '';
    })
    .filter(Boolean);
}

export function useSimilarKits({
  currentSkus,
  limit = 3,
  minOverlapRatio = 0.3,
  excludeId,
}: Options) {
  const skuKey = currentSkus.slice().sort().join('|');

  return useQuery({
    queryKey: ['similar-kits', skuKey, limit, minOverlapRatio, excludeId ?? null],
    enabled: currentSkus.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kit_templates')
        .select('id, name, color, icon, tag, total_price, cover_image_url, items_data, usage_count')
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .limit(50);
      if (error) throw error;

      const set = new Set(currentSkus.map((s) => s.toLowerCase()));
      const ranked = ((data ?? []) as TemplateRow[])
        .filter((t) => t.id !== excludeId)
        .map((t) => {
          const skus = extractSkus(t.items_data);
          if (skus.length === 0) return null;
          const overlap = skus.filter((s) => set.has(s)).length;
          const ratio = overlap / Math.max(skus.length, 1);
          return { template: t, overlap, ratio };
        })
        .filter((x): x is { template: TemplateRow; overlap: number; ratio: number } =>
          !!x && x.ratio >= minOverlapRatio,
        )
        .sort((a, b) => b.ratio - a.ratio || b.overlap - a.overlap)
        .slice(0, limit);

      return ranked;
    },
  });
}
