import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { getCredential } from '../_shared/credentials.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { z } from '../_shared/zod-validate.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';

const CategoriesRequestSchema = z.object({
  action: z.enum(['tree', 'all', 'descendants', 'products_by_categories']),
  categoryIds: z.array(z.string()).max(200).optional(),
  includeDescendants: z.boolean().optional(),
});

// Roles internas validas deste sistema. A role 'agente' historicamente usada
// no gate NAO existe no banco (as reais sao vendedor/admin/dev); mantemos
// 'agente' e 'coordenador'/'supervisor' por compatibilidade futura.
const INTERNAL_ROLES = ['vendedor', 'agente', 'coordenador', 'supervisor', 'admin', 'dev'];

// BUGFIX 2026-06-21: product_category_assignments nao tem coluna is_active.
// Estrategia 2 precisa verificar status ativo via products em lotes para evitar
// URL length limit do PostgREST com arrays grandes de UUIDs (27k+ assignments).
const PCA_BATCH_SIZE = 200;

Deno.serve(async (req) => {
  // CORS preflight MUST be handled BEFORE auth — OPTIONS requests don't
  // carry auth tokens, so authenticateRequest would reject them with 401.
  // Chrome requires a 2xx response to OPTIONS for the preflight to pass.
  const preflightResponse = handleCorsPreflightIfNeeded(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  // Auth: exige usuario interno autenticado (qualquer role conhecida).
  // BUGFIX: o gate anterior era requireRole(authCtx, 'agente'), mas 'agente'
  // nao existe no sistema -> 403 para vendedores E admins (so dev passava).
  // Dados aqui sao metadados publicos de catalogo, mesmo nivel da materials-api.
  try {
    const authCtx = await authenticateRequest(req);
    const hasInternalRole = authCtx.userRoles.some((r) => INTERNAL_ROLES.includes(r));
    if (!hasInternalRole) {
      return authErrorResponse(
        { status: 403, message: 'Acesso restrito a usuarios internos' },
        corsHeaders,
      );
    }
  } catch (authErr) {
    return authErrorResponse(authErr, corsHeaders);
  }

  try {
    // fix: ssot-bypass — credential vault
    const externalUrl = await getCredential('EXTERNAL_PROMOBRIND_URL');
    const externalKey = await getCredential('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY');

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
        // BUGFIX 2026-06-21: adicionado .eq('is_deleted', false) alem de .eq('is_active', true)
        // para bloquear produtos soft-deleted que ainda apareciam nos resultados.
        const { data: directProducts, error: directError } = await externalClient
          .from('products')
          .select('id')
          .in('category_id', targetCategoryIds)
          .eq('is_active', true)
          .eq('is_deleted', false);

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
        // BUGFIX 2026-06-21: PCA nao tem coluna is_active — produtos inativos
        // vazavam nos resultados (696 casos = 2.49% dos assignments).
        // Fix: buscar assignments, depois verificar status ativo em lotes de
        // PCA_BATCH_SIZE=200 UUIDs para respeitar o URL length limit do PostgREST.
        const { data: assignments, error: assignError } = await externalClient
          .from('product_category_assignments')
          .select('product_id')
          .in('category_id', targetCategoryIds);

        if (!assignError && assignments && assignments.length > 0) {
          // Deduplica e exclui IDs ja capturados pela Estrategia 1
          const uniqueAssignedIds = [
            ...new Set(
              (assignments as Array<{ product_id: string }>)
                .map((a) => a.product_id)
                .filter((id) => !allProductIds.has(id)),
            ),
          ];

          if (uniqueAssignedIds.length > 0) {
            // Verificacao em lotes: evita URL length limit do PostgREST
            const batches: string[][] = [];
            for (let i = 0; i < uniqueAssignedIds.length; i += PCA_BATCH_SIZE) {
              batches.push(uniqueAssignedIds.slice(i, i + PCA_BATCH_SIZE));
            }

            const batchResults = await Promise.all(
              batches.map((batch) =>
                externalClient
                  .from('products')
                  .select('id')
                  .in('id', batch)
                  .eq('is_active', true)
                  .eq('is_deleted', false)
                  .then(({ data }) => (data ?? []) as Array<{ id: string }>),
              ),
            );

            let pcaActiveCount = 0;
            for (const batchData of batchResults) {
              for (const p of batchData) {
                allProductIds.add(p.id);
                pcaActiveCount++;
              }
            }

            if (pcaActiveCount > 0) {
              if (primarySource === 'none') primarySource = 'product_category_assignments';
              else primarySource += '+product_category_assignments';
              console.log('Category product strategy result', {
                strategy: 'product_category_assignments',
                rawAssignments: assignments.length,
                uniqueNew: uniqueAssignedIds.length,
                activeCount: pcaActiveCount,
                filteredInactive: uniqueAssignedIds.length - pcaActiveCount,
              });
            }
          }
        } else {
          console.log('Category product strategy empty', {
            strategy: 'product_category_assignments',
            error: assignError ? safeErrorFields(assignError) : undefined,
          });
        }

        // ESTRATÉGIA 3: product_categories (fallback legacy)
        // Nota: esta tabela nao existe no banco atual — a query falha silenciosamente,
        // o que e o comportamento correto (nao ha dados a migrar desta fonte).
        const { data: fallbackData, error: fallbackError } = await externalClient
          .from('product_categories')
          .select('product_id')
          .in('category_id', targetCategoryIds);

        if (!fallbackError && fallbackData && fallbackData.length > 0) {
          // BUGFIX 2026-06-21: mesmo tratamento que Estrategia 2 — so incluir ativos
          const legacyIds = [
            ...new Set(
              (fallbackData as Array<{ product_id: string }>)
                .map((a) => a.product_id)
                .filter((id) => !allProductIds.has(id)),
            ),
          ];
          if (legacyIds.length > 0) {
            const legacyBatches: string[][] = [];
            for (let i = 0; i < legacyIds.length; i += PCA_BATCH_SIZE) {
              legacyBatches.push(legacyIds.slice(i, i + PCA_BATCH_SIZE));
            }
            const legacyResults = await Promise.all(
              legacyBatches.map((batch) =>
                externalClient
                  .from('products')
                  .select('id')
                  .in('id', batch)
                  .eq('is_active', true)
                  .eq('is_deleted', false)
                  .then(({ data }) => (data ?? []) as Array<{ id: string }>),
              ),
            );
            let legacyCount = 0;
            for (const bd of legacyResults) {
              for (const p of bd) { allProductIds.add(p.id); legacyCount++; }
            }
            if (legacyCount > 0) {
              if (primarySource === 'none') primarySource = 'product_categories';
              else primarySource += '+product_categories';
              console.log('Category product strategy result', {
                strategy: 'product_categories', count: legacyCount,
              });
            }
          }
        } else {
          console.log('Category product strategy empty', {
            strategy: 'product_categories',
            error: fallbackError ? safeErrorFields(fallbackError) : undefined,
          });
        }

        const productIds = [...allProductIds];
        console.log('Total unique active products by categories', {
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
