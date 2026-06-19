/**
 * useMockupTechniques — Filter techniques by product using fn_get_product_customization_options RPC
 *
 * v6.1 Fixes (audit sprint-2, 26/05/2026):
 * BUG-B: During product-data loading, return unfiltered techniques instead of [] to
 *        avoid a flash of empty dropdown.
 * BUG-D: Skip techniques without a code before inserting into the sessionStorage Map
 *        to prevent orphaned null-key entries.
 */

import { dbInvoke } from '@/lib/db/postgrest';
import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { invokeExternalRpc } from '@/lib/external-rpc';
import { adaptCustomizationOptions } from '@/lib/personalization/adapters';

interface Technique {
  id: string;
  name: string;
  code: string | null;
  /** Permite Technique ser atribuível a MockupTechnique (que aceita campos arbitrários do bridge). */
  [key: string]: unknown;
}

export interface TechniqueWithLimits extends Technique {
  maxWidth: number | null;
  maxHeight: number | null;
  areaName: string | null;
  locationName: string | null;
  maxColors: number | null;
  chargesPerColor: boolean;
  usesDimension: boolean;
  isCurved: boolean;
  setupCost: number | null;
  variationLabel: string | null;
  groupCode: string | null;
  shape: string | null;
}

export interface CustomizationOption {
  technique_id: string;
  tecnica_nome: string;
  codigo_tabela: string;
  grupo_tecnica: string;
  max_width: number;
  max_height: number;
  efetiva_largura_max: number;
  efetiva_altura_max: number;
  max_cores: number;
  cobra_por_cor: boolean;
  custo_setup: number;
  is_curved: boolean;
  usa_dimensao: boolean;
  variacao_label: string;
  shape: string;
}

interface CustomizationLocation {
  location_code: string;
  location_name: string;
  location_order: number;
  options: CustomizationOption[];
}

interface CustomizationResponse {
  product_id: string;
  locations: CustomizationLocation[];
}

interface FaixaPreco {
  largura_max: number | null;
  altura_max: number | null;
}

