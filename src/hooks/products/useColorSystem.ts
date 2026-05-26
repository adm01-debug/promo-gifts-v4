import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// =====================================================
// TIPOS DO SISTEMA DE CORES (3 Níveis)
// =====================================================

export interface ColorGroup {
  id: string;
  name: string;
  slug: string;
  hex_code: string | null;
  internal_code: string | null;
  variations: ColorVariation[];
}

export interface ColorVariation {
  id: string;
  name: string;
  slug: string;
  hex_code: string | null;
  internal_code: string | null;
  group_id: string;
}

export interface ColorNuance {
  id: string;
  name: string;
  slug: string;
}

export interface ColorFilters {
  groups: ColorGroup[];
  nuances: ColorNuance[];
}

// =====================================================
// HELPER - Busca dados do banco externo Promobrind
// =====================================================

async function fetchExternalColors() {
  // Buscar grupos de cores
  const groupsResponse = await supabase.functions.invoke('external-db-bridge', {
    body: {
      table: 'color_groups',
      operation: 'select',
      filters: { is_active: true },
      orderBy: { column: 'sort_order', ascending: true },
      countMode: 'none',
    },
  });

  if (groupsResponse.error) {
    throw new Error(`Erro ao buscar grupos de cores: ${groupsResponse.error.message}`);
  }

  // Resposta vem em data.data.records
  const groups: Record<string, string>[] = groupsResponse.data?.data?.records || [];

  // Buscar variações de cores
  const variationsResponse = await supabase.functions.invoke('external-db-bridge', {
    body: {
      table: 'color_variations',
      operation: 'select',
      filters: { is_active: true },
      orderBy: { column: 'sort_order', ascending: true },
      countMode: 'none',
    },
  });

  if (variationsResponse.error) {
    throw new Error(`Erro ao buscar variações de cores: ${variationsResponse.error.message}`);
  }

  const variations: Record<string, string>[] = variationsResponse.data?.data?.records || [];

  // Mapear variações para seus grupos
  const groupsWithVariations: ColorGroup[] = groups.map((group: Record<string, string>) => ({
    id: group.id,
    name: group.name,
    slug: group.slug || group.name.toLowerCase().replace(/\s+/g, '-'),
    hex_code: group.hex_code,
    internal_code: group.internal_code,
    variations: variations
      .filter((v: Record<string, string>) => v.group_id === group.id)
      .map((v: Record<string, string>) => ({
        id: v.id,
        name: v.name,
        slug: v.slug || v.name.toLowerCase().replace(/\s+/g, '-'),
        hex_code: v.hex_code,
        internal_code: v.internal_code,
        group_id: v.group_id,
      })),
  }));

  return groupsWithVariations;
}

// =====================================================
// HOOK PRINCIPAL - Carrega toda a hierarquia de cores do Promobrind
// =====================================================

export function useColorSystem() {
  return useQuery<ColorFilters>({
    queryKey: ['color-system-external'],
    queryFn: async () => {
      const groups = await fetchExternalColors();

      // Nuances são mantidas localmente (acabamentos como Fosco, Brilhante, etc.)
      const { data: nuances, error: nuancesError } = await supabase
        .from('color_nuances')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('sort_order');

      if (nuancesError) {
        logger.warn('Nuances não encontradas localmente:', nuancesError);
      }

      return {
        groups,
        nuances: (nuances || []) as ColorNuance[],
      } satisfies ColorFilters;
    },
    staleTime: 60 * 60 * 1000, // 1 hora
    gcTime: 24 * 60 * 60 * 1000, // 24 horas
  });
}

// =====================================================
// UTILITÁRIOS
// =====================================================

/**
 * Encontra um grupo pelo slug
 */
export function findGroupBySlug(groups: ColorGroup[], slug: string): ColorGroup | undefined {
  return groups.find((g) => g.slug === slug);
}

/**
 * Encontra uma variação pelo slug dentro de um grupo
 */
export function findVariationBySlug(group: ColorGroup, slug: string): ColorVariation | undefined {
  return group.variations.find((v) => v.slug === slug);
}

/**
 * Formata o nome completo da cor (variação + nuance)
 */
export function formatColorName(variationName: string, nuanceName?: string): string {
  if (nuanceName) {
    return `${variationName} ${nuanceName}`;
  }
  return variationName;
}

/**
 * Verifica se uma cor é clara (para decidir cor do texto)
 */
export function isLightColor(hexCode: string | null): boolean {
  if (!hexCode) return true;

  const hex = hexCode.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Fórmula de luminosidade
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}
