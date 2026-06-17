import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';
import { untypedFrom } from '@/lib/supabase-untyped';
import { logger } from '@/lib/logger';

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

// Migrated from supabase.functions.invoke('external-db-bridge') to dbInvoke
// (2026-05-30) — uses REST native PostgREST path, zero Edge Function calls.
async function fetchExternalColors() {
  const groupsResult = await dbInvoke<Record<string, string>>({
    table: 'color_groups',
    operation: 'select',
    filters: { is_active: true },
    orderBy: { column: 'sort_order', ascending: true },
  });
  const groups = groupsResult.records ?? [];

  const variationsResult = await dbInvoke<Record<string, string>>({
    table: 'color_variations',
    operation: 'select',
    filters: { is_active: true },
    orderBy: { column: 'sort_order', ascending: true },
  });
  const variations = variationsResult.records ?? [];

  const groupsWithVariations: ColorGroup[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    slug: group.slug || group.name.toLowerCase().replace(/\s+/g, '-'),
    hex_code: group.hex_code,
    internal_code: group.internal_code,
    variations: variations
      .filter((v) => v.group_id === group.id)
      .map((v) => ({
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

export function useColorSystem() {
  return useQuery<ColorFilters>({
    queryKey: ['color-system-external'],
    queryFn: async () => {
      const groups = await fetchExternalColors();

      const { data: nuances, error: nuancesError } = await untypedFrom('color_nuances')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('sort_order');

      if (nuancesError) {
        logger.warn('Nuances nao encontradas localmente:', nuancesError);
      }

      return {
        groups,
        nuances: (nuances ?? []) as ColorNuance[],
      } satisfies ColorFilters;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

export function findGroupBySlug(groups: ColorGroup[], slug: string): ColorGroup | undefined {
  return groups.find((g) => g.slug === slug);
}

export function findVariationBySlug(group: ColorGroup, slug: string): ColorVariation | undefined {
  return group.variations.find((v) => v.slug === slug);
}

export function formatColorName(variationName: string, nuanceName?: string): string {
  if (nuanceName) return `${variationName} ${nuanceName}`;
  return variationName;
}

export function isLightColor(hexCode: string | null): boolean {
  if (!hexCode) return true;
  const hex = hexCode.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}
