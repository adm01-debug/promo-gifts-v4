// src/hooks/useTechniquePricingOptions.ts
import { useState, useEffect, useMemo } from 'react';
import { dbInvoke } from '@/lib/db/postgrest';

import { logger } from '@/lib/logger';
interface PriceTableEntry {
  id: string;
  composed_code: string;
  price_by_color: boolean;
  price_by_area: boolean;
  max_colors: number | null;
  max_area_width_cm: number | null;
  max_area_height_cm: number | null;
  unit_price: number;
  setup_price: number;
  min_quantity: number | null;
}

function hasMaxColors(table: PriceTableEntry): table is PriceTableEntry & { max_colors: number } {
  return table.price_by_color && typeof table.max_colors === 'number';
}

function hasAreaSize(
  table: PriceTableEntry,
): table is PriceTableEntry & { max_area_width_cm: number; max_area_height_cm: number } {
  return (
    table.price_by_area &&
    typeof table.max_area_width_cm === 'number' &&
    typeof table.max_area_height_cm === 'number'
  );
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
}
export interface TechniquePricingInfo {
  hasPriceByColor: boolean;
  hasPriceByArea: boolean;
  colorOptions: ColorOption[];
  sizeOptions: SizeOption[];
  isLoading: boolean;
  getTableForSelection: (colors: number, sizeValue: string | null) => PriceTableEntry | null;
}

export function useTechniquePricingOptions(techniqueCode: string | null): TechniquePricingInfo {
  const [tables, setTables] = useState<PriceTableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!techniqueCode) {
      setTables([]);
      return;
    }
    const fetchTables = async () => {
      setIsLoading(true);
      try {
        // FIX-BRIDGE-01: migrated from supabase.functions.invoke to dbInvoke
        const result = await dbInvoke({
          table: 'customization_price_tables',
          operation: 'select',
          filters: { table_code: techniqueCode },
          limit: 100,
        });
        setTables((result.records ?? []) as PriceTableEntry[]);
      } catch (err) {
        logger.error('Error fetching technique pricing tables:', err);
        setTables([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTables();
  }, [techniqueCode]);

  const hasPriceByColor = useMemo(() => tables.some((t) => t.price_by_color), [tables]);
  const hasPriceByArea = useMemo(() => tables.some((t) => t.price_by_area), [tables]);

  const colorOptions = useMemo((): ColorOption[] => {
    if (!hasPriceByColor) return [];
    const uniqueColors = new Set<number>();
    tables.filter(hasMaxColors).forEach((t) => uniqueColors.add(t.max_colors));
    return [...uniqueColors]
      .sort((a, b) => a - b)
      .map((c) => ({ value: c, label: c === 1 ? '1 cor' : `${c} cores` }));
  }, [tables, hasPriceByColor]);

  const sizeOptions = useMemo((): SizeOption[] => {
    if (!hasPriceByArea) return [];
    const uniqueSizes = new Map<string, SizeOption>();
    tables.filter(hasAreaSize).forEach((t) => {
      const w = t.max_area_width_cm;
      const h = t.max_area_height_cm;
      const key = `${w}x${h}`;
      if (!uniqueSizes.has(key))
        uniqueSizes.set(key, {
          value: key,
          label: `${w} × ${h} cm`,
          width: w,
          height: h,
          areaCm2: w * h,
        });
    });
    return [...uniqueSizes.values()].sort((a, b) => a.areaCm2 - b.areaCm2);
  }, [tables, hasPriceByArea]);

  const getTableForSelection = (
    colors: number,
    sizeValue: string | null,
  ): PriceTableEntry | null => {
    if (tables.length === 0) return null;
    let candidates = [...tables];
    if (hasPriceByColor && colors > 0) {
      candidates = candidates.filter(
        (t) => t.price_by_color && t.max_colors && t.max_colors >= colors,
      );
      candidates.sort((a, b) => (a.max_colors || 0) - (b.max_colors || 0));
    }
    if (hasPriceByArea && sizeValue) {
      const [w, h] = sizeValue.split('x').map(Number);
      candidates = candidates.filter(
        (t) => t.price_by_area && t.max_area_width_cm === w && t.max_area_height_cm === h,
      );
    }
    return candidates[0] || null;
  };

  return {
    hasPriceByColor,
    hasPriceByArea,
    colorOptions,
    sizeOptions,
    isLoading,
    getTableForSelection,
  };
}

export function useMultipleTechniquePricing(techniqueCodes: string[]) {
  const [allTables, setAllTables] = useState<Record<string, PriceTableEntry[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const techniqueCodesKey = techniqueCodes.join(',');

  useEffect(() => {
    const codes = techniqueCodesKey ? techniqueCodesKey.split(',').filter(Boolean) : [];
    if (codes.length === 0) {
      setAllTables({});
      return;
    }
    const fetchAll = async () => {
      setIsLoading(true);
      const results: Record<string, PriceTableEntry[]> = {};
      await Promise.all(
        codes.map(async (code) => {
          try {
            // FIX-BRIDGE-01
            const result = await dbInvoke({
              table: 'customization_price_tables',
              operation: 'select',
              filters: { table_code: code },
              limit: 100,
            });
            if (result.records?.length) results[code] = result.records as PriceTableEntry[];
          } catch (err) {
            logger.error(`Error fetching pricing for ${code}:`, err);
          }
        }),
      );
      setAllTables(results);
      setIsLoading(false);
    };
    fetchAll();
  }, [techniqueCodesKey]);

  const getPricingInfo = (code: string): Omit<TechniquePricingInfo, 'isLoading'> => {
    const tables = allTables[code] ?? [];
    const hasPriceByColor = tables.some((t) => t.price_by_color);
    const hasPriceByArea = tables.some((t) => t.price_by_area);
    const colorOptions: ColorOption[] = hasPriceByColor
      ? [...new Set(tables.filter(hasMaxColors).map((t) => t.max_colors))]
          .sort((a, b) => a - b)
          .map((c) => ({ value: c, label: c === 1 ? '1 cor' : `${c} cores` }))
      : [];
    const sizeOptions: SizeOption[] = hasPriceByArea
      ? [
          ...tables
            .filter(hasAreaSize)
            .reduce((map, t) => {
              const key = `${t.max_area_width_cm}x${t.max_area_height_cm}`;
              if (!map.has(key))
                map.set(key, {
                  value: key,
                  label: `${t.max_area_width_cm} × ${t.max_area_height_cm} cm`,
                  width: t.max_area_width_cm,
                  height: t.max_area_height_cm,
                  areaCm2: t.max_area_width_cm * t.max_area_height_cm,
                });
              return map;
            }, new Map<string, SizeOption>())
            .values(),
        ].sort((a, b) => a.areaCm2 - b.areaCm2)
      : [];
    const getTableForSelection = (
      colors: number,
      sizeValue: string | null,
    ): PriceTableEntry | null => {
      let candidates = [...tables];
      if (hasPriceByColor && colors > 0) {
        candidates = candidates.filter(
          (t) => t.price_by_color && t.max_colors && t.max_colors >= colors,
        );
        candidates.sort((a, b) => (a.max_colors || 0) - (b.max_colors || 0));
      }
      if (hasPriceByArea && sizeValue) {
        const [w, h] = sizeValue.split('x').map(Number);
        candidates = candidates.filter(
          (t) => t.price_by_area && t.max_area_width_cm === w && t.max_area_height_cm === h,
        );
      }
      return candidates[0] || null;
    };
    return { hasPriceByColor, hasPriceByArea, colorOptions, sizeOptions, getTableForSelection };
  };

  return { isLoading, getPricingInfo };
}
