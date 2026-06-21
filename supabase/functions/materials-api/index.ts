import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from '../_shared/zod-validate.ts';
import { getCredential } from '../_shared/credentials.ts';

const MaterialsRequestSchema = z.object({
  action: z.enum(['groups', 'types', 'types_by_group', 'product_materials', 'products_by_materials', 'stats', 'search', 'complete']),
  groupId: z.string().max(255).optional(),
  materialId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  materialTypeIds: z.array(z.string().uuid()).max(200).optional(),
  materialTypeSlugs: z.array(z.string().max(100)).max(200).optional(),
  materialGroupSlugs: z.array(z.string().max(100)).max(50).optional(),
  limit: z.number().int().min(1).max(500).default(100),
  search: z.string().max(200).optional(),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const localSupabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await localSupabase.auth.getUser();
        if (user) console.log('Materials API authenticated request');
      } catch (_) { /* ignora token inválido */ }
    }

    const rawBody = await req.json().catch(() => ({}));
    const parsed = MaterialsRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { action, groupId, materialId, productId, materialTypeIds, materialTypeSlugs, materialGroupSlugs, limit } = parsed.data;

    // Conectar ao banco externo
    // fix: ssot-bypass — use credential vault (aliases EXTERNAL_SUPABASE_URL / SERVICE_ROLE_KEY)
    const externalUrl = await getCredential('EXTERNAL_PROMOBRIND_URL');
    const externalKey = await getCredential('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY');

    if (!externalUrl || !externalKey) {
      console.warn('[materials-api] EXTERNAL_SUPABASE_URL/KEY not configured — returning empty payload');
      return new Response(
        JSON.stringify({ data: [], records: [], count: 0, _unconfigured: true, _message: 'Banco externo não configurado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const externalSupabase = createClient(externalUrl, externalKey);
    let result;

    switch (action) {
      case 'groups': {
        try {
          const { data, error } = await externalSupabase.rpc('get_all_material_groups_safe');
          if (!error && data) { result = { groups: data, count: data?.length || 0 }; break; }
        } catch (rpcErr) { console.warn('RPC get_all_material_groups_safe não disponível, usando fallback'); }

        const { data: groups, error: groupsError } = await externalSupabase
          .from('material_groups').select('*').eq('is_active', true).order('name', { ascending: true });
        if (groupsError) throw groupsError;

        const { data: typesCount } = await externalSupabase.from('material_types').select('group_id').eq('is_active', true);
        const countByGroup = new Map<string, number>();
        typesCount?.forEach((t: any) => { const c = countByGroup.get(t.group_id) || 0; countByGroup.set(t.group_id, c + 1); });

        const mappedGroups = (groups || []).map((g: any) => ({
          group_id: g.id, group_name: g.name, group_slug: g.slug, group_description: g.description,
          group_hex_code: g.hex_code, group_icon: g.icon, display_order: g.sort_order || 0,
          total_materials: countByGroup.get(g.id) || 0, products_using: 0,
        }));
        result = { groups: mappedGroups, count: mappedGroups.length };
        break;
      }

      case 'types': {
        try {
          const { data, error } = await externalSupabase.rpc('get_all_material_types_safe');
          if (!error && data) { result = { types: data, count: data?.length || 0 }; break; }
        } catch (rpcErr) { console.warn('RPC get_all_material_types_safe não disponível, usando fallback'); }

        const { data: types, error: typesError } = await externalSupabase
          .from('material_types')
          .select('*, material_groups (id, name, slug, description)')
          .eq('is_active', true).order('name', { ascending: true });
        if (typesError) throw typesError;

        const mappedTypes = (types || []).map((t: any) => ({
          id: t.id, name: t.name, slug: t.slug, description: t.description, properties: t.properties,
          display_order: t.sort_order || 0, is_active: t.is_active, group_id: t.group_id,
          group_name: t.material_groups?.name, group_slug: t.material_groups?.slug,
        }));
        result = { types: mappedTypes, count: mappedTypes.length };
        break;
      }

      case 'types_by_group': {
        if (!groupId) return new Response(JSON.stringify({ error: 'groupId (slug do grupo) é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        try {
          const { data, error } = await externalSupabase.rpc('get_material_types_by_group_slug', { p_group_slug: groupId });
          if (!error && data) { result = { types: data, count: data?.length || 0, groupSlug: groupId }; break; }
        } catch (rpcErr) { console.warn('RPC get_material_types_by_group_slug não disponível, usando fallback'); }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId);
        let query = externalSupabase.from('material_types').select('*, material_groups!inner (id, name, slug, description)').eq('is_active', true);
        if (isUuid) { query = query.eq('group_id', groupId); } else { query = query.eq('material_groups.slug', groupId); }

        const { data: types, error: typesError } = await query.order('name', { ascending: true });
        if (typesError) throw typesError;

        const mappedTypes = (types || []).map((t: any) => ({
          id: t.id, name: t.name, slug: t.slug, description: t.description, properties: t.properties,
          display_order: t.sort_order || 0, is_active: t.is_active, group_id: t.group_id,
          group_name: t.material_groups?.name, group_slug: t.material_groups?.slug,
        }));
        result = { types: mappedTypes, count: mappedTypes.length, groupSlug: groupId };
        break;
      }

      case 'complete': {
        try {
          const { data, error } = await externalSupabase.rpc('get_materials_complete_safe');
          if (!error && data) { result = { materials: data, count: data?.length || 0 }; break; }
        } catch (rpcErr) { console.warn('RPC get_materials_complete_safe não disponível, usando fallback'); }

        const { data: types, error: typesError } = await externalSupabase
          .from('material_types').select('*, material_groups (id, name, slug, description)').eq('is_active', true).order('name', { ascending: true });
        if (typesError) throw typesError;

        const materials = (types || []).map((t: any) => ({
          type_id: t.id, type_name: t.name, type_slug: t.slug, type_description: t.description,
          type_properties: t.properties, type_display_order: t.sort_order || 0, group_id: t.group_id,
          group_name: t.material_groups?.name, group_slug: t.material_groups?.slug,
          group_description: t.material_groups?.description, group_hex_code: t.material_groups?.hex_code,
          group_icon: t.material_groups?.icon, group_display_order: t.material_groups?.sort_order || 0,
        }));
        result = { materials, count: materials.length };
        break;
      }

      case 'product_materials': {
        if (!productId) return new Response(JSON.stringify({ error: 'productId é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        // FIX BUG-MAT-01 (2026-06-21): .order('name') em product_materials causava 400
        // (coluna não existe na tabela base; 'name' pertence a material_types, não a product_materials).
        // Corrigido para sort_order (coluna canônica de ordenação de product_materials).
        const { data, error } = await externalSupabase.from('product_materials')
          .select('id, part, percentage, notes, sort_order, material_id, material_types!inner (id, name, slug, group_id, material_groups!inner (id, name, slug))')
          .eq('product_id', productId).eq('is_active', true).order('sort_order', { ascending: true });
        if (error) throw error;
        result = { materials: data, count: data?.length || 0, productId };
        break;
      }

      case 'products_by_materials': {
        if ((!materialTypeIds || materialTypeIds.length === 0) && (!materialTypeSlugs || materialTypeSlugs.length === 0) && (!materialGroupSlugs || materialGroupSlugs.length === 0)) {
          return new Response(JSON.stringify({ error: 'materialTypeIds, materialTypeSlugs ou materialGroupSlugs é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        let targetMaterialIds: string[] = materialTypeIds || [];
        if (materialTypeSlugs && materialTypeSlugs.length > 0) {
          const { data: types, error: typesError } = await externalSupabase.from('material_types').select('id').in('slug', materialTypeSlugs).eq('is_active', true);
          if (typesError) throw typesError;
          targetMaterialIds = [...new Set([...targetMaterialIds, ...(types || []).map((t: any) => t.id)])];
        }
        if (materialGroupSlugs && materialGroupSlugs.length > 0) {
          const { data: groups, error: groupsError } = await externalSupabase.from('material_groups').select('id').in('slug', materialGroupSlugs).eq('is_active', true);
          if (groupsError) throw groupsError;
          if (groups && groups.length > 0) {
            const groupIds = groups.map((g: any) => g.id);
            const { data: types, error: typesError } = await externalSupabase.from('material_types').select('id').in('group_id', groupIds).eq('is_active', true);
            if (typesError) throw typesError;
            const typeIds = (types || []).map((t: any) => t.id);
            targetMaterialIds = [...new Set([...targetMaterialIds, ...typeIds])];
          }
        }
        if (targetMaterialIds.length === 0) { result = { productIds: [], count: 0 }; break; }
        const { data: productMaterials, error: pmError } = await externalSupabase.from('product_materials').select('product_id').in('material_id', targetMaterialIds).eq('is_active', true);
        if (pmError) throw pmError;
        const uniqueProductIds = [...new Set((productMaterials || []).map((pm: any) => pm.product_id))];
        result = { productIds: uniqueProductIds, count: uniqueProductIds.length, materialTypeIds: targetMaterialIds };
        break;
      }

      case 'stats': {
        const { data, error } = await externalSupabase.from('mv_material_group_stats').select('*').order('products_using', { ascending: false });
        if (error) throw error;
        const totalMaterials = data?.reduce((sum, g) => sum + (g.total_materials || 0), 0) || 0;
        const totalProducts = data?.reduce((sum, g) => sum + (g.products_using || 0), 0) || 0;
        result = { groups: data, summary: { totalGroups: data?.length || 0, totalMaterials, totalProducts } };
        break;
      }

      case 'search': {
        const searchTerm = parsed.data.search || '';
        if (!searchTerm) return new Response(JSON.stringify({ error: 'search é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const { data, error } = await externalSupabase.rpc('get_materials_complete_safe');
        if (error) { console.error('Error searching materials:', error); throw new Error(error.message); }
        const searchLower = searchTerm.toLowerCase();
        const filtered = (data || []).filter((m: any) => m.type_name?.toLowerCase().includes(searchLower) || m.group_name?.toLowerCase().includes(searchLower)).slice(0, 20);
        result = { types: filtered, count: filtered.length, search: searchTerm };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Ação '${action}' não suportada`, availableActions: ['groups', 'types', 'types_by_group', 'product_materials', 'products_by_materials', 'stats', 'search', 'complete'] }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ data: result, success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : (error?.message || error?.error_description || error?.hint || error?.details || JSON.stringify(error) || 'Erro desconhecido');
    const errorCode = error?.code ?? null;

    // PGRST002 = PostgREST do banco externo ainda está reconstruindo o schema cache
    // (típico logo após auto-resume de projeto pausado). É transitório — devolvemos
    // payload vazio com flag, em vez de 500 / tela branca, pra UI fazer retry suave.
    const isSchemaCacheWarmup =
      errorCode === 'PGRST002' || /schema cache/i.test(errorMessage);
    if (isSchemaCacheWarmup) {
      console.warn('[materials-api] external PostgREST schema cache warming up — returning empty payload', { errorMessage });
      return new Response(
        JSON.stringify({
          data: [],
          records: [],
          count: 0,
          _unavailable: true,
          _retryable: true,
          _message: 'Banco externo aquecendo o cache de schema. Tente novamente em alguns segundos.',
          code: 'PGRST002',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '5' } },
      );
    }

    console.error('Materials API error:', errorMessage, 'code:', errorCode, 'raw:', JSON.stringify(error));
    return new Response(JSON.stringify({ error: errorMessage, code: errorCode }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
