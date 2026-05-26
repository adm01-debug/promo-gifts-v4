/**
 * Mapa de slugs de grupo de cor → hex representativo.
 * Usado para aplicar brilho dinâmico nos cards/lista/tabela quando um filtro de cor está ativo.
 */
export const COLOR_GROUP_HEX: Record<string, string> = {
  rosa: '#E91E8C',
  roxo: '#8B5CF6',
  azul: '#3B82F6',
  verde: '#22C55E',
  vermelho: '#EF4444',
  amarelo: '#EAB308',
  laranja: '#F97316',
  marrom: '#92400E',
  preto: '#1a1a1a',
  branco: '#E5E7EB',
  cinza: '#6B7280',
  bege: '#D2B48C',
  dourado: '#D4A017',
  prata: '#A8A9AD',
  nude: '#E8C4A0',
  lilás: '#C084FC',
  vinho: '#722F37',
  coral: '#FF6B6B',
  turquesa: '#06B6D4',
  creme: '#FFFDD0',
};

/**
 * Resolve a cor hex do destaque com base nos filtros ativos e cores do produto.
 */
export function resolveHighlightHex(
  productColors: Array<{
    hex?: string;
    group?: string;
    groupSlug?: string;
    variationSlug?: string;
  }>,
  activeColorFilter?: { groups: string[]; variations: string[] } | null,
  highlightColors?: string[],
): string | null {
  if (activeColorFilter) {
    if (activeColorFilter.groups.length > 0) {
      const match = productColors.find((c) => activeColorFilter.groups.includes(c.groupSlug || ''));
      if (match?.hex) return match.hex;
      const groupKey = activeColorFilter.groups.find((g) => COLOR_GROUP_HEX[g]);
      if (groupKey) return COLOR_GROUP_HEX[groupKey];
    }
    if (activeColorFilter.variations.length > 0) {
      const match = productColors.find((c) =>
        activeColorFilter.variations.includes(c.variationSlug || ''),
      );
      if (match?.hex) return match.hex;
    }
  }
  if (highlightColors?.length) {
    const match = productColors.find((c) => highlightColors.includes(c.group || ''));
    if (match?.hex) return match.hex;
  }
  return null;
}
