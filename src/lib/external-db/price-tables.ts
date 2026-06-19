import { dbInvoke } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';
/**
 * Price tables for Promobrind customization.
 */

export interface PromobrindPriceTable {
  id: string;
  table_code: string;
  table_code_option: string;
  customization_type_name: string;
  technique_code: string | null;
  min_quantity: number;
  max_quantity: number | null;
  min_colors: number | null;
  max_colors: number | null;
  max_area_width_cm: number | null;
  max_area_height_cm: number | null;
  unit_price: number;
  setup_price: number | null;
  handling_price: number | null;
  sla_days: number | null;
  is_active: boolean;
  code_option?: string;
  technique_name?: string;
}

export async function fetchPromobrindPriceTables(options?: {
  techniqueName?: string;
  techniqueCode?: string;
  quantity?: number;
  colors?: number;
  width?: number;
  height?: number;
}): Promise<PromobrindPriceTable[]> {
  const filters: Record<string, unknown> = { is_active: true };
  if (options?.techniqueName) filters.customization_type_name = options.techniqueName;
  if (options?.techniqueCode) filters.table_code = options.techniqueCode;

  let result: { records: Array<Record<string, unknown>> };
  try {
    result = await dbInvoke<Record<string, unknown>>({
      table: 'customization_price_tables',
      operation: 'select',
      filters,
      select: '*',
      limit: 500,
      orderBy: { column: 'tier_1_min_qty', ascending: true },
    });
  } catch (err) {
    if (err instanceof Error && (err.message.includes('410') || err.message.includes('Gone'))) {
      logger.warn('[price-tables] Bridge deprecated (410) for customization_price_tables');
      return [];
    }
    throw err;
  }

  let tables: PromobrindPriceTable[] = result.records.map((r) => ({
    id: r.id as string,
    table_code: r.table_code as string,
    table_code_option: r.table_code_option as string,
    customization_type_name: r.customization_type_name as string,
    technique_code: (r.serv_code || r.table_code) as string | null,
    min_quantity: (r.tier_1_min_qty as number) || 1,
    max_quantity: (r.tier_15_min_qty as number) || null,
    min_colors: null,
    max_colors: (r.max_colors as number) || null,
    max_area_width_cm: (r.max_area_width_cm as number) || null,
    max_area_height_cm: (r.max_area_height_cm as number) || null,
    unit_price: (r.tier_1_unit_price as number) ?? 0,
    setup_price: (r.setup_price as number) || null,
    handling_price: (r.handling_price as number) || null,
    sla_days: (r.tier_1_sla_days as number) || null,
    is_active: r.is_active as boolean,
    code_option: r.table_code_option as string,
    technique_name: r.customization_type_name as string,
  }));

  const { quantity, colors, width, height } = options ?? {};
  if (quantity)
    tables = tables.filter(
      (t) => t.min_quantity <= quantity && (t.max_quantity === null || t.max_quantity >= quantity),
    );
  if (colors)
    tables = tables.filter(
      (t) =>
        (t.min_colors === null || t.min_colors <= colors) &&
        (t.max_colors === null || t.max_colors >= colors),
    );
  if (width)
    tables = tables.filter((t) => t.max_area_width_cm === null || t.max_area_width_cm >= width);
  if (height)
    tables = tables.filter((t) => t.max_area_height_cm === null || t.max_area_height_cm >= height);

  return tables;
}

export async function findBestPriceTable(options: {
  techniqueName?: string;
  techniqueCode?: string;
  quantity: number;
  colors?: number;
  width?: number;
  height?: number;
}): Promise<PromobrindPriceTable | null> {
  const tables = await fetchPromobrindPriceTables(options);
  return tables[0] || null;
}
