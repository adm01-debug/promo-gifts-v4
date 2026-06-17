/**
 * Resolve TODAS as variantes de cor que correspondem aos filtros ativos.
 * Usado pelo mini-carrossel de variantes no ProductCard quando múltiplas cores são filtradas.
 */
import { COLOR_GROUP_HEX } from './color-group-hex';
import type { ActiveColorFilter } from './color-image-resolver';

export interface MatchedColorVariant {
  /** Nome da variante (ex: "Azul Royal", "Rosa Bebê") */
  name: string;
  /** Hex code da cor */
  hex: string;
  /** URL da imagem específica da variante (se disponível) */
  image?: string;
  /** Slug do grupo de cor */
  groupSlug?: string;
  /** Slug da variação de cor */
  variationSlug?: string;
}

/**
 * Retorna TODAS as variantes de um produto que fazem match com os filtros de cor ativos.
 * Diferente de resolveHighlightHex (que retorna a primeira), esta retorna um array completo.
 */
export function resolveAllMatchingColors(
  productColors: Array<{
    name?: string;
    hex?: string;
    group?: string;
    groupSlug?: string;
    variationSlug?: string;
    image?: string;
    images?: string[];
  }>,
  activeColorFilter?: ActiveColorFilter | null,
): MatchedColorVariant[] {
  if (!activeColorFilter) return [];
  if (!activeColorFilter.groups.length && !activeColorFilter.variations.length) return [];
  if (!productColors?.length) {
    // Fallback: return group hex for each filtered group even without product colors
    const fallbacks: MatchedColorVariant[] = [];
    for (const g of activeColorFilter.groups) {
      if (COLOR_GROUP_HEX[g]) {
        fallbacks.push({
          name: g.charAt(0).toUpperCase() + g.slice(1),
          hex: COLOR_GROUP_HEX[g],
          groupSlug: g,
        });
      }
    }
    return fallbacks;
  }

  const seen = new Set<string>();
  const results: MatchedColorVariant[] = [];

  const addMatch = (color: (typeof productColors)[0], slug: string) => {
    // Dedup by name+hex (not slug) to avoid duplicates when group and variation point to same color
    const dedupKey = `${color.name || ''}|${color.hex || ''}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);
    results.push({
      name: color.name || slug,
      hex: color.hex || COLOR_GROUP_HEX[slug] || '#888',
      image: color.images?.[0] || color.image,
      groupSlug: color.groupSlug,
      variationSlug: color.variationSlug,
    });
  };

  // Match by group slugs
  for (const groupSlug of activeColorFilter.groups) {
    const matches = productColors.filter((c) => {
      if (c.groupSlug === groupSlug) return true;
      const g = (c.group || '').toLowerCase().trim();
      const s = groupSlug.toLowerCase().trim();
      return g === s || g.includes(s) || s.includes(g);
    });
    if (matches.length > 0) {
      // Add the first match per group (most representative)
      addMatch(matches[0], groupSlug);
    } else if (COLOR_GROUP_HEX[groupSlug]) {
      // No color data match but we know this group
      const key = `${groupSlug}|fallback`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          name: groupSlug.charAt(0).toUpperCase() + groupSlug.slice(1),
          hex: COLOR_GROUP_HEX[groupSlug],
          groupSlug,
        });
      }
    }
  }

  // Match by variation slugs
  for (const varSlug of activeColorFilter.variations) {
    const match = productColors.find((c) => c.variationSlug === varSlug);
    if (match) {
      addMatch(match, varSlug);
    }
  }

  return results;
}
