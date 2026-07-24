import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// DRY (audit 200-commits, P2-2): URL e anon key vem do client canonico
// (com validateEnv + fallback). Removidas as constantes locais duplicadas e a
// anon key hardcoded. Fonte unica de verdade: src/integrations/supabase/client.ts

// Tipos
export interface MaterialGroup {
  group_id: string;
  group_name: string;
  group_slug: string;
  group_description: string | null;
  group_hex_code: string | null;
  group_icon: string | null;
  display_order: number;
  total_materials: number;
  products_using: number;
}

export interface MaterialType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  properties: Record<string, unknown> | null;
  display_order: number;
  is_active: boolean;
  group_id: string;
  group_name?: string;
  group_slug?: string;
}

export interface MaterialComplete {
  type_id: string;
  type_name: string;
  type_slug: string;
  type_description: string | null;
  type_properties: Record<string, unknown> | null;
  type_display_order: number;
  group_id: string;
  group_name: string;
  group_slug: string;
  group_description: string | null;
  group_hex_code: string | null;
  group_icon: string | null;
  group_display_order: number;
}

// Service para chamadas à API de materiais
class MaterialService {
  // GAP (auditoria 200-commits): resolvido sob demanda (lazy), NÃO no construtor.
  // Ler SUPABASE_URL em tempo de import fazia `export const materialService =
  // new MaterialService()` acessar o export no module-load, quebrando todo teste
  // que mocka o client sem SUPABASE_URL. O getter preserva a URL canônica (com
  // fallback) e remove o efeito colateral de import.
  private get baseUrl(): string {
    return `${SUPABASE_URL}/functions/v1/materials-api`;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || SUPABASE_PUBLISHABLE_KEY}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
    };
  }

  private async callApi<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...params }),
    });

    const result = await response.json().catch(() => ({}));

    // PGRST002 = PostgREST do banco externo aquecendo schema cache (transitório,
    // típico após auto-resume de projeto pausado). Pode chegar como 500 (edge
    // antiga) ou 503 (edge nova). Em ambos os casos devolvemos payload vazio
    // em vez de quebrar a UI com tela branca — o caller faz retry natural.
    const errCode: string | undefined = result?.code;
    const errMsg = String(result?.error ?? '');
    const isSchemaWarmup =
      errCode === 'PGRST002' || /schema cache/i.test(errMsg) || response.status === 503;
    if (isSchemaWarmup) {
      logger.warn('[materialService] external schema cache warming up — empty payload', {
        status: response.status,
        errCode,
        errMsg,
      });
      return {
        data: [],
        records: [],
        count: 0,
        _unavailable: true,
        _retryable: true,
      } as unknown as T;
    }

    if (!response.ok) {
      throw new Error(result?.error || 'Erro ao buscar materiais');
    }

    // A função costuma responder no formato:
    // { success: true, data: {...} }
    // (mas mantém fallback para formato antigo sem envelope)
    if (result?.success === false) {
      throw new Error(result?.error || 'Erro ao buscar materiais');
    }

    return (result?.data ?? result) as T;
  }

  // Buscar todos os grupos de materiais com estatísticas
  async getGroups(): Promise<{ groups: MaterialGroup[]; count: number }> {
    const res = await this.callApi<{ groups: Record<string, unknown>[]; count?: number }>('groups');

    const groups: MaterialGroup[] = (res.groups || []).map((g) => ({
      group_id: g.group_id ?? g.id ?? '',
      group_name: g.group_name ?? g.name ?? '',
      group_slug: g.group_slug ?? g.slug ?? '',
      group_description: g.group_description ?? g.description ?? null,
      group_hex_code: g.group_hex_code ?? g.hex_code ?? null,
      group_icon: g.group_icon ?? g.icon ?? null,
      display_order: g.display_order ?? g.sort_order ?? 0,
      total_materials: g.total_materials ?? g.materials_count ?? 0,
      products_using: g.products_using ?? g.products_count ?? 0,
    })) as MaterialGroup[];

    return { groups, count: res.count ?? groups.length };
  }

  // Buscar todos os tipos de materiais
  async getTypes(): Promise<{ types: MaterialType[]; count: number }> {
    const res = await this.callApi<{ types: Record<string, unknown>[]; count?: number }>('types');

    const types: MaterialType[] = (res.types || []).map((t) => ({
      id: t.id ?? t.material_id ?? '',
      name: t.name ?? t.material_name ?? '',
      slug: t.slug ?? t.material_slug ?? '',
      description: t.description ?? t.material_description ?? null,
      properties: t.properties ?? t.material_properties ?? null,
      display_order: t.display_order ?? t.sort_order ?? 0,
      is_active: t.is_active ?? true,
      group_id: t.group_id ?? '',
      group_name: t.group_name,
      group_slug: t.group_slug,
    })) as MaterialType[];

    return { types, count: res.count ?? types.length };
  }

  // Buscar tipos de um grupo específico por slug
  async getTypesByGroupSlug(
    groupSlug: string,
  ): Promise<{ types: MaterialType[]; count: number; groupSlug: string }> {
    const res = await this.callApi<{ types: Record<string, unknown>[]; count?: number }>(
      'types_by_group',
      { groupId: groupSlug },
    );

    const types: MaterialType[] = (res.types || []).map((t) => ({
      id: t.id ?? t.material_id ?? '',
      name: t.name ?? t.material_name ?? '',
      slug: t.slug ?? t.material_slug ?? '',
      description: t.description ?? t.material_description ?? null,
      properties: t.properties ?? t.material_properties ?? null,
      display_order: t.display_order ?? t.sort_order ?? 0,
      is_active: t.is_active ?? true,
      group_id: t.group_id ?? '',
      group_name: t.group_name,
      group_slug: t.group_slug,
    })) as MaterialType[];

    return { types, count: res.count ?? types.length, groupSlug };
  }

  // Buscar materiais completos (tipos + grupos)
  async getComplete(): Promise<{ materials: MaterialComplete[]; count: number }> {
    const res = await this.callApi<{ materials: Record<string, unknown>[]; count?: number }>(
      'complete',
    );

    const materials: MaterialComplete[] = (res.materials || []).map((m) => ({
      type_id: m.type_id ?? m.material_id ?? m.id ?? '',
      type_name: m.type_name ?? m.material_name ?? m.name ?? '',
      type_slug: m.type_slug ?? m.material_slug ?? m.slug ?? '',
      type_description: m.type_description ?? m.material_description ?? m.description ?? null,
      type_properties: m.type_properties ?? m.properties ?? null,
      type_display_order: m.type_display_order ?? m.display_order ?? 0,
      group_id: m.group_id ?? '',
      group_name: m.group_name ?? '',
      group_slug: m.group_slug ?? '',
      group_description: m.group_description ?? null,
      group_hex_code: m.group_hex_code ?? null,
      group_icon: m.group_icon ?? null,
      group_display_order: m.group_display_order ?? m.display_order ?? 0,
    })) as MaterialComplete[];

    return { materials, count: res.count ?? materials.length };
  }

  // Buscar estatísticas gerais
  async getStats(): Promise<{
    groups: MaterialGroup[];
    summary: { totalGroups: number; totalMaterials: number; totalProducts: number };
  }> {
    return this.callApi('stats');
  }

  // Buscar materiais por termo
  async search(
    searchTerm: string,
  ): Promise<{ types: MaterialComplete[]; count: number; search: string }> {
    return this.callApi('search', { search: searchTerm });
  }

  // Buscar materiais de um produto específico
  async getProductMaterials(
    productId: string,
  ): Promise<{ materials: Record<string, unknown>[]; count: number; productId: string }> {
    return this.callApi('product_materials', { productId });
  }

  // Buscar IDs de produtos que possuem determinados materiais
  async getProductsByMaterials(options: {
    materialTypeIds?: string[];
    materialTypeSlugs?: string[];
    materialGroupSlugs?: string[];
  }): Promise<{ productIds: string[]; count: number; materialTypeIds?: string[] }> {
    return this.callApi('products_by_materials', options);
  }
}

export const materialService = new MaterialService();
