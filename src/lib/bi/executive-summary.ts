/**
 * executive-summary — helpers de agregação para o dossiê executivo.
 *
 * `buildCategorySection` produz a estrutura "Mapa de Categorias" usada
 * no PDF e no PPTX: top categorias do cliente, top do setor, GAPs
 * prioritários (forte no setor / fraco no cliente) e insight textual.
 */
import type {
  ClientCategoryAffinityResult,
  CategoryAggregate,
} from '@/hooks/bi/useClientCategoryAffinity';
import type {
  IndustryCategoryTrendsResult,
  IndustryCategoryAggregate,
} from '@/hooks/bi/useIndustryCategoryTrends';

export interface CategoryMapRow {
  label: string;
  clientSharePct: number;
  industrySharePct: number;
  trend: 'down' | 'n/a' | 'stable' | 'up';
  deltaPct: number | null;
}

export interface CategoryGap {
  label: string;
  industrySharePct: number;
  reason: string;
}

export interface CategorySection {
  hasData: boolean;
  isMock: boolean;
  rows: CategoryMapRow[];
  gaps: CategoryGap[];
  insight: string;
  favoriteLabel: string | null;
  topGapLabel: string | null;
}

const GAP_MIN_INDUSTRY_SHARE = 8; // % no setor para considerar relevante
const STRONG_CLIENT_SHARE = 5; // % do cliente para "ter"

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function buildCategorySection(
  catAffinity: ClientCategoryAffinityResult | null | undefined,
  catIndustry: IndustryCategoryTrendsResult | null | undefined,
): CategorySection {
  const clientCats: CategoryAggregate[] = catAffinity?.categories ?? [];
  const industryCats: IndustryCategoryAggregate[] = catIndustry?.categories ?? [];

  const clientBySlug = new Map<string, CategoryAggregate>(clientCats.map((c) => [c.slug, c]));
  const industryBySlug = new Map<string, IndustryCategoryAggregate>(
    industryCats.map((c) => [c.slug, c]),
  );

  // União de slugs, priorizando ordem do cliente
  const seen = new Set<string>();
  const orderedSlugs: string[] = [];
  for (const c of clientCats) {
    if (!seen.has(c.slug)) {
      seen.add(c.slug);
      orderedSlugs.push(c.slug);
    }
  }
  for (const c of industryCats) {
    if (!seen.has(c.slug)) {
      seen.add(c.slug);
      orderedSlugs.push(c.slug);
    }
  }

  const rows: CategoryMapRow[] = orderedSlugs.slice(0, 8).map((slug) => {
    const c = clientBySlug.get(slug);
    const i = industryBySlug.get(slug);
    return {
      label: c?.label ?? i?.label ?? slug,
      clientSharePct: clampPct(c?.revenueSharePct ?? 0),
      industrySharePct: clampPct(i?.revenueSharePct ?? 0),
      trend: c?.trend ?? 'n/a',
      deltaPct: c?.deltaPct ?? null,
    };
  });

  // GAPs: forte no setor (≥8%) e fraco no cliente (<5%)
  const gaps: CategoryGap[] = industryCats
    .filter((i) => i.revenueSharePct >= GAP_MIN_INDUSTRY_SHARE)
    .filter((i) => {
      const c = clientBySlug.get(i.slug);
      return !c || c.revenueSharePct < STRONG_CLIENT_SHARE;
    })
    .slice(0, 4)
    .map((i) => ({
      label: i.label,
      industrySharePct: clampPct(i.revenueSharePct),
      reason: `${i.revenueSharePct.toFixed(0)}% da receita do setor — cliente ainda não compra de forma relevante.`,
    }));

  const favorite = catAffinity?.favorite ?? clientCats[0] ?? null;
  const favoriteLabel = favorite?.label ?? null;
  const favoriteRevenueSharePct = favorite?.revenueSharePct ?? 0;
  const topGapLabel = gaps[0]?.label ?? null;

  let insight = 'Sem dados suficientes para mapa de categorias.';
  if (favoriteLabel && topGapLabel) {
    insight = `Cliente tem afinidade forte em "${favoriteLabel}" (${favoriteRevenueSharePct.toFixed(0)}% da receita). Oportunidade clara: introduzir "${topGapLabel}" — categoria que move ${gaps[0].industrySharePct.toFixed(0)}% do setor e ainda não está no mix.`;
  } else if (favoriteLabel) {
    insight = `Cliente concentrado em "${favoriteLabel}" (${favoriteRevenueSharePct.toFixed(0)}% da receita). Mix do setor sem GAPs relevantes para sugerir agora.`;
  } else if (topGapLabel) {
    insight = `Sem histórico relevante do cliente. Categoria líder do setor: "${topGapLabel}" (${gaps[0].industrySharePct.toFixed(0)}%) — bom ponto de partida para prospecção.`;
  }

  const hasData = rows.length > 0 || gaps.length > 0;
  const isMock = !!catAffinity?.isMock || !!catIndustry?.isMock;

  return { hasData, isMock, rows, gaps, insight, favoriteLabel, topGapLabel };
}
