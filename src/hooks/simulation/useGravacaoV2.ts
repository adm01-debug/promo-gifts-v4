/**
 * useGravacaoV2 - Hooks para Sistema de Gravação/Personalização v2
 *
 * Tipos e helpers extraídos para gravacao/ subfolder.
 * Este arquivo mantém apenas os hooks React.
 */
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db';
import { invokeExternalRpc } from '@/lib/external-rpc';

// Re-export types & helpers for backward compat
export type {
  TabelaPrecoOficial,
  FaixaPrecoOficial,
  CustomizationPriceV2,
  PrintAreaWithTechniques,
} from '@/hooks/gravacao/gravacao-types';
export {
  TECHNIQUE_COLORS,
  TECHNIQUE_ICONS,
  AREA_SHAPES,
  QUANTITY_TIERS_REFERENCE,
  getTechniqueColor,
  getTechniqueIcon,
  formatPrice,
  calculateTotalWithColorDiscount,
  calculateSetupCost,
  findPriceTier,
  calculateCustomizationTotal,
} from '@/hooks/gravacao/gravacao-constants';

import type {
  TabelaPrecoOficial,
  FaixaPrecoOficial,
  CustomizationPriceV2,
  PrintAreaWithTechniques,
} from '@/hooks/gravacao/gravacao-types';

// Row shape returned by 'tabela_preco_gravacao_oficial' table queries.
type TecnicaRow = {
  id: string;
  nome: string;
  codigo_curto: string | null;
  codigo_tabela: string | null;
};

// Shape returned by RPC fn_get_customization_price.
type RpcCustomizationPriceResult = {
  success: boolean;
  area?: {
    id: string;
    code: string;
    name: string;
    max_width: number | null;
    max_height: number | null;
  };
  faixa?: {
    ordem: number;
    quantidade_minima: number;
    quantidade_maxima: number;
    prazo_dias: number | null;
  };
  tabela?: {
    id: string;
    codigo_tabela: string;
    nome: string;
    cobra_por_cor: boolean;
  };
  parametros?: { quantidade: number; num_cores: number };
  custos?: {
    custo_base_unitario: number;
    custo_unitario_total: number;
    custo_setup_base: number;
  };
  precos?: {
    markup_percent: number;
    preco_unitario_final: number;
    subtotal_pecas: number;
    faturamento_minimo_gravacao: number;
    aplica_minimo: boolean;
    total_final: number;
  };
  codigo_orcamento?: string;
};

// ============================================
// HOOKS
// ============================================

export function useProductPrintAreas(productId: string | null) {
  return useQuery({
    queryKey: ['product-print-areas-v2', productId],
    queryFn: async (): Promise<PrintAreaWithTechniques[]> => {
      if (!productId) return [];
      const { fetchPrintAreasFromProduct } = await import('@/lib/fetch-print-areas');
      const areas = await fetchPrintAreasFromProduct(productId);
      if (!areas.length) return [];

      const techResult = await invokeExternalDb<TecnicaRow>({
        table: 'tabela_preco_gravacao_oficial',
        operation: 'select',
        filters: { ativo: true },
        limit: 100,
      });

      const techById = new Map((techResult.records || []).map((t) => [t.id, t]));

      return areas.map((area) => {
        const techniques: { id: string; nome: string; codigo: string }[] = [];
        for (const tid of area.allowed_technique_ids || []) {
          const tech = techById.get(tid);
          if (tech)
            techniques.push({
              id: tech.id,
              nome: tech.nome,
              codigo: tech.codigo_curto || tech.codigo_tabela || '',
            });
        }
        return {
          area_id: area.id,
          area_code: area.area_code || '',
          area_name: area.area_name || '',
          max_width: area.max_width || 0,
          max_height: area.max_height || 0,
          shape: area.shape || 'rectangle',
          is_curved: area.is_curved ?? false,
          is_primary: area.is_primary ?? false,
          display_order: area.display_order ?? 0,
          techniques,
        };
      });
    },
    enabled: !!productId,
    staleTime: 60 * 1000,
  });
}

