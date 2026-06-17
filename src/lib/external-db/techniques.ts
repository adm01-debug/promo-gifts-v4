import { dbInvoke } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';
/**
 * Techniques and Print Areas for Promobrind.
 */

export interface PromobrindPrintArea {
  id: string;
  product_id: string;
  area_code: string;
  area_name: string;
  component_name: string | null;
  location_name: string | null;
  max_width_cm: number | null;
  max_height_cm: number | null;
  max_area_cm2: number | null;
  is_curved: boolean;
  technique_id: string | null;
  technique_code: string | null;
  technique_name: string | null;
  max_colors: number | null;
  /**
   * Sempre `undefined` na resposta da RPC. Aguardando decisão de produto
   * (limpar do front ou expor via RPC usando technique_order=1).
   */
  is_default: boolean;
  /**
   * Sempre `null`. Imagens com image_type='area' existem em product_images
   * mas não há mapping para location_code.
   */
  area_image_url: string | null;
}

export interface PromobrindTechnique {
  id: string;
  code?: string;
  name: string;
  description?: string | null;
  category?: string | null;
  setup_price?: number | null;
  handling_price?: number | null;
  base_cost_multiplier?: number | null;
  requires_color_count?: boolean | null;
  min_colors?: number;
  max_colors?: number | null;
  price_by_color?: boolean | null;
  price_by_area?: boolean | null;
  is_active?: boolean | null;
  display_order?: number | null;
  setup_cost?: number | null;
  unit_cost?: number | null;
  min_quantity?: number | null;
  estimated_days?: number | null;
  [key: string]: unknown;
}

const TECHNIQUE_SELECT_FIELDS = '*';

// Row shape from 'tabela_preco_gravacao_oficial' (legacy/PT-BR field names plus EN aliases).
type TechniqueRawRow = {
  id: string;
  codigo?: string | null;
  code?: string | null;
  nome?: string | null;
  name?: string | null;
  descricao?: string | null;
  description?: string | null;
  permite_cores?: boolean | null;
  requires_color_count?: boolean | null;
  max_cores?: number | null;
  max_colors?: number | null;
  cobra_por_cor?: boolean | null;
  price_by_color?: boolean | null;
  cobra_por_area?: boolean | null;
  price_by_area?: boolean | null;
  ativo?: boolean | null;
  is_active?: boolean | null;
  tempo_producao_dias?: number | null;
  estimated_days?: number | null;
  ordem_exibicao?: number | null;
  display_order?: number | null;
  category?: string | null;
};

function mapTechniqueFields(t: TechniqueRawRow): PromobrindTechnique {
  const maxCoresRaw = t.max_cores ?? t.max_colors;
  const maxCores =
    typeof maxCoresRaw === 'number'
      ? maxCoresRaw
      : typeof maxCoresRaw === 'string'
        ? Number(maxCoresRaw)
        : null;
  return {
    ...t,
    code: t.codigo ?? t.code ?? undefined,
    name: t.nome ?? t.name ?? '',
    description: t.descricao ?? t.description ?? null,
    requires_color_count: t.permite_cores ?? t.requires_color_count ?? null,
    max_colors: Number.isFinite(maxCores as number) ? (maxCores as number) : null,
    price_by_color: t.cobra_por_cor ?? t.price_by_color ?? null,
    price_by_area: t.cobra_por_area ?? t.price_by_area ?? null,
    is_active: t.ativo ?? t.is_active ?? true,
    estimated_days: t.tempo_producao_dias ?? t.estimated_days ?? null,
    display_order: t.ordem_exibicao ?? t.display_order ?? null,
    setup_price: null,
    handling_price: null,
    setup_cost: null,
    unit_cost: null,
    min_quantity: null,
  };
}

export async function fetchPromobrindPrintAreas(productId: string): Promise<PromobrindPrintArea[]> {
  const { fetchPrintAreasFromProduct } = await import('@/lib/fetch-print-areas');
  const areas = await fetchPrintAreasFromProduct(productId);
  if (!areas.length) return [];

  let techResult: { records: TechniqueRawRow[] };
  try {
    techResult = await dbInvoke<TechniqueRawRow>({
      table: 'tabela_preco_gravacao_oficial',
      operation: 'select',
      filters: { ativo: true },
      limit: 100,
    });
  } catch (err) {
    if (err instanceof Error && (err.message.includes('410') || err.message.includes('Gone'))) {
      logger.warn('[techniques] Bridge deprecated (410) for tabela_preco_gravacao_oficial');
      return [];
    }
    throw err;
  }
  const techById = new Map<string, TechniqueRawRow>(
    (techResult.records ?? []).map((t) => [t.id, t]),
  );
  const result: PromobrindPrintArea[] = [];

  for (const area of areas) {
    const allowedIds = area.allowed_technique_ids ?? [];
    if (allowedIds.length === 0) {
      result.push({
        id: area.id,
        product_id: productId,
        area_code: area.area_code || '',
        area_name: area.area_name || area.location_name || '',
        component_name: area.component_name,
        location_name: area.location_name,
        max_width_cm: area.max_width,
        max_height_cm: area.max_height,
        max_area_cm2: null,
        is_curved: area.is_curved ?? false,
        technique_id: null,
        technique_code: null,
        technique_name: null,
        max_colors: null,
        is_default: area.is_primary ?? false,
        area_image_url: null,
      });
    } else {
      for (const tid of allowedIds) {
        const tech = techById.get(tid);
        result.push({
          id: area.id,
          product_id: productId,
          area_code: area.area_code || '',
          area_name: area.area_name || area.location_name || '',
          component_name: area.component_name,
          location_name: area.location_name,
          max_width_cm: area.max_width,
          max_height_cm: area.max_height,
          max_area_cm2: null,
          is_curved: area.is_curved ?? false,
          technique_id: tech?.id ?? tid,
          technique_code: tech?.codigo ?? null,
          technique_name: tech?.nome ?? null,
          max_colors: tech?.max_cores ?? null,
          is_default: area.is_primary ?? false,
          area_image_url: null,
        });
      }
    }
  }
  return result;
}

export async function fetchPromobrindTechniques(options?: {
  ids?: string[];
  codes?: string[];
  limit?: number;
}): Promise<PromobrindTechnique[]> {
  const filters: Record<string, unknown> = { ativo: true };
  if (options?.ids?.length) filters.id = options.ids;
  if (options?.codes?.length) filters.codigo = options.codes;

  let result: { records: TechniqueRawRow[] };
  try {
    result = await dbInvoke<TechniqueRawRow>({
      table: 'tecnica_gravacao',
      operation: 'select',
      filters,
      select: TECHNIQUE_SELECT_FIELDS,
      limit: options?.limit || 100,
      orderBy: { column: 'ordem_exibicao', ascending: true },
    });
  } catch (err) {
    if (err instanceof Error && (err.message.includes('410') || err.message.includes('Gone'))) {
      logger.warn('[techniques] Bridge deprecated (410) for tecnica_gravacao');
      return [];
    }
    throw err;
  }
  return (result.records ?? []).map(mapTechniqueFields);
}

export async function fetchPromobrindTechniqueById(
  techniqueId: string,
): Promise<PromobrindTechnique | null> {
  const result = await dbInvoke<TechniqueRawRow>({
    table: 'tecnica_gravacao',
    operation: 'select',
    filters: { id: techniqueId },
    select: TECHNIQUE_SELECT_FIELDS,
    limit: 1,
  });
  const tech = result.records[0];
  return tech ? mapTechniqueFields(tech) : null;
}
