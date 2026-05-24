import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, requireRole, authErrorResponse } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { z } from '../_shared/zod-validate.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';

const CategoriesRequestSchema = z.object({
  action: z.enum(['tree', 'all', 'descendants', 'products_by_categories']),
  categoryIds: z.array(z.string().uuid()).max(200).optional(),
  includeDescendants: z.boolean().optional(),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Auth: exige vendedor autenticado (agente ou acima)
  try {
    const authCtx = await authenticateRequest(req);
    requireRole(authCtx, 'agente');
  } catch (authErr) {
    return authErrorResponse(authErr, corsHeaders);
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY');

    if (!externalUrl || !externalKey) {
      throw new Error('Missing external database configuration');
    }

    const externalClient = createClient(externalUrl, externalKey);

    const rawBody = await req.json().catch(() => ({}));
    const parsed = CategoriesRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
    const { action, categoryIds, includeDescendants } = parsed.data;

    switch (action) {
      case 'tree': {
        // Buscar árvore de categorias
        const { data, error } = await externalClient
          .from('categories_tree_visual')
          .select('*')
          .order('sort_path', { ascending: true });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'all': {
        // Buscar todas categorias
        const { data, error } = await externalClient
          .from('categories')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'descendants': {
        // Buscar categoria e todos os seus descendentes
        if (!categoryIds || categoryIds.length === 0) {
          return new Response(JSON.stringify({ success: true, data: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Buscar categorias e seus filhos recursivamente
        const { data: allCategories, error: catError } = await externalClient
          .from('categories')
          .select('id, parent_id, name, level');

        if (catError) throw catError;

        // Função para encontrar todos os descendentes
        const findDescendants = (parentIds: string[]): string[] => {
          const descendants: string[] = [];
          const queue = [...parentIds];

          while (queue.length > 0) {
            const currentId = queue.shift()!;
            descendants.push(currentId);

            // Encontrar filhos diretos
            const children = allCategories
              .filter((c: any) => c.parent_id === currentId)
              .map((c: any) => c.id);

            queue.push(...children);
          }

          return [...new Set(descendants)]; // Remover duplicatas
        };

        const allCategoryIds = findDescendants(categoryIds);

        return new Response(JSON.stringify({ success: true, data: allCategoryIds }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'products_by_categories': {
        // Buscar produtos vinculados às categorias
        if (!categoryIds || categoryIds.length === 0) {
          return new Response(JSON.stringify({ success: true, productIds: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let targetCategoryIds = [...categoryIds];

        // Se includeDescendants = true, buscar também subcategorias
        if (includeDescendants) {
          const { data: allCategories, error: catError } = await externalClient
            .from('categories')
            .select('id, parent_id');

          if (catError) throw catError;

          // Encontrar todos os descendentes
          const findDescendants = (parentIds: string[]): string[] => {
            const descendants: string[] = [];
            const queue = [...parentIds];

            while (queue.length > 0) {
              const currentId = queue.shift()!;
              descendants.push(currentId);

              const children = allCategories
                .filter((c: any) => c.parent_id === currentId)
                .map((c: any) => c.id);

              queue.push(...children);
            }

            return [...new Set(descendants)];
          };

          targetCategoryIds = findDescendants(categoryIds);
        }

        console.log('Querying products for categories', {
          categoryCount: targetCategoryIds.length,
        });

        // Coletar IDs de todas as estratégias em paralelo
        const allProductIds = new Set<string>();
        let primarySource = 'none';

        // ESTRATÉGIA 1: Usar products.category_id diretamente
        const { data: directProducts, error: directError } = await externalClient
          .from('products')
          .select('id')
          .in('category_id', targetCategoryIds)
          .eq('is_active', true);

        if (!directError && directProducts && directProducts.length > 0) {
          directProducts.forEach((p: any) => allProductIds.add(p.id));
          primarySource = 'products.category_id';
          console.log('Category product strategy result', {
            strategy: 'products.category_id',
            count: directProducts.length,
          });
        } else {
          console.log('Category product strategy empty', {
            strategy: 'products.category_id',
            error: directError ? safeErrorFields(directError) : undefined,
          });
        }

        // ESTRATÉGIA 2: product_category_assignments (tabela N:N)
        const { data: assignments, error: assignError } = await externalClient
          .from('product_category_assignments')
          .select('product_id')
          .in('category_id', targetCategoryIds);

        if (!assignError && assignments && assignments.length > 0) {
          assignments.forEach((a: any) => allProductIds.add(a.product_id));
          if (primarySource === 'none') primarySource = 'product_category_assignments';
          else primarySource += '+product_category_assignments';
          console.log('Category product strategy result', {
            strategy: 'product_category_assignments',
            count: assignments.length,
          });
        } else {
          console.log('Category product strategy empty', {
            strategy: 'product_category_assignments',
            error: assignError ? safeErrorFields(assignError) : undefined,
          });
        }

        // ESTRATÉGIA 3: product_categories (fallback legacy)
        const { data: fallbackData, error: fallbackError } = await externalClient
          .from('product_categories')
          .select('product_id')
          .in('category_id', targetCategoryIds);

        if (!fallbackError && fallbackData && fallbackData.length > 0) {
          fallbackData.forEach((a: any) => allProductIds.add(a.product_id));
          if (primarySource === 'none') primarySource = 'product_categories';
          else primarySource += '+product_categories';
          console.log('Category product strategy result', {
            strategy: 'product_categories',
            count: fallbackData.length,
          });
        } else {
          console.log('Category product strategy empty', {
            strategy: 'product_categories',
            error: fallbackError ? safeErrorFields(fallbackError) : undefined,
          });
        }

        const productIds = [...allProductIds];
        console.log('Total unique products by categories', {
          count: productIds.length,
          source: primarySource,
        });

        return new Response(
          JSON.stringify({
            success: true,
            productIds,
            source: primarySource,
            categoriesUsed: targetCategoryIds.length,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid action. Valid: tree, all, descendants, products_by_categories',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
  } catch (error) {
    console.error('Error in categories-api:', safeErrorFields(error));

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
