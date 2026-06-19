import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { logger } from '@/lib/logger';
// Tipos baseados nas respostas das RPCs
export interface CommemorativeDate {
  id: string;
  name: string;
  slug: string;
  date_day: number | null;
  date_month: number | null;
  formatted_date?: string;
  category: string;
  icon_name: string | null;
  color_hex: string | null;
  days_until: number | null;
  campaign_start_days: number;
  is_featured: boolean;
  color_count?: number;
  product_count?: number;
}

export interface CommemorativeDateWithColors extends CommemorativeDate {
  associated_colors: Array<{
    color_group_id: string;
    color_name: string;
    color_hex: string;
    is_primary: boolean;
  }>;
  exclusion_count: number;
}

export interface CommemorativeDateVariant {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  variant_id: string;
  variant_name: string | null;
  variant_sku: string | null;
  color_name: string | null;
  color_hex: string | null;
  color_group_id: string | null;
  color_group_name: string | null;
  is_primary_color: boolean;
  price_1: number | null;
  image_url: string | null;
}

// Helper para chamar a edge function
async function callCommemorativeDatesAPI<T>(
  action: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase.functions.invoke('commemorative-dates', {
    body: { action, params },
  });

  if (error) {
    logger.error(`Error calling commemorative-dates/${action}:`, error);
    throw new Error(error.message || 'Erro ao buscar datas comemorativas');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Erro desconhecido');
  }

  return data.data as T;
}

/**
 * Hook para buscar datas comemorativas ATIVAS (no período de campanha)
 * Use este hook para o filtro no catálogo - só mostra datas próximas
 */
export function useActiveCommemorativeDates() {
  return useQuery({
    queryKey: ['commemorative-dates', 'active'],
    queryFn: () => callCommemorativeDatesAPI<CommemorativeDate[]>('get_active_dates'),
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para buscar próximas datas comemorativas (para dashboard/planejamento)
 * @param daysAhead - Número de dias à frente para buscar (padrão: 60)
 */
export function useUpcomingCommemorativeDates(daysAhead = 60) {
  return useQuery({
    queryKey: ['commemorative-dates', 'upcoming', daysAhead],
    queryFn: () =>
      callCommemorativeDatesAPI<CommemorativeDate[]>('get_upcoming_dates', {
        days_ahead: daysAhead,
      }),
    staleTime: 1000 * 60 * 10, // 10 minutos
    gcTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar todas as datas com suas cores associadas
 * Use para admin/listagem completa
 */
export function useCommemorativeDatesWithColors() {
  return useQuery({
    queryKey: ['commemorative-dates', 'with-colors'],
    queryFn: () =>
      callCommemorativeDatesAPI<CommemorativeDateWithColors[]>('get_dates_with_colors'),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

/**
 * Hook para buscar variantes/produtos de uma data comemorativa específica
 * @param slug - Slug da data comemorativa (ex: "dia-maes")
 * @param limit - Limite de resultados (padrão: 100)
 * @param includeAllColors - Se true, ignora filtro de cor
 */
export function useProductsByCommemorativeDate(
  slug: string | null,
  limit = 100,
  includeAllColors = false,
) {
  return useQuery({
    queryKey: ['commemorative-dates', 'products', slug, limit, includeAllColors],
    queryFn: () =>
      callCommemorativeDatesAPI<CommemorativeDateVariant[]>('get_products_by_date', {
        slug,
        limit,
        include_all_colors: includeAllColors,
      }),
    enabled: !!slug,
    staleTime: 1000 * 60 * 2, // 2 minutos
    gcTime: 1000 * 60 * 15, // 15 minutos
  });
}

/**
 * Hook para obter os slugs dos grupos de cores associados a uma data
 * Útil para integrar com o sistema de filtros de cores existente
 */
export function useCommemorativeDateColorGroups(dateSlug: string | null) {
  const { data: datesWithColors } = useCommemorativeDatesWithColors();

  if (!dateSlug || !datesWithColors) {
    return { colorGroupIds: [], colorGroupSlugs: [], primaryColor: null };
  }

  const date = datesWithColors.find((d) => d.slug === dateSlug);

  if (!date?.associated_colors?.length) {
    return { colorGroupIds: [], colorGroupSlugs: [], primaryColor: null };
  }

  const colorGroupIds = date.associated_colors.map((c) => c.color_group_id);
  const primaryColor =
    date.associated_colors.find((c) => c.is_primary) || date.associated_colors[0];

  return {
    colorGroupIds,
    colorGroupSlugs: [], // Precisaria de outra query para mapear IDs para slugs
    primaryColor: primaryColor
      ? { name: primaryColor.color_name, hex: primaryColor.color_hex }
      : null,
  };
}