export function useProductCustomizationOptionsForMockup(productId: string | undefined) {
  return useQuery({
    queryKey: ['mockup-customization-options', productId],
    queryFn: async () => {
      if (!productId) return null;

      const raw = await invokeExternalRpc<Record<string, unknown>>(
        'fn_get_product_customization_options',
        { p_product_id: productId },
      );
      const adapted = adaptCustomizationOptions(raw);
      return adapted as unknown as CustomizationResponse | null;
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

function useAllTechniqueDimensions(_techniques: Technique[], shouldFetch: boolean) {
  return useQuery({
    queryKey: ['all-technique-dimensions-v6'],
    queryFn: async () => {
      const CACHE_KEY = 'mockup-tech-dims-v6';
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          return new Map(Object.entries(parsed));
        }
      } catch {
        /* ignore */
      }

      const techResult = await dbInvoke<{ id: string; code: string; name: string }>({
        table: 'personalization_techniques',
        operation: 'select',
        limit: 200,
      });

      if (!techResult.records.length) return new Map();

      const faixaResult = await dbInvoke<{
        tabela_preco_gravacao_id: string;
        largura_max: number | null;
        altura_max: number | null;
      }>({
        table: 'tabela_preco_gravacao_oficial_faixa',
        operation: 'select',
        select: 'tabela_preco_gravacao_id,largura_max,altura_max',
        limit: 5000,
      });

      const faixasByTech = new Map<string, FaixaPreco[]>();
      for (const f of faixaResult.records) {
        const key = f.tabela_preco_gravacao_id;
        if (!faixasByTech.has(key)) faixasByTech.set(key, []);
        faixasByTech.get(key)?.push(f);
      }

      const codeMap = new Map<string, { maxWidth: number | null; maxHeight: number | null }>();
      for (const tech of techResult.records) {
        // BUG-D FIX: skip techniques without code to prevent null/undefined Map keys.
        if (!tech.code) continue;

        const faixas = faixasByTech.get(tech.id) ?? [];
        if (!faixas.length) continue;

        const larguras: number[] = [];
        const alturas: number[] = [];
        let lwS = false,
          lhS = false;

        for (const f of faixas) {
          if (f.largura_max !== null) {
            if (f.largura_max >= 90) lwS = true;
            else larguras.push(f.largura_max);
          }
          if (f.altura_max !== null) {
            if (f.altura_max >= 90) lhS = true;
            else alturas.push(f.altura_max);
          }
        }

        codeMap.set(tech.code, {
          maxWidth: lwS ? null : larguras.length ? Math.max(...larguras) : null,
          maxHeight: lhS ? null : alturas.length ? Math.max(...alturas) : null,
        });
      }

      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(codeMap)));
      } catch {
        /* ignore */
      }
      return codeMap;
    },
    enabled: shouldFetch,
    staleTime: Infinity, // General dimensions change very rarely
    gcTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

/** Sentinel that builds a TechniqueWithLimits with all limits null (used as loading placeholder). */
function toUnlimited(t: Technique): TechniqueWithLimits {
  return {
    ...t,
    maxWidth: null,
    maxHeight: null,
    areaName: null,
    locationName: null,
    maxColors: null,
    chargesPerColor: false,
    usesDimension: false,
    isCurved: false,
    setupCost: null,
    variationLabel: null,
    groupCode: null,
    shape: null,
  };
}

export function useFilteredTechniques(
  techniques: Technique[],
  selectedProduct: { id: string } | null,
): TechniqueWithLimits[] {
  const { data: customizationData, isFetching } = useProductCustomizationOptionsForMockup(
    selectedProduct?.id,
  );

  const needsTechniqueDims = !!selectedProduct && customizationData?.locations?.length === 0;

  const { data: techniqueDims } = useAllTechniqueDimensions(techniques, !!needsTechniqueDims);

  return useMemo(() => {
    if (!selectedProduct || !techniques.length) {
      return techniques.map(toUnlimited);
    }

    // BUG-B FIX: return all techniques (unfiltered) while product data is loading
    // instead of [] — prevents a flash of empty dropdown on product selection.
    if (customizationData === undefined && isFetching) {
      return techniques.map(toUnlimited);
    }

    if (customizationData?.locations?.length === 0) {
      return techniques.map((t) => {
        const dims = t.code ? techniqueDims?.get(t.code) : undefined;
        return {
          ...t,
          maxWidth: dims?.maxWidth ?? null,
          maxHeight: dims?.maxHeight ?? null,
          areaName: null,
          locationName: null,
          maxColors: null,
          chargesPerColor: false,
          usesDimension: false,
          isCurved: false,
          setupCost: null,
          variationLabel: null,
          groupCode: null,
          shape: null,
        };
      });
    }

    const techniqueMap = new Map<string, { option: CustomizationOption; locationName: string }>();
    if (customizationData?.locations) {
      for (const location of customizationData.locations) {
        for (const option of location.options) {
          const key = option.tecnica_nome;
          const existing = techniqueMap.get(key);
          const area = (option.efetiva_largura_max ?? 0) * (option.efetiva_altura_max ?? 0);
          const existingArea = existing
            ? (existing.option.efetiva_largura_max ?? 0) * (existing.option.efetiva_altura_max ?? 0)
            : 0;
          if (!existing || area > existingArea)
            techniqueMap.set(key, { option, locationName: location.location_name });
        }
      }
    }

    const result: TechniqueWithLimits[] = [];
    for (const [_key, { option, locationName }] of techniqueMap.entries()) {
      result.push({
        id: option.technique_id,
        name: option.tecnica_nome,
        code: option.codigo_tabela || null,
        maxWidth: option.efetiva_largura_max || null,
        maxHeight: option.efetiva_altura_max || null,
        areaName: `${locationName} — ${option.tecnica_nome}`,
        locationName,
        maxColors: option.max_cores ?? null,
        chargesPerColor: option.cobra_por_cor ?? false,
        usesDimension: option.usa_dimensao ?? false,
        isCurved: option.is_curved ?? false,
        setupCost: option.custo_setup ?? null,
        variationLabel: option.variacao_label || null,
        groupCode: option.grupo_tecnica || null,
        shape: option.shape || null,
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [techniques, selectedProduct, customizationData, techniqueDims, isFetching]);
}
