// Hook para buscar opcoes de cores e tamanhos de uma tecnica especifica
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
         * BUG-12 FIX: substituir external-db-bridge por PostgREST nativo.
         *
         * PROBLEMA ORIGINAL: usava `supabase.functions.invoke('external-db-bridge', ...)`
         * para buscar `customization_price_tables`. Essa tabela e LOCAL ao Supabase
         * (nao e do banco externo promobrind), portanto deve ser acessada via PostgREST
         * diretamente. Apos o merge do Caminho B (PRs #230-232), o external-db-bridge
         * foi deprecated para tabelas locais.
         *
         * SOLUCAO: usar `supabase.from('customization_price_tables').select(...)`.
         */
        const { data, error: fetchError } = await supabase
          .from('customization_price_tables')
          .select(
            'id,table_code,table_code_option,table_fullcode,customization_type_name,max_colors,max_area_width_cm,max_area_height_cm,price_by_color,price_by_area,setup_price,handling_price'
          )
          .eq('is_active', true)
          .limit(100);

        if (fetchError) throw new Error(fetchError.message);
        if (cancelled) return;

        const records = data || [];

        const matchingTables = records.filter((t) => {
          const code = techniqueCode.toLowerCase();
          const tableCode = ((t.table_code as string) || '').toLowerCase();
          const fullCode = ((t.table_fullcode as string) || '').toLowerCase();
          return tableCode.includes(code) || code.includes(tableCode) || fullCode.includes(code);
        });

        const options: TechniquePriceOption[] = matchingTables.map((t) => ({
          id: t.id as string,
          tableCode: t.table_code as string,
          tableCodeOption: t.table_code_option as string | null,
          tableFullcode: t.table_fullcode as string | null,
          techniqueName: t.customization_type_name as string,
          maxColors: (t.max_colors as number) || 1,
          maxAreaWidth: (t.max_area_width_cm as number) || 0,
          maxAreaHeight: (t.max_area_height_cm as number) || 0,
          areaCm2: ((t.max_area_width_cm as number) || 0) * ((t.max_area_height_cm as number) || 0),
          priceByColor: (t.price_by_color as boolean) || false,
          priceByArea: (t.price_by_area as boolean) || false,
          setupPrice: (t.setup_price as number) || 0,
          handlingPrice: (t.handling_price as number) || 0,
        }));

        setPriceOptions(options);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
        console.error('Erro ao buscar opcoes de preco:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPriceOptions();
    return () => { cancelled = true; };
  }, [techniqueCode]);

  const hasPriceByColor = useMemo(() => priceOptions.some(opt => opt.priceByColor), [priceOptions]);
  const hasPriceByArea = useMemo(() => priceOptions.some(opt => opt.priceByArea), [priceOptions]);

  const colorOptions = useMemo((): ColorOption[] => {
    if (!hasPriceByColor || priceOptions.length === 0) return [];
    const uniqueColors = [...new Set(priceOptions.map(opt => opt.maxColors))].filter(c => c > 0).sort((a, b) => a - b);
    if (uniqueColors.length <= 1) {
      const maxColors = uniqueColors[0] || 4;
      return Array.from({ length: maxColors }, (_, i) => ({ value: i + 1, label: `${i + 1} ${i === 0 ? 'cor' : 'cores'}` }));
    }
    return uniqueColors.map(c => ({ value: c, label: `${c} ${c === 1 ? 'cor' : 'cores'}` }));
  }, [priceOptions, hasPriceByColor]);

  const sizeOptions = useMemo((): SizeOption[] => {
    if (priceOptions.length === 0) return [];
    const uniqueAreas = new Map<string, SizeOption>();
    priceOptions.forEach(opt => {
      if (opt.maxAreaWidth > 0 && opt.maxAreaHeight > 0) {
        const key = `${opt.maxAreaWidth}x${opt.maxAreaHeight}`;
        if (!uniqueAreas.has(key)) {
          uniqueAreas.set(key, { value: key, label: `${opt.maxAreaWidth} x ${opt.maxAreaHeight} cm`, width: opt.maxAreaWidth, height: opt.maxAreaHeight, areaCm2: opt.areaCm2, tableFullcode: opt.tableFullcode || opt.tableCode });
        }
      }
    });
    return Array.from(uniqueAreas.values()).sort((a, b) => a.areaCm2 - b.areaCm2);
  }, [priceOptions]);

  const findMatchingTable = useCallback((colors: number, sizeValue: string): TechniquePriceOption | null => {
    if (priceOptions.length === 0) return null;
    const [width, height] = sizeValue.split('x').map(Number);
    const matching = priceOptions.find(opt => {
      const colorMatch = !hasPriceByColor || opt.maxColors >= colors;
      const sizeMatch = !sizeValue || (opt.maxAreaWidth === width && opt.maxAreaHeight === height);
      return colorMatch && sizeMatch;
    });
    if (!matching && hasPriceByColor) return priceOptions.find(opt => opt.maxColors >= colors) || priceOptions[0];
    return matching || priceOptions[0];
  }, [priceOptions, hasPriceByColor]);

  return { priceOptions, colorOptions, sizeOptions, hasPriceByColor, hasPriceByArea, isLoading, error, findMatchingTable };
}
