/**
 * useNovelties — Hooks de novidades (produtos sinalizados como is_new pela pipeline DB).
 * Tipos, constantes e funções puras em `novelty-core.ts` (< 500 LOC cada arquivo).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { handleQueryError } from '@/lib/supabase-direct';
import {
  fromTable,
  MS_PER_DAY,
  NOVELTY_SELECT,
  NOVELTY_EXPIRING_SOON_DAYS,
  applyNoveltyPredicate,
  calcDaysRemaining,
  enrichNovelties,
  toNovelty,
  type NoveltyWithDetails,
  type NoveltyStatsDisplay,
  type NoveltySupplierBreakdown,
  type RawProduct,
  type UseNoveltiesOptions,
} from './novelty-core';

// Re-exporta tipos e funções para backward-compat:
// componentes importam de '@/hooks/products/useNovelties'
export type {
  NoveltyWithDetails,
  NoveltyStatsDisplay,
  NoveltySupplierBreakdown,
  RawProduct,
  UseNoveltiesOptions,
  NoveltyQuery,
} from './novelty-core';
export { sortNovelties, toNovelty, calcDaysRemaining } from './novelty-core';

/**
 * Hook para buscar novidades — produtos sinalizados como novidade pela pipeline
 * DB (is_new + novelty_expires_at futuro).
 * Aplica filtros de qualidade: não stockout, com imagem, com preço.
 */
