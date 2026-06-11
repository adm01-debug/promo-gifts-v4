/**
 * Categoria-FOLHA (mais profunda) de produtos — hook + provider batch.
 *
 * O catálogo lightweight só traz `category_id`/`main_category_id`, que frequentemente
 * apontam para a raiz ou um nó intermediário (≈57% dos produtos). A categoria que o
 * usuário quer ver é a FOLHA — a mais específica em que o produto se encaixa
 * (filha/neta/bisneta…), derivada de `product_category_assignments`.
 *
 * Arquitetura: acesso PostgREST NATIVO ao banco oficial `pqpdolkaeqlyzpdpbizo`
 * (EXTERNAL_PROMOBRIND_URL/external-db-bridge foi descontinuado — operamos direto no
 * banco para evitar latência). UMA query batch nos assignments + UMA nos metadados de
 * categoria, em vez de N+1 por card. O desempate de folha (≥2 categorias no mesmo nível
 * máximo, ~686 produtos) é determinístico: maior level → is_primary → display_order → nome.
 *
 * Fallback: em erro/RLS, o Map fica vazio e o consumidor mantém o comportamento atual
 * (category_id || main_category_id) — degradação suave, sem quebrar a listagem.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { untypedFrom } from '@/lib/supabase-untyped';
import { logger } from '@/lib/logger';

export interface LeafCategory {
  id: string;
  name: string;
  level: number;
  /** Caminho raiz→folha (ex.: ["Cadernetas", "…", "Com Pauta"]) para tooltip/breadcrumb. */
  path: string[];
}

export type LeafCategoryMap = ReadonlyMap<string, LeafCategory>;

// Limite de itens por cláusula IN para evitar URLs/queries gigantes no PostgREST.
const CHUNK_SIZE = 300;

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

/** Monta o caminho raiz→folha de uma categoria, subindo por parent_id (com guarda anti-ciclo). */
function buildPath(leafId: string, catById: ReadonlyMap<string, CategoryMetaRow>): string[] {
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
  return names.reverse(); // raiz → folha
}

/**
 * Escolhe a folha de cada produto a partir dos assignments + metadados de categoria.
 * Desempate: maior level → is_primary DESC → display_order ASC → name ASC.
 * Exportada para teste unitário do desempate.
 */
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

async function fetchLeaves(productIds: string[]): Promise<Map<string, LeafCategory>> {
  // 1) Assignments (N:N) dos produtos — PostgREST nativo, em chunks.
  const assignments: AssignmentRow[] = [];
  for (const ids of chunk(productIds, CHUNK_SIZE)) {
    const { data, error } = await untypedFrom<AssignmentRow>('product_category_assignments')
      .select('product_id, category_id, is_primary, display_order')
      .in('product_id', ids);
    if (error) throw new Error(error.message);
    if (data) assignments.push(...(data as AssignmentRow[]));
  }
  if (assignments.length === 0) return new Map();

  // 2) Metadados das categorias referenciadas + seus ANCESTRAIS (para montar o caminho).
  //    Carrega em "ondas": começa pelas categorias dos assignments e sobe pelos parent_id
  //    que ainda não temos, até cobrir todas as raízes (hierarquia real tem ≤6 níveis).
  const catById = new Map<string, CategoryMetaRow>();
  let pending = [...new Set(assignments.map((a) => a.category_id).filter(Boolean))];
  let guard = 0;
  while (pending.length > 0 && guard < 10) {
    guard += 1;
    for (const ids of chunk(pending, CHUNK_SIZE)) {
      const { data, error } = await untypedFrom<CategoryMetaRow>('categories')
        .select('id, name, level, parent_id')
        .in('id', ids);
      if (error) throw new Error(error.message);
      (data as CategoryMetaRow[] | null)?.forEach((c) => catById.set(c.id, c));
    }
    // Próxima onda: parents ainda não carregados.
    pending = [
      ...new Set(
        [...catById.values()]
          .map((c) => c.parent_id)
          .filter((pid): pid is string => !!pid && !catById.has(pid)),
      ),
    ];
  }

  return pickLeaves(assignments, catById);
}

/**
 * Resolve as categorias-folha de uma lista de produtos (batch nativo + cache).
 * Retorna um Map vazio enquanto carrega ou em caso de erro (fallback transparente).
 */
export function useProductLeafCategories(productIds: readonly string[]): {
  leafById: LeafCategoryMap;
  isLoading: boolean;
} {
  // Chave estável: ids únicos e ordenados.
  const uniqueSorted = useMemo(() => [...new Set(productIds.filter(Boolean))].sort(), [productIds]);

  const query = useQuery({
    queryKey: ['product-leaf-categories', uniqueSorted],
    enabled: uniqueSorted.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Map<string, LeafCategory>> => {
      try {
        return await fetchLeaves(uniqueSorted);
      } catch (err) {
        // Fallback suave: sem folha, o consumidor usa category_id || main_category_id.
        logger.warn('[useProductLeafCategories] falha ao resolver folhas; usando fallback', err);
        return new Map<string, LeafCategory>();
      }
    },
  });

  return {
    leafById: query.data ?? new Map<string, LeafCategory>(),
    isLoading: query.isLoading,
  };
}

// ---------- Provider (evita prop-drilling em grids/listas) ----------

const LeafCategoryCtx = createContext<LeafCategoryMap>(new Map());

/**
 * Envolve uma lista/grade de produtos. Resolve as folhas em lote para os IDs dados
 * e as disponibiliza aos cards via `useLeafCategory(productId)`.
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
