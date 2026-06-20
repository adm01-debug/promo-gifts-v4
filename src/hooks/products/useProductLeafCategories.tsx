/**
 * Categoria-FOLHA (mais profunda) de produtos — hook + provider batch.
 *
 * FIX BUG-C (2026-06-18): substituída a abordagem de batched GETs com
 * cláusulas IN (300 UUIDs → URLs > 11 KB, risco 414) + "wave queries" de
 * categories (até 10 rounds), por uma única chamada à RPC
 * fn_get_all_leaf_categories() que retorna TODAS as 7 574 folhas de uma vez.
 *
 * Nova arquitetura:
 *   - useGlobalLeafCategories: RPC → Map global por sessão (staleTime=Infinity)
 *   - useProductLeafCategories: lê do Map global — zero queries adicionais
 *   - ProductLeafCategoryProvider: passa o subconjunto de produto IDs ao contexto
 *
 * Mantido: pickLeaves() exportado para retrocompatibilidade com testes unitários.
 * Mantido: buildPath() exportado para uso em breadcrumbs futuros.
 * Fallback: em erro de RPC, o Map fica vazio e o consumidor usa category_id (degradação suave).
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface LeafCategory {
  id: string;
  name: string;
  level: number;
  /** Caminho raiz→folha (ex.: ["Cadernetas", "…", "Com Pauta"]) para tooltip/breadcrumb. */
  path: string[];
}

export type LeafCategoryMap = ReadonlyMap<string, LeafCategory>;

// ─── Legado: tipos internos mantidos para pickLeaves() (usado em testes) ──────

interface AssignmentRow {
  product_id: string;
  category_id: string;
  is_primary: boolean | null;
  display_order: number | null;
}

interface CategoryMetaRow {
  id: string;
  name: string;
  level: number | null;
  parent_id: string | null;
}

/** @internal Mantido para teste unitário do desempate. */
export function buildPath(leafId: string, catById: ReadonlyMap<string, CategoryMetaRow>): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let cur: string | null = leafId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node = catById.get(cur);
    if (!node) break;
    names.push(node.name);
    cur = node.parent_id;
  }
  return names.reverse();
}

/** @internal Mantido para teste unitário. */
export function pickLeaves(
  assignments: AssignmentRow[],
  catById: ReadonlyMap<string, CategoryMetaRow>,
): Map<string, LeafCategory> {
  interface Pick {
    catId: string;
    name: string;
    level: number;
    isPrimary: boolean;
    displayOrder: number;
  }
  const best = new Map<string, Pick>();

  for (const a of assignments) {
    const meta = catById.get(a.category_id);
    if (!meta) continue;
    const candidate: Pick = {
      catId: meta.id,
      name: meta.name,
      level: meta.level ?? 0,
      isPrimary: a.is_primary === true,
      displayOrder: a.display_order ?? Number.MAX_SAFE_INTEGER,
    };
    const current = best.get(a.product_id);
    if (!current) {
      best.set(a.product_id, candidate);
      continue;
    }
    const better =
      candidate.level > current.level ||
      (candidate.level === current.level &&
        (candidate.isPrimary !== current.isPrimary
          ? candidate.isPrimary
          : candidate.displayOrder !== current.displayOrder
            ? candidate.displayOrder < current.displayOrder
            : candidate.name.localeCompare(current.name) < 0));
    if (better) best.set(a.product_id, candidate);
  }

  const leaves = new Map<string, LeafCategory>();
  for (const [productId, pick] of best.entries()) {
    leaves.set(productId, {
      id: pick.catId,
      name: pick.name,
      level: pick.level,
      path: buildPath(pick.catId, catById),
    });
  }
  return leaves;
}

// ─── RPC row type ─────────────────────────────────────────────────────────────

interface LeafCategoryRow {
  product_id: string;
  leaf_category_id: string;
  leaf_category_name: string;
  leaf_category_level: number;
  leaf_category_parent_id: string | null;
  leaf_category_slug: string | null;
}