export function useTabelasPrecoOficial() {
  return useQuery({
    queryKey: ['tabelas-preco-oficial'],
    queryFn: async (): Promise<TabelaPrecoOficial[]> => {
      const result = await invokeExternalDb<TabelaPrecoOficial>({
        table: 'tabela_preco_gravacao_oficial',
        operation: 'select',
        filters: { ativo: true },
        orderBy: { column: 'codigo', ascending: true },
      });
      return result.records || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useFaixasPrecoOficial(tabelaPrecoId: string | null) {
  return useQuery({
    queryKey: ['faixas-preco-oficial', tabelaPrecoId],
    queryFn: async (): Promise<FaixaPrecoOficial[]> => {
      if (!tabelaPrecoId) return [];
      const result = await invokeExternalDb<FaixaPrecoOficial>({
        table: 'tabela_preco_gravacao_oficial_faixa',
        operation: 'select',
        filters: { tabela_preco_gravacao_id: tabelaPrecoId },
        orderBy: { column: 'ordem', ascending: true },
      });
      return result.records || [];
    },
    enabled: !!tabelaPrecoId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomizationPriceLegacy() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatePriceByArea = useCallback(
    async (
      areaId: string,
      quantidade: number,
      numCores: number = 1,
      larguraCm?: number | null,
      alturaCm?: number | null,
    ): Promise<CustomizationPriceV2 | null> => {
      setLoading(true);
      setError(null);
      try {
        const rawResult = await invokeExternalRpc<RpcCustomizationPriceResult>(
          'fn_get_customization_price',
          {
            p_area_id: areaId,
            p_quantidade: quantidade,
            p_num_cores: numCores,
            p_largura_cm: larguraCm ?? null,
            p_altura_cm: alturaCm ?? null,
          },
        );
        if (!rawResult?.success) {
          setLoading(false);
          return null;
        }

        const result: CustomizationPriceV2 = {
          success: true,
          area_id: rawResult.area?.id || areaId,
          area_code: rawResult.area?.code || '',
          area_name: rawResult.area?.name || '',
          area_order: rawResult.faixa?.ordem || 0,
          tabela_id: rawResult.tabela?.id || '',
          tabela_codigo: rawResult.tabela?.codigo_tabela || '',
          tabela_codigo_curto: rawResult.tabela?.codigo_tabela?.split('-')[0] || '',
          technique: rawResult.tabela?.nome || '',
          codigo_orcamento: rawResult.codigo_orcamento || '',
          quantity: rawResult.parametros?.quantidade || quantidade,
          num_cores: rawResult.parametros?.num_cores || numCores,
          tier_used: rawResult.faixa?.ordem || 0,
          tier_min_qty: rawResult.faixa?.quantidade_minima || 0,
          tier_max_qty: rawResult.faixa?.quantidade_maxima || 0,
          cost_base_unit: rawResult.custos?.custo_base_unitario || 0,
          cost_unit_total: rawResult.custos?.custo_unitario_total || 0,
          cost_setup: rawResult.custos?.custo_setup_base || 0,
          cost_total: (rawResult.custos?.custo_unitario_total || 0) * quantidade,
          markup_percent: rawResult.precos?.markup_percent || 0,
          preco_minimo_unitario: 0,
          unit_price: rawResult.precos?.preco_unitario_final || 0,
          subtotal_pecas: rawResult.precos?.subtotal_pecas || 0,
          faturamento_minimo_gravacao: rawResult.precos?.faturamento_minimo_gravacao || 0,
          minimum_applied: rawResult.precos?.aplica_minimo || false,
          total_price: rawResult.precos?.total_final || 0,
          margin_percent: rawResult.precos?.markup_percent || 0,
          price_by_color: rawResult.tabela?.cobra_por_cor || false,
          setup_by_color: false,
          production_days: rawResult.faixa?.prazo_dias ?? null,
          largura_max_tecnica: rawResult.area?.max_width ?? null,
          altura_max_tecnica: rawResult.area?.max_height ?? null,
        };
        setLoading(false);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao calcular preço');
        setLoading(false);
        return null;
      }
    },
    [],
  );

  /** @deprecated Use calculatePriceByArea instead */
  const calculatePrice = calculatePriceByArea;
  /** @deprecated Use calculatePriceByArea instead */
  const calculatePriceWithVariant = calculatePriceByArea;

  return { calculatePrice, calculatePriceByArea, calculatePriceWithVariant, loading, error };
}

export function useTabelaPrecoPorCodigo(codigo: string | null) {
  return useQuery({
    queryKey: ['tabela-preco-codigo', codigo],
    queryFn: async (): Promise<TabelaPrecoOficial | null> => {
      if (!codigo) return null;
      const result = await invokeExternalDb<TabelaPrecoOficial>({
        table: 'tabela_preco_gravacao_oficial',
        operation: 'select',
        filters: { codigo },
        limit: 1,
      });
      return result.records[0] || null;
    },
    enabled: !!codigo,
    staleTime: 5 * 60 * 1000,
  });
}
