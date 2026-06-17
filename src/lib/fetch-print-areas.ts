/**
 * Busca áreas de gravação de um produto do BD externo.
 *
 * FONTE ÚNICA: tabela 'print_area_techniques' no BD externo.
 * Dados da técnica vêm via lookup em 'tabela_preco_gravacao_oficial'.
 *
 * FIX (2026-05-29): substituídas as chamadas diretas a supabase.functions.invoke
 * por dbInvoke, que respeita o kill-switch edge_external_db_bridge e
 * usa REST nativo quando o bridge está OFF — eliminando o toast
 * "Failed to send a request to the Edge Function" na página de produto.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';
import {
  adaptPrintAreaTechniqueRows,
  adaptTabelaPrecoRows,
  type TabelaPrecoCanonical,
} from '@/lib/personalization/adapters';

export interface PrintAreaFromProduct {
  id: string;
  product_id: string;
  area_code: string;
  area_name: string;
  component_name: string | null;
  component_code: string | null;
  location_name: string | null;
  location_code: string | null;
  max_width: number;
  max_height: number;
  unit: string;
  shape: string;
  is_curved: boolean;
  is_primary: boolean;
  is_active: boolean;
  display_order: number;
  max_colors: number | null;
  allowed_technique_ids: string[];
  customization_price_table_id: string | null;
  supplier_technique_code?: string;
  serv_code?: string;
  area_cm2?: number | null;
  // Campos da técnica (resolvidos via JOIN conceitual)
  technique_name?: string | null;
  technique_code?: string | null;
  technique_group?: string | null;
  setup_cost?: number | null;
  charges_per_color?: boolean;
}

/**
 * Busca áreas de gravação da tabela print_area_techniques + resolve técnicas.
 * Retorna array vazio se o produto não tiver áreas configuradas.
 *
 * Usa dbInvoke (com kill-switch + REST nativo) em vez de chamar
 * supabase.functions.invoke diretamente, para não produzir erros quando o
 * bridge está descontinuado.
 */
export async function fetchPrintAreasFromProduct(
  productId: string,
): Promise<PrintAreaFromProduct[]> {
  try {
    // 1. Buscar áreas da tabela print_area_techniques
    const areasResult = await dbInvoke<Record<string, unknown>>({
      table: 'print_area_techniques',
      operation: 'select',
      filters: { product_id: productId, is_active: true },
      orderBy: { column: 'technique_order', ascending: true },
      limit: 50,
    });

    const rawAreas = areasResult.records ?? [];
    if (!rawAreas.length) return [];
    const areas = adaptPrintAreaTechniqueRows(rawAreas);

    // 2. Coletar tabela_preco_ids para lookup (ler tanto PT quanto EN)
    const priceTableIds = new Set<string>();
    for (const area of areas) {
      const areaRec = area as Record<string, unknown>;
      const id = areaRec.price_table_id ?? areaRec.tabela_preco_id;
      if (id && typeof id === 'string') priceTableIds.add(id);
    }

    // 3. Buscar técnicas para resolver nomes
    const techById = new Map<string, TabelaPrecoCanonical>();
    if (priceTableIds.size > 0) {
      try {
        const techResult = await dbInvoke<Record<string, unknown>>({
          table: 'tabela_preco_gravacao_oficial',
          operation: 'select',
          filters: { ativo: true },
          limit: 100,
        });
        for (const t of adaptTabelaPrecoRows(techResult.records ?? [])) {
          if (priceTableIds.has(t.id)) techById.set(t.id, t);
        }
      } catch (techErr) {
        logger.warn(`[fetchPrintAreas:${productId}] Falha ao buscar técnicas (ignorado):`, techErr);
      }
    }

    // 4. Mapear para interface esperada
    return areas.map((area, idx) => {
      const areaRaw = area as Record<string, unknown>;
      const techId = (areaRaw.price_table_id ?? areaRaw.tabela_preco_id ?? null) as string | null;
      const tech = techId ? techById.get(techId) : null;
      const techNome = tech?.name ?? tech?.nome ?? null;
      const techCode =
        tech?.codigo_curto ?? tech?.codigo_tabela ?? tech?.code ?? tech?.codigo ?? null;
      const locationCode = (areaRaw.location_code ?? areaRaw.area_code ?? '') as string;
      const locationName = (areaRaw.location_name ?? areaRaw.area_name ?? null) as string | null;
      const maxW = (areaRaw.max_width ?? areaRaw.largura_max ?? 0) as number;
      const maxH = (areaRaw.max_height ?? areaRaw.altura_max ?? 0) as number;
      const setupCost = tech?.custo_setup ?? tech?.setup_price ?? null;
      const chargesPerColor = tech?.charges_per_color ?? tech?.cobra_por_cor ?? false;

      return {
        id: (areaRaw.id as string) || `${productId}-area-${idx}`,
        product_id: productId,
        area_code: locationCode,
        area_name: locationName
          ? techNome
            ? `${locationName} — ${techNome}`
            : locationName
          : `Área ${idx + 1}`,
        component_name: null,
        component_code: null,
        location_name: locationName,
        location_code: locationCode || null,
        max_width: maxW,
        max_height: maxH,
        unit: 'cm',
        shape: (areaRaw.shape as string) || 'rectangle',
        is_curved: Boolean(areaRaw.is_curved),
        is_primary: idx === 0,
        is_active: (areaRaw.is_active ?? areaRaw.ativo) !== false,
        display_order: (areaRaw.technique_order as number) ?? idx,
        max_colors:
          tech?.max_colors ??
          (typeof tech?.max_cores === 'string' ? Number(tech.max_cores) : tech?.max_cores) ??
          null,
        allowed_technique_ids: techId ? [techId] : [],
        customization_price_table_id: techId,
        supplier_technique_code: (techCode as string | null) ?? undefined,
        serv_code: (tech?.codigo_curto as string | null) ?? undefined,
        area_cm2: maxW && maxH ? Number((Number(maxW) * Number(maxH)).toFixed(2)) : null,
        technique_name: techNome,
        technique_code: techCode,
        technique_group:
          tech?.group_name ?? tech?.nome_grupo ?? tech?.group ?? tech?.grupo_tecnica ?? null,
        setup_cost: typeof setupCost === 'number' ? setupCost : null,
        charges_per_color: !!chargesPerColor,
      };
    });
  } catch (err) {
    logger.warn('[fetchPrintAreas] Exceção:', err);
    return [];
  }
}