export function useNoveltiesWithDetails(options: UseNoveltiesOptions = {}) {
  const { limit, onlyHighlighted = false } = options;

  return useQuery<NoveltyWithDetails[]>({
    queryKey: ['novelties-details', limit ?? 'all', onlyHighlighted],
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      // FIX (auditoria Novidades, P1-B): paginacao completa. `limit`, quando
      // informado, atua como teto opcional para previews (home/sidebar).
      // FIX (P0): pertinência via pipeline (is_new + novelty_expires_at > now),
      // não mais janela de created_at.
      const PAGE = 1000;
      const MAX_PAGES = 25; // anti-loop: teto ~25k
      const hardCap = typeof limit === 'number' ? limit : Number.POSITIVE_INFINITY;
      const records: RawProduct[] = [];
      let from = 0;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const want = Math.min(PAGE, hardCap - records.length);
        if (want <= 0) break;
        const { data, error } = await applyNoveltyPredicate(
          fromTable('products').select(NOVELTY_SELECT),
          nowIso,
        )
          .order('novelty_detected_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + want - 1);
        if (error) return handleQueryError('useNovelties', 'products', error);
        const rows = (data ?? []) as unknown as RawProduct[];
        records.push(...rows);
        from += rows.length;
        // ISSUE-6 FIX: para quando atingiu o hardCap exato — evita uma página
        // extra desnecessária quando a última página preenche exatamente `want`.
        if (records.length >= hardCap) break;
        // Para em página vazia OU página incompleta (ambos indicam fim dos dados).
        if (rows.length < want) break;
      }

      let novelties = records.map(toNovelty).filter((n) => n.is_active);

      if (onlyHighlighted) {
        novelties = novelties.filter((n) => n.is_highlighted);
      }

      return enrichNovelties(novelties);
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook para buscar novidades expirando em breve (≤ maxDays restantes).
 * Aplica filtros de qualidade: não stockout, com imagem, com preço.
 */
export function useExpiringNovelties(maxDays = 7) {
  return useQuery<NoveltyWithDetails[]>({
    queryKey: ['expiring-novelties', maxDays],
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      // Busca paginada — sem hardcap para não perder produtos expirando
      const PAGE_SIZE = 500;
      // ISSUE-8 FIX: guarda anti-loop — 100 páginas × 500 = 50k novidades max.
      // Sem esse limite, se novelty_expires_at for null em todas as linhas o early-exit
      // nunca dispara e o while(true) vira loop infinito até timeout do cliente.
      const MAX_PAGES = 100;
      const allRaw: RawProduct[] = [];
      let offset = 0;
      let page = 0;
      while (page < MAX_PAGES) {
        page++;
        const { data, error } = await applyNoveltyPredicate(
          fromTable('products').select(NOVELTY_SELECT),
          nowIso,
        )
          .order('novelty_expires_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) return handleQueryError('useNovelties', 'products', error);
        const rows = (data ?? []) as unknown as RawProduct[];
        allRaw.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        // early exit: todos os restantes têm novelty_expires_at além de maxDays
        // ISSUE-10 FIX: guarda contra novelty_expires_at null — new Date(null).getTime()
        // = 0 (1970), que faria a comparação NaN e desabilitaria o early-exit,
        // causando loop infinito até MAX_PAGES. Só quebra quando a data é válida.
        const lastRow = rows[rows.length - 1] as RawProduct & { novelty_expires_at?: string };
        if (lastRow?.novelty_expires_at) {
          const expTime = new Date(lastRow.novelty_expires_at).getTime();
          if (!Number.isNaN(expTime)) {
            const daysLeft = (expTime - Date.now()) / (1000 * 60 * 60 * 24);
            if (daysLeft > maxDays) break;
          }
        }
        offset += PAGE_SIZE;
      }

      return (
        allRaw
          .map(toNovelty)
          // is_active is re-derived in toNovelty from the live timestamp, so a row that
          // expires between query build and mapping can come back is_active=false with
          // days_remaining=0; keep the guard so an already-expired item is not shown.
          .filter((n) => n.is_active && n.days_remaining <= maxDays)
          .sort((a, b) => a.days_remaining - b.days_remaining)
      );
    },
    // ISSUE-40 FIX: expiração iminente — staletime curto garante que um produto
    // que cruzou o limite de `maxDays` saia do widget antes do cleanup cron rodar.
    staleTime: 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook para estatísticas de novidades — HEAD counts server-side (6 queries paralelas)
 * + supplier breakdown derivado do cache compartilhado de useNoveltiesWithDetails.
 *
 * ISSUE-9 FIX: o loop de paginação de fornecedores (até 25 páginas × 1000 linhas
 * = 25k rows) foi removido. O ranking agora é computado client-side a partir do
 * dataset já enriquecido em ['novelties-details','all',false], eliminando:
 *  - o teto artificial de 25k produtos;
 *  - as 1–25 requisições sequenciais extras ao banco;
 *  - a segunda query de nomes de fornecedores (join após agrupamento).
 * Os nomes já vêm via enrichNovelties() e o agrupamento é O(n) em memória.
 */
export function useNoveltyStats() {
  // Reusa o dataset enriquecido já carregado (cache key ['novelties-details','all',false]).
  // Se o cache estiver vazio, allNovelties será undefined — o breakdown fica [].
  const { data: allNovelties } = useNoveltiesWithDetails();

  // GROUP BY supplier_id client-side — O(n) sobre o dataset em memória.
  const supplierBreakdown = useMemo<NoveltySupplierBreakdown[]>(() => {
    if (!allNovelties || allNovelties.length === 0) return [];
    const countMap = new Map<string, { id: string; name: string; count: number }>();
    for (const n of allNovelties) {
      if (!n.supplier_id) continue;
      const entry = countMap.get(n.supplier_id);
      if (entry) {
        entry.count++;
      } else {
        countMap.set(n.supplier_id, {
          id: n.supplier_id,
          name: n.supplier_name ?? `…${n.supplier_id.slice(-4)}`,
          count: 1,
        });
      }
    }
    const total = allNovelties.length;
    return [...countMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((s) => ({
        ...s,
        percentage: total > 0 ? Math.round((s.count / total) * 100) : 0,
      }));
  }, [allNovelties]);

  const query = useQuery<
    Omit<NoveltyStatsDisplay, 'supplierBreakdown' | 'topSupplierName' | 'topSupplierCount'>
  >({
    queryKey: ['novelty-stats'],
    queryFn: async () => {
      const now = new Date();
      const nowIso = now.toISOString();
      // ISSUE-25 FIX: janelas de "chegada" em UTC — evita off-by-one quando o
      // cliente está em fuso UTC+N e a meia-noite local cruza o dia UTC anterior.
      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      ).toISOString();
      const weekStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6),
      ).toISOString();
      const fifteenStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 14),
      ).toISOString();
      const expiringSoonLimit = new Date(
        now.getTime() + NOVELTY_EXPIRING_SOON_DAYS * MS_PER_DAY,
      ).toISOString();

      const emptyBase = {
        totalNovelties: 0,
        activeNovelties: 0,
        expiringSoon: 0,
        totalProducts: 0,
        noveltyRate: 0,
        arrivedToday: 0,
        arrivedThisWeek: 0,
        arrivedLast15Days: 0,
      };

      // Helper: query base de NOVIDADE (pipeline + qualidade) para HEAD counts.
      const noveltyBase = () =>
        applyNoveltyPredicate(
          fromTable('products').select('id', { count: 'exact', head: true }),
          nowIso,
        );

      const [todayRes, weekRes, fifteenRes, activeRes, expiringSoonRes, totalRes] =
        await Promise.all([
          noveltyBase().gte('novelty_detected_at', todayStart),
          noveltyBase().gte('novelty_detected_at', weekStart),
          noveltyBase().gte('novelty_detected_at', fifteenStart),
          noveltyBase(),
          noveltyBase().lte('novelty_expires_at', expiringSoonLimit),
          fromTable('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ]);

      if (todayRes.error) {
        handleQueryError('useNovelties', 'products', todayRes.error);
        return emptyBase;
      }
      if (weekRes.error) {
        handleQueryError('useNovelties', 'products', weekRes.error);
        return emptyBase;
      }
      if (fifteenRes.error) {
        handleQueryError('useNovelties', 'products', fifteenRes.error);
        return emptyBase;
      }
      if (activeRes.error) {
        handleQueryError('useNovelties', 'products', activeRes.error);
        return emptyBase;
      }
      if (totalRes.error) {
        handleQueryError('useNovelties', 'products', totalRes.error);
        return emptyBase;
      }

      const activeCount = activeRes.count ?? 0;
      const totalProducts = totalRes.count ?? 0;

      return {
        totalNovelties: activeCount,
        activeNovelties: activeCount,
        expiringSoon: expiringSoonRes.error ? 0 : (expiringSoonRes.count ?? 0),
        totalProducts,
        noveltyRate: totalProducts > 0 ? Math.round((activeCount / totalProducts) * 100) : 0,
        arrivedToday: todayRes.count ?? 0,
        arrivedThisWeek: weekRes.count ?? 0,
        arrivedLast15Days: fifteenRes.count ?? 0,
      };
    },
    // ISSUE-40 FIX: stats alinhadas ao staleTime de useNoveltiesWithDetails (2 min).
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  // Mescla contagens do servidor com breakdown computado do cache.
  const data = useMemo<NoveltyStatsDisplay | undefined>(() => {
    if (!query.data) return undefined;
    const top = supplierBreakdown[0];
    return {
      ...query.data,
      topSupplierName: top?.name ?? null,
      topSupplierCount: top?.count ?? 0,
      supplierBreakdown,
    };
  }, [query.data, supplierBreakdown]);

  return { ...query, data };
}

/**
 * Hook para buscar novidades via interface simplificada.
 * Aplica filtros de qualidade: não stockout, com imagem, com preço.
 */
export function useNovelties(
  options: UseNoveltiesOptions & { supplierCode?: string; maxDays?: number } = {},
) {
  const { supplierCode, limit = 50, maxDays } = options;

  return useQuery({
    queryKey: ['novelties-rpc', supplierCode, limit, maxDays],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      let supplierId: string | undefined;

      if (supplierCode) {
        const { data: supData, error: supError } = await fromTable('suppliers')
          .select('id')
          .eq('code', supplierCode)
          .range(0, 0);
        if (supError) return handleQueryError('useNovelties', 'suppliers', supError);
        if (supData && supData.length > 0) {
          supplierId = (supData[0] as unknown as { id: string }).id;
        }
      }

      let query = applyNoveltyPredicate(fromTable('products').select(NOVELTY_SELECT), nowIso)
        .order('novelty_detected_at', { ascending: false })
        .order('id', { ascending: true })
        .range(0, limit - 1);

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;
      if (error) return handleQueryError('useNovelties', 'products', error);

      let novelties = ((data ?? []) as unknown as RawProduct[])
        .map(toNovelty)
        .filter((n) => n.is_active);

      // maxDays = "detectadas há no máximo N dias" (idade da novidade).
      if (maxDays) {
        novelties = novelties.filter((n) => n.days_as_novelty <= maxDays);
      }

      return novelties;
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook para contar total de novidades ativas.
 * Aplica filtros de qualidade: não stockout, com imagem, com preço.
 */
export function useNoveltyCount() {
  return useQuery<number>({
    queryKey: ['novelty-count'],
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      const { count, error } = await applyNoveltyPredicate(
        fromTable('products').select('id', { count: 'exact' }),
        nowIso,
      ).range(0, 0);
      if (error) {
        handleQueryError('useNovelties', 'products', error);
        return 0;
      }

      return count || 0;
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Verifica se um produto específico é novidade.
 * Respeita os filtros de qualidade: o produto deve estar ativo,
 * não ser stockout, ter imagem e ter preço definido.
 */
export function useIsProductNovelty(productId: string) {
  return useQuery<{ isNovelty: boolean; daysRemaining: number | null }>({
    queryKey: ['is-novelty', productId],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await applyNoveltyPredicate(
        fromTable('products').select('id, novelty_expires_at'),
        nowIso,
      )
        .eq('id', productId)
        .range(0, 0);
      if (error) {
        handleQueryError('useNovelties', 'products', error);
        return { isNovelty: false, daysRemaining: null };
      }

      const rows = (data ?? []) as unknown as { id: string; novelty_expires_at: string }[];
      if (rows.length === 0) {
        return { isNovelty: false, daysRemaining: null };
      }

      const daysRemaining = calcDaysRemaining(rows[0].novelty_expires_at);
      return {
        isNovelty: daysRemaining > 0,
        daysRemaining: daysRemaining > 0 ? daysRemaining : null,
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!productId,
  });
}

/**
 * Hook para buscar IDs de produtos que são novidades (batch checking de badges).
 * Aplica filtros de qualidade: exclui stockout, sem imagem e sem preço.
 * Alinha o badge do card com o que a pipeline DB considera novidade.
 */
export function useNoveltyProductIds() {
  return useQuery<Set<string>>({
    queryKey: ['novelty-product-ids'],
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      // BUGFIX (audit 200-commits, P1-1): substitui o cap silencioso .range(0,1999)
      // por paginacao completa. O PostgREST pode aplicar db-max-rows (~1000), entao
      // pedir 2000 numa tacada poderia truncar novidades em bursts de ingestao.
      const PAGE = 1000;
      const MAX_PAGES = 50; // guarda anti-loop: teto de 50k novidades
      const ids = new Set<string>();
      // HARDENING: avanca pelo nro real de linhas e para em pagina vazia.
      // db-max-rows medido = 1000 em prod; isto torna a paginacao robusta a
      // QUALQUER teto do servidor, sem depender do acoplamento PAGE == teto.
      let from = 0;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const { data, error } = await applyNoveltyPredicate(
          fromTable('products').select('id'),
          nowIso,
        )
          .order('id', { ascending: true }) // ordenacao estavel p/ paginacao deterministica
          .range(from, from + PAGE - 1);
        if (error) {
          handleQueryError('useNovelties', 'products', error);
          break;
        }
        const rows = (data ?? []) as unknown as { id: string }[];
        for (const r of rows) ids.add(r.id);
        from += rows.length;
        if (rows.length === 0) break; // fim dos resultados
      }

      return ids;
    },
    staleTime: 2 * 60 * 1000,
  });
}
