/**
 * useCatalogRealStats — Fetches real aggregate counts from the external DB.
 *
 * FIX 2026-06-17 (catalog-audit / BUG-STATS-01): variações e fornecedores agora
 * vêm da view v_catalog_stats (security_invoker), que conta APENAS o que está
 * visível no catálogo. Antes, os badges contavam TODAS as product_variants
 * (18.530, incluindo variantes de produtos inativos/deletados) e TODOS os
 * suppliers ativos (5, incluindo fornecedor sem nenhum produto visível),
 * inflando os números. Agora: 18.351 variações e 4 fornecedores.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';

export interface CatalogRealStats {
  totalVariants: number;
  totalCategories: number;
  totalSuppliers: number;
}

const HIDDEN_CATEGORY_PATTERNS = [
  'matéria',
  'prima',
  'gravações',
  'personalização',
  'suprimentos',
  'insumos',
  'gravação | mochila',
];

function isHiddenCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return HIDDEN_CATEGORY_PATTERNS.some((p) => lower.includes(p));
}

export function useCatalogRealStats() {
  return useQuery<CatalogRealStats>({
    // v5: bump para invalidar cache antigo (números corrigidos pós-auditoria).
    queryKey: ['catalog-real-stats', 'v5'],
    queryFn: async () => {
      const [statsResult, categoriesResult] = await Promise.all([
        // Variações + fornecedores VISÍVEIS, contados no servidor pela view dedicada.
        dbInvoke<{ total_variants: number; total_suppliers: number }>({
          table: 'v_catalog_stats',
          operation: 'select',
          select: 'total_variants,total_suppliers',
          filters: {},
          limit: 1,
          offset: 0,
        }),
        dbInvoke<{ id: string; name: string }>({
          table: 'categories',
          operation: 'select',
          select: 'id,name',
          filters: { active: true },
          // Sem teto artificial de 1000 (truncava silenciosamente se as categorias
          // crescessem além disso). 5000 cobre folgadamente o catálogo atual (~477)
          // e o filtro de padrões ocultos continua client-side (fonte única).
          limit: 5000,
          offset: 0,
          countMode: 'exact',
        }),
      ]);

      // Variações + fornecedores: leitura direta da view (já filtrada por visibilidade).
      const stats = statsResult.records?.[0];
      const totalVariants = Number(stats?.total_variants ?? 0);
      const totalSuppliers = Number(stats?.total_suppliers ?? 0);

      // Categorias: filtra as ocultas a partir dos registros.
      const visible = categoriesResult.records.filter((c) => !isHiddenCategory(c.name || ''));
      const totalCategories = visible.length;

      return { totalVariants, totalCategories, totalSuppliers };
    },
    // FIX 2026-06-18: staleTime mantido em 30min (stats aggregate mudam lentamente).
    // retry: 1 (era 2) — view é rápida; 1 retry é suficiente para falha transitória.
    // refetchOnWindowFocus: true — garante freshness pós-pipeline ao retornar ao tab.
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
