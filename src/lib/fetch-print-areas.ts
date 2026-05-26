/**
 * Busca áreas de gravação de um produto do BD externo.
 *
 * FONTE ÚNICA: tabela 'print_area_techniques' no BD externo.
 * Dados da técnica vêm via lookup em 'tabela_preco_gravacao_oficial'.
 */
import { supabase } from '@/integrations/supabase/client';
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
 */
export async function fetchPrintAreasFromProduct(
  productId: string,
): Promise<PrintAreaFromProduct[]> {
  try {
    // 1. Buscar áreas da tabela print_area_techniques
    const { data, error } = await supabase.functions.invoke('external-db-bridge', {
      body: {
        table: 'print_area_techniques',
        operation: 'select',
        filters: { product_id: productId, is_active: true },
        orderBy: { column: 'technique_order', ascending: true },
        limit: 50,
      },
    });

    if (error || !data?.success) {
      logger.warn(
        '[fetchPrintAreas] Erro ao buscar print_area_techniques:',
        error?.message || data?.error,
      );
      return [];
    }

    const rawAreas = data.data?.records || [];
    if (!rawAreas.length) return [];
    const areas = adaptPrintAreaTechniqueRows(rawAreas);

    // 2. Coletar tabela_preco_ids para lookup (ler tanto PT quanto EN)
    const priceTableIds = new Set<string>();
    for (const area of areas) {
      const id = area.price_table_id ?? area.tabela_preco_id;
      if (id) priceTableIds.add(id);
    }

    // 3. Buscar técnicas para resolver nomes
    const techById = new Map<string, TabelaPrecoCanonical>();
    if (priceTableIds.size > 0) {
      const { data: techData } = await supabase.functions.invoke('external-db-bridge', {
        body: {
          table: 'tabela_preco_gravacao_oficial',
          operation: 'select',
          filters: { ativo: true },
          limit: 100,
        },
      });
      if (techData?.success) {
        for (const t of adaptTabelaPrecoRows(techData.data?.records || [])) {
          if (priceTableIds.has(t.id)) techById.set(t.id, t);
        }
      }
    }

    // 4. Mapear para interface esperada
    return areas.map((area, idx) => {
      const techId = area.price_table_id ?? area.tabela_preco_id ?? null;
      const tech = techId ? techById.get(techId) : null;
      const techNome = tech?.name ?? tech?.nome ?? null;
      const techCode =
        tech?.codigo_curto ?? tech?.codigo_tabela ?? tech?.code ?? tech?.codigo ?? null;
      const locationCode = area.location_code ?? area.area_code ?? '';
      const locationName = area.location_name ?? area.area_name ?? null;
      const maxW = area.max_width ?? area.largura_max ?? 0;
      const maxH = area.max_height ?? area.altura_max ?? 0;
      const setupCost = tech?.custo_setup ?? tech?.setup_price ?? null;
      const chargesPerColor = tech?.charges_per_color ?? tech?.cobra_por_cor ?? false;

      return {
        id: area.id || `${productId}-area-${idx}`,
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
        shape: area.shape || 'rectangle',
        is_curved: area.is_curved ?? false,
        is_primary: idx === 0,
        is_active: (area.is_active ?? area.ativo) !== false,
        display_order: area.technique_order ?? idx,
        max_colors:
          tech?.max_colors ??
          (typeof tech?.max_cores === 'string' ? Number(tech.max_cores) : tech?.max_cores) ??
          null,
        allowed_technique_ids: techId ? [techId] : [],
        customization_price_table_id: techId,
        supplier_technique_code: techCode ?? undefined,
        serv_code: tech?.codigo_curto ?? undefined,
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
