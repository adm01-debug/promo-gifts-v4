// Hook para buscar opcoes de cores e tamanhos de uma tecnica especifica
import { useState, useEffect, useMemo, useCallback } from 'react';
import { untypedFrom } from '@/lib/supabase-untyped';

import { logger } from '@/lib/logger';
export interface TechniquePriceOption {
  id: string;
  tableCode: string;
  tableCodeOption: string | null;
  tableFullcode: string | null;
  techniqueName: string;
  maxColors: number;
  maxAreaWidth: number;
  maxAreaHeight: number;
  areaCm2: number;
  priceByColor: boolean;
  priceByArea: boolean;
  setupPrice: number;
  handlingPrice: number;
}

export interface ColorOption {
  value: number;
  label: string;
}

export interface SizeOption {
  value: string;
  label: string;
  width: number;
  height: number;
  areaCm2: number;
  tableFullcode: string;
}

export function useTechniquePricing(techniqueCode: string | null) {
  const [priceOptions, setPriceOptions] = useState<TechniquePriceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!techniqueCode) {
      setPriceOptions([]);
      return;
    }

    let cancelled = false;

    const fetchPriceOptions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        /**
         * FIX 2026-06-01: 'customization_price_tables' does not exist in Supabase.
         * It was a virtual alias only valid inside postgrest.ts / rest-native.ts.
         * Direct supabase.from() calls must use the real table with PT column names.
         *
         * Real table: tabela_preco_gravacao_oficial
         * Column mapping used here:
         *   is_active          -> ativo
         *   table_code         -> codigo_tabela
         *   table_code_option  -> codigo_curto
         *   table_fullcode     -> codigo_tabela (no separate fullcode col)
         *   customization_type_name -> grupo_tecnica
         *   max_colors         -> max_cores
         *   setup_price        -> custo_setup
         *   handling_price     -> custo_manuseio
         *   price_by_color     -> cobra_por_cor
         *   price_by_area      -> usa_faixa_dimensional
         *
         * Note: max_area_width_cm / max_area_height_cm are NOT in tabela_preco_gravacao_oficial.
         * Area dimensions live in print_area_techniques joined by tabela_preco_id.
         * Returning 0 as safe fallback -- callers handle 0 gracefully.
         */
        const { data, error: fetchError } = await untypedFrom('tabela_preco_gravacao_oficial')
          .select(
            'id,codigo_tabela,codigo_curto,grupo_tecnica,max_cores,custo_setup,custo_manuseio,cobra_por_cor,usa_faixa_dimensional,ativo',
          )
          .eq('ativo', true)
          .limit(100);

        if (fetchError) throw new Error(fetchError.message);
        if (cancelled) return;

        const records = data ?? [];

        const matchingTables = records.filter((t) => {
          const code = techniqueCode.toLowerCase();
          const tableCode = ((t.codigo_tabela as string) || '').toLowerCase();
          const grupoTecnica = ((t.grupo_tecnica as string) || '').toLowerCase();
          return (
            tableCode.includes(code) ||
            code.includes(tableCode) ||
            grupoTecnica.includes(code) ||
            code.includes(grupoTecnica)
          );
        });

        const options: TechniquePriceOption[] = matchingTables.map((t) => ({
          id: t.id as string,
          tableCode: (t.codigo_tabela as string) || '',
          tableCodeOption: (t.codigo_curto as string | null) ?? null,
          tableFullcode: (t.codigo_tabela as string) || null,
          techniqueName: (t.grupo_tecnica as string) || '',
          maxColors: (t.max_cores as number) || 1,
          // max_area_width_cm / max_area_height_cm not in this table.
          // They live in print_area_techniques (joined by tabela_preco_id).
          // Returning 0 as safe default.
          maxAreaWidth: 0,
          maxAreaHeight: 0,
          areaCm2: 0,
          priceByColor: (t.cobra_por_cor as boolean) || false,
          priceByArea: (t.usa_faixa_dimensional as boolean) || false,
          setupPrice: (t.custo_setup as number) || 0,
          handlingPrice: (t.custo_manuseio as number) || 0,
        }));

        setPriceOptions(options);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
        logger.error('Erro ao buscar opcoes de preco:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPriceOptions();
    return () => {
      cancelled = true;
    };
  }, [techniqueCode]);

  const hasPriceByColor = useMemo(
    () => priceOptions.some((opt) => opt.priceByColor),
    [priceOptions],
  );
  const hasPriceByArea = useMemo(() => priceOptions.some((opt) => opt.priceByArea), [priceOptions]);

  const colorOptions = useMemo((): ColorOption[] => {
    if (!hasPriceByColor || priceOptions.length === 0) return [];
    const uniqueColors = [...new Set(priceOptions.map((opt) => opt.maxColors))]
      .filter((c) => c > 0)
      .sort((a, b) => a - b);
    if (uniqueColors.length <= 1) {
      const maxColors = uniqueColors[0] || 4;
      return Array.from({ length: maxColors }, (_, i) => ({
        value: i + 1,
        label: `${i + 1} ${i === 0 ? 'cor' : 'cores'}`,
      }));
    }
    return uniqueColors.map((c) => ({ value: c, label: `${c} ${c === 1 ? 'cor' : 'cores'}` }));
  }, [priceOptions, hasPriceByColor]);

  const sizeOptions = useMemo((): SizeOption[] => {
    // Size options require max_area_width_cm/max_area_height_cm from print_area_techniques.
    // Not available in tabela_preco_gravacao_oficial -- requires a JOIN query.
    // Returning empty array until a JOIN implementation is added.
    return [];
  }, []);

  const findMatchingTable = useCallback(
    (colors: number, _sizeValue: string): TechniquePriceOption | null => {
      if (priceOptions.length === 0) return null;
      if (hasPriceByColor) {
        return priceOptions.find((opt) => opt.maxColors >= colors) || priceOptions[0];
      }
      return priceOptions[0] || null;
    },
    [priceOptions, hasPriceByColor],
  );

  return {
    priceOptions,
    colorOptions,
    sizeOptions,
    hasPriceByColor,
    hasPriceByArea,
    isLoading,
    error,
    findMatchingTable,
  };
}
