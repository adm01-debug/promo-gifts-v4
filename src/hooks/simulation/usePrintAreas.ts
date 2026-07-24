/**
 * Hooks: Areas de Gravacao (Print Areas)
 *
 * FONTE UNICA: tabela 'print_area_techniques' no BD local (Supabase PostgREST).
 * Tecnicas resolvidas via lookup em 'tabela_preco_gravacao_oficial'.
 *
 * BUG-14 FIX: substituidas todas as chamadas a external-db-bridge por PostgREST
 * nativo. print_area_techniques, tabela_preco_gravacao_oficial e tecnicas_gravacao
 * sao tabelas LOCAIS do Supabase. Apos o merge do Caminho B
 * (PRs #230-232), o external-db-bridge foi deprecated para tabelas locais.
 *
 * NOTA (auditoria 2026-05-31): `tecnicas_gravacao` e o nome real da tabela local
 * (era `tecnica_gravacao`, inexistente -> corrigido). Ja `v_technique_stats` NAO
 * existe no banco interno (e view do BD externo/bridge) — ver useTechniqueStats().
 */
import { useQuery } from '@tanstack/react-query';
import { untypedFrom } from '@/lib/supabase-untyped';
import type { PrintAreaWithTechniques, TecnicaGravacao, AreaShape } from '@/types/gravacao';
import { logger } from '@/lib/logger';
import {
  adaptPrintAreaTechniqueRows,
  adaptTabelaPrecoRows,
  adaptTecnicaRows,
  type PrintAreaTechniqueCanonical,
  type TabelaPrecoCanonical,
} from '@/lib/personalization/adapters';

/**
 * Busca areas de gravacao de um produto via print_area_techniques (PostgREST nativo).
 * BUG-14 FIX: era via external-db-bridge. Substituido por supabase.from().
 */
async function fetchProductPrintAreas(productId: string): Promise<PrintAreaTechniqueCanonical[]> {
  try {
    const { data, error } = await untypedFrom('print_area_techniques')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('technique_order', { ascending: true })
      .limit(50);

    if (error) {
      logger.warn('[usePrintAreas] Erro ao buscar print_area_techniques:', error.message);
      return [];
    }
    return adaptPrintAreaTechniqueRows(data || []);
  } catch (err) {
    logger.warn('[usePrintAreas] Excecao ao buscar areas:', err);
    return [];
  }
}

/**
 * Hook: Busca areas de gravacao de um produto com tecnicas resolvidas
 */
export function usePrintAreas(productId: string | null) {
  return useQuery({
    queryKey: ['print-areas', productId],
    queryFn: async (): Promise<PrintAreaWithTechniques[]> => {
      if (!productId) return [];

      const areas = await fetchProductPrintAreas(productId);
      if (!areas.length) return [];

      const priceTableIds = new Set<string>();
      for (const area of areas) {
        const id = area.price_table_id ?? area.tabela_preco_id;
        if (id) priceTableIds.add(id);
      }

      // BUG-14 FIX: PostgREST nativo para tabela_preco_gravacao_oficial
      const { data: techRaw, error: techError } = await untypedFrom('tabela_preco_gravacao_oficial')
        .select('*')
        .eq('ativo', true)
        .limit(100);

      if (techError) throw new Error(techError.message);

      const allTechs: TabelaPrecoCanonical[] = adaptTabelaPrecoRows(techRaw || []);
      const techById = new Map(allTechs.map((t) => [t.id, t]));

      return areas.map((area, idx) => {
        const techId = area.price_table_id ?? area.tabela_preco_id ?? null;
        const tech = techId ? techById.get(techId) : null;
        const techniques: { id: string; nome: string; codigo: string }[] = [];

        if (tech) {
          techniques.push({
            id: tech.id,
            nome: tech.name ?? tech.nome ?? '',
            codigo: tech.codigo_curto ?? tech.codigo_tabela ?? tech.code ?? tech.codigo ?? '',
          });
        }

        const locationName = area.location_name ?? area.area_name ?? null;
        const locationCode = area.location_code ?? area.area_code ?? '';
        const techNomeForLabel = tech?.name ?? tech?.nome;

        return {
          area_id: area.id,
          area_code: locationCode,
          area_name: locationName
            ? techNomeForLabel
              ? `${locationName} -- ${techNomeForLabel}`
              : locationName
            : `Area ${idx + 1}`,
          component_name: null,
          location_name: locationName,
          max_width: area.max_width ?? area.largura_max ?? 0,
          max_height: area.max_height ?? area.altura_max ?? 0,
          unit: 'cm',
          shape: (area.shape || 'rectangle') as AreaShape,
          is_curved: area.is_curved ?? false,
          is_primary: idx === 0,
          display_order: area.technique_order ?? idx,
          techniques,
        };
      });
    },
    enabled: !!productId,
    staleTime: 60000,
  });
}

/**
 * Hook: Busca todas as tecnicas de gravacao ativas
 * BUG-14 FIX: era via external-db-bridge. Substituido por PostgREST nativo.
 */
export function useTechniques() {
  return useQuery({
    queryKey: ['techniques-all'],
    queryFn: async (): Promise<TecnicaGravacao[]> => {
      const { data, error } = await untypedFrom('tecnicas_gravacao')
        .select('*')
        .eq('ativo', true)
        .order('ordem_exibicao', { ascending: true });

      if (error) throw new Error(error.message);
      return adaptTecnicaRows(data || []) as unknown as TecnicaGravacao[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * @deprecated v_technique_stats is a view that only exists in the external bridge DB,
 * not in the local Supabase (Fase 3 decision). Returns empty data without hitting the DB.
 */
export function useTechniqueStats() {
  return { data: [] as unknown[], isLoading: false, error: null };
}

/**
 * Hook: Verifica se um produto tem areas de gravacao
 * BUG-14 FIX: era via external-db-bridge. Substituido por PostgREST nativo.
 */
export function useHasPrintAreas(productId: string | null) {
  return useQuery({
    queryKey: ['has-print-areas', productId],
    queryFn: async (): Promise<boolean> => {
      if (!productId) return false;
      try {
        const { data, error } = await untypedFrom('print_area_techniques')
          .select('id')
          .eq('product_id', productId)
          .eq('is_active', true)
          .limit(1);

        if (error) return false;
        return (data || []).length > 0;
      } catch {
        return false;
      }
    },
    enabled: !!productId,
    staleTime: 60000,
  });
}