// ─── Query global (uma única chamada RPC por sessão) ──────────────────────────

/**
 * Carrega TODAS as categorias-folha via RPC fn_get_all_leaf_categories().
 * staleTime=Infinity → cache pela duração da sessão, sem refetch automático.
 * Uma única chamada retorna as 7 574 linhas sem o limite de 1 000 do PostgREST.
 */
function useGlobalLeafCategories(): LeafCategoryMap {
  const { data } = useQuery({
    queryKey: ['global-leaf-categories'],
    queryFn: async (): Promise<Map<string, LeafCategory>> => {
      // fn_get_all_leaf_categories é SECURITY DEFINER e não está nos tipos gerados pelo Lovable.
      type AnyRpc = (fn: string) => ReturnType<typeof supabase.rpc>;
      const { data: rpcData, error } = await (supabase.rpc as unknown as AnyRpc)(
        'fn_get_all_leaf_categories',
      );
      if (error) {
        logger.warn('[useProductLeafCategories] RPC falhou; usando fallback vazio', error);
        throw error;
      }
      const rows = (rpcData ?? []) as unknown as LeafCategoryRow[];
      const map = new Map<string, LeafCategory>();
      for (const row of rows) {
        if (!row.product_id || !row.leaf_category_id) continue;
        map.set(row.product_id, {
          id: row.leaf_category_id,
          name: row.leaf_category_name ?? '',
          level: row.leaf_category_level ?? 0,
          path: [], // caminho não disponível na MV — usar breadcrumb separado se necessário
        });
      }
      logger.info(`[useProductLeafCategories] Loaded ${map.size} leaf categories (RPC global)`);
      return map;
    },
    staleTime: Infinity, // mantém em cache toda a sessão
    gcTime: Infinity, // nunca descarta da memória
    refetchOnWindowFocus: false,
    retry: 1,
  });
  return data ?? new Map<string, LeafCategory>();
}

// ─── Hook público ─────────────────────────────────────────────────────────────

/**
 * Resolve as categorias-folha de uma lista de produtos.
 * Lê do cache global (zero queries adicionais após o primeiro render).
 */
export function useProductLeafCategories(productIds: readonly string[]): {
  leafById: LeafCategoryMap;
  isLoading: boolean;
} {
  const globalMap = useGlobalLeafCategories();

  const leafById = useMemo((): LeafCategoryMap => {
    if (globalMap.size === 0 || productIds.length === 0) return globalMap;
    // Subconjunto apenas dos IDs relevantes (evita expor o Map completo ao consumidor)
    const sub = new Map<string, LeafCategory>();
    for (const id of productIds) {
      const leaf = globalMap.get(id);
      if (leaf) sub.set(id, leaf);
    }
    return sub;
  }, [globalMap, productIds]);

  return {
    leafById,
    isLoading: false, // O Map global carrega em background; o consumidor usa fallback enquanto aguarda
  };
}

// ─── Provider (evita prop-drilling em grids/listas) ──────────────────────────

const LeafCategoryCtx = createContext<LeafCategoryMap>(new Map());

/**
 * Envolve uma lista/grade de produtos e disponibiliza as folhas via useLeafCategory().
 * Após o fix BUG-C, este provider não dispara queries adicionais — apenas lê do cache global.
 */
export function ProductLeafCategoryProvider({
  productIds,
  children,
}: {
  productIds: string[];
  children: ReactNode;
}) {
  const { leafById } = useProductLeafCategories(productIds);
  return <LeafCategoryCtx.Provider value={leafById}>{children}</LeafCategoryCtx.Provider>;
}

/** Folha do produto resolvida pelo provider mais próximo (ou undefined em fallback). */
export function useLeafCategory(productId: string | null | undefined): LeafCategory | undefined {
  const map = useContext(LeafCategoryCtx);
  if (!productId) return undefined;
  return map.get(productId);
}
