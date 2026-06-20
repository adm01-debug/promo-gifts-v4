import { getCatalogStockStatus } from '@/lib/catalog-stock-status';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveTable, handleQueryError } from '@/lib/supabase-direct';
import { untypedFrom } from '@/lib/supabase-untyped';
import { compareNamePtBR } from '@/utils/product-sorting';
import { logger } from '@/lib/logger';
const fromTable = (table: string) => untypedFrom(resolveTable(table));

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// FIX (auditoria Novidades 2026-06-18, P0): a fonte da verdade de "novidade" é a
// PIPELINE do banco (colunas `is_new` / `novelty_detected_at` /
// `novelty_expires_at`, mantidas pelo trigger fn_set_product_as_new + cron
// cleanup-novelties), e NÃO uma janela de 30 dias derivada de `created_at`.
// A implementação anterior usava `created_at + 30d`, o que: (1) ocultava ~16%
// das novidades reais — produtos detectados como novidade DEPOIS de criados no
// catálogo (lag médio de ~21 dias, até 132); (2) media a idade do badge a partir
// da criação no catálogo, não da detecção como novidade.
//
// A janela do trigger DB (fn_set_product_as_new) é de 30 dias. A UX (badge
// "Novidade X dias", faixas de cor, destaque "recém-chegado") permanece ancorada
// em DETECÇÃO recente, fiel ao dado: toda novidade ativa foi detectada há ≤ 30d.
const NOVELTY_DISPLAY_WINDOW_DAYS = 30; // fallback quando novelty_expires_at vier nulo
const NOVELTY_FRESH_DAYS = 5; // "recém-chegado" = detectado há ≤ 5 dias
const NOVELTY_EXPIRING_SOON_DAYS = 7; // "expirando" = expira em ≤ 7 dias

const NOVELTY_SELECT =
  'id, name, sku, primary_image_url, set_image_url, sale_price, category_id, supplier_id, created_at, stock_quantity, min_quantity, is_new, novelty_detected_at, novelty_expires_at';

/**
 * Filtros de qualidade aplicados a TODOS os hooks de novidades.
 * - is_stockout=false  → produto em stockout não é novidade
 * - sale_price > 0     → produto sem preço não aparece como novidade
 * - primary_image_url  → produto sem imagem não aparece como novidade
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase filter builder after .select(); ReturnType<...['select']> hits TS2589.
type NoveltyQuery = any;

const applyNoveltyQualityFilters = (query: NoveltyQuery): NoveltyQuery =>
  query
    .eq('is_stockout', false)
    .not('primary_image_url', 'is', null)
    .gt('sale_price', 0) as NoveltyQuery;

/**
 * Predicado de PERTINÊNCIA de novidade (fonte da verdade = pipeline DB).
 * Um produto ativo é novidade enquanto a flag `is_new` estiver ligada E a data
 * de expiração for futura. Combinar ambos torna o resultado:
 *  - respeitoso a remoções manuais (admin desliga `is_new`);
 *  - auto-corretivo entre execuções do cron (`novelty_expires_at > now`
 *    descarta flags vencidas mesmo antes do `cleanup-novelties` rodar).
 * Os filtros de qualidade continuam aplicados.
 */
const applyNoveltyPredicate = (query: NoveltyQuery, nowIso: string): NoveltyQuery =>
  applyNoveltyQualityFilters(query.eq('is_active', true))
    .eq('is_new', true)
    .gt('novelty_expires_at', nowIso);

/**
 * Dias restantes como novidade — derivado da expiração REAL da pipeline.
 * Clampa em 0 (nunca negativo).
 */
function calcDaysRemaining(expiresAt: string | null | undefined): number {
  if (!expiresAt) return 0;
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return 0;
  const ms = exp - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / MS_PER_DAY);
}

/**
 * Dias decorridos desde a DETECÇÃO como novidade (idade do badge "Novidade X
 * dias"). Guard contra datas no futuro (elapsed < 0 → 0).
 */
function calcDaysAsNovelty(detectedAt: string | null | undefined): number {
  if (!detectedAt) return 0;
  const det = new Date(detectedAt).getTime();
  if (Number.isNaN(det)) return 0;
  const elapsed = Math.floor((Date.now() - det) / MS_PER_DAY);
  return elapsed < 0 ? 0 : elapsed;
}

/**
 * Interface para novidade com dados do produto externo
 */
export interface NoveltyWithDetails {
  novelty_id: string;
  product_id: string;
  product_sku: string | null;
  product_name: string;
  product_description: string | null;
  base_price: number | null;
  product_image: string | null;
  product_set_image: string | null;
  category_id: string | null;
  category_name: string | null;
  supplier_code: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_product_code: string | null;
  detected_at: string;
  expires_at: string;
  days_remaining: number;
  /** Dias decorridos desde a detecção como novidade (idade do badge). */
  days_as_novelty: number;
  status: 'active' | 'expiring_soon' | 'expired';
  is_highlighted: boolean;
  is_active: boolean;
  stock_quantity: number;
  min_quantity: number;
  stock_status: 'in-stock' | 'low-stock' | 'out-of-stock';
}

/**
 * Interface normalizada para exibição de estatísticas
 */
export interface NoveltyStatsDisplay {
  totalNovelties: number;
  activeNovelties: number;
  expiringSoon: number;
  totalProducts: number;
  noveltyRate: number;
  /** Arrival-focused stats */
  arrivedToday: number;
  arrivedThisWeek: number;
  arrivedLast15Days: number;
  topSupplierName: string | null;
  topSupplierCount: number;
  /** Ranking de fornecedores das novidades (server-side, conjunto completo). */
  supplierBreakdown: NoveltySupplierBreakdown[];
}

/** Item do ranking "Por Fornecedor" exibido na sidebar de Novidades. */
export interface NoveltySupplierBreakdown {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export interface RawProduct {
  id: string;
  name: string;
  sku: string | null;
  primary_image_url: string | null;
  set_image_url?: string | null;
  sale_price: number | null;
  category_id: string | null;
  supplier_id: string | null;
  created_at: string;
  stock_quantity: number | null;
  min_quantity: number | null;
  is_new?: boolean | null;
  novelty_detected_at?: string | null;
  novelty_expires_at?: string | null;
}

interface CategoryRecord {
  id: string;
  name: string;
}
interface SupplierRecord {
  id: string;
  name: string;
  code?: string;
}

/**
 * Enriquece novidades com nomes de categoria e fornecedor
 */
async function enrichNovelties(novelties: NoveltyWithDetails[]): Promise<NoveltyWithDetails[]> {
  const categoryIds = [...new Set(novelties.map((n) => n.category_id).filter(Boolean))] as string[];
  const supplierIds = [...new Set(novelties.map((n) => n.supplier_id).filter(Boolean))] as string[];

  // ISSUE-12 FIX: falha de enriquecimento não derruba o grid todo. Erros nas
  // queries secundárias (categories/suppliers) retornam [] — as novidades são
  // exibidas sem nome de categoria/fornecedor em vez de mostrar a tela de erro.
  const [catRecords, supRecords] = await Promise.all([
    categoryIds.length > 0
      ? (async () => {
          try {
            const { data, error } = await fromTable('categories')
              .select('id, name')
              .in('id', categoryIds);
            if (error) {
              logger.warn('[enrichNovelties] categories lookup failed:', error.message);
              return [] as CategoryRecord[];
            }
            return (data ?? []) as unknown as CategoryRecord[];
          } catch {
            return [] as CategoryRecord[];
          }
        })()
      : Promise.resolve([] as CategoryRecord[]),
    supplierIds.length > 0
      ? (async () => {
          try {
            const { data, error } = await fromTable('suppliers')
              .select('id, name, code')
              .in('id', supplierIds);
            if (error) {
              logger.warn('[enrichNovelties] suppliers lookup failed:', error.message);
              return [] as SupplierRecord[];
            }
            return (data ?? []) as unknown as SupplierRecord[];
          } catch {
            return [] as SupplierRecord[];
          }
        })()
      : Promise.resolve([] as SupplierRecord[]),
  ]);

  const catMap = new Map(catRecords.map((c) => [c.id, c.name]));
  const supMap = new Map(supRecords.map((s) => [s.id, { name: s.name, code: s.code }]));

  return novelties.map((n) => ({
    ...n,
    category_name: (n.category_id && catMap.get(n.category_id)) || null,
    supplier_name: (n.supplier_id && supMap.get(n.supplier_id)?.name) || null,
    supplier_code: (n.supplier_id && supMap.get(n.supplier_id)?.code) || null,
  }));
}

/**
 * Converte produto cru em NoveltyWithDetails usando os sinais da pipeline DB.
 * - `detected_at`  = novelty_detected_at (fallback created_at)
 * - `expires_at`   = novelty_expires_at  (fallback detected + janela display)
 * - `days_remaining` (REAL) = dias até a expiração da pipeline
 * - `days_as_novelty`       = dias desde a detecção (idade do badge)
 */
export function toNovelty(p: RawProduct): NoveltyWithDetails {
  // ISSUE-1 FIX: guard null created_at. If both novelty_detected_at and
  // created_at are null/undefined (should not happen in prod but seen in
  // test fixtures), fallback to now to avoid new Date(null) → 1970 date.
  const detectedAt = p.novelty_detected_at ?? p.created_at ?? new Date().toISOString();
  const expiresAt =
    p.novelty_expires_at ??
    new Date(
      new Date(detectedAt).getTime() + NOVELTY_DISPLAY_WINDOW_DAYS * MS_PER_DAY,
    ).toISOString();

  const daysRemaining = calcDaysRemaining(expiresAt);
  const daysAsNovelty = calcDaysAsNovelty(detectedAt);
  const stock = p.stock_quantity ?? 0;
  const minQty = p.min_quantity ?? 10;
  // FIX (2026-06-20): min_quantity é o mínimo PEDÍVEL, não o limiar de low-stock.
  // Antes passado como 2º arg (lowStockThreshold) → estoque positivo abaixo do
  // mínimo aparecia como "low-stock" (pedível) em vez de "out-of-stock". Agora vai
  // ao 3º arg da SSOT (order-gate), alinhando Novidades ao catálogo principal.
  // Passamos o valor BRUTO (não o default 10): ausência de min = sem gate.
  const stockStatus: NoveltyWithDetails['stock_status'] = getCatalogStockStatus(
    stock,
    undefined,
    p.min_quantity,
  );

  return {
    novelty_id: p.id,
    product_id: p.id,
    product_sku: p.sku,
    product_name: p.name,
    product_description: null,
    base_price: p.sale_price,
    product_image: p.primary_image_url,
    product_set_image: p.set_image_url ?? null,
    category_id: p.category_id,
    category_name: null,
    supplier_code: null,
    supplier_id: p.supplier_id,
    supplier_name: null,
    supplier_product_code: null,
    detected_at: detectedAt,
    expires_at: expiresAt,
    days_remaining: daysRemaining,
    days_as_novelty: daysAsNovelty,
    status:
      daysRemaining <= 0
        ? 'expired'
        : daysRemaining <= NOVELTY_EXPIRING_SOON_DAYS
          ? 'expiring_soon'
          : 'active',
    // "Recém-chegado": detectado há poucos dias (não derivado da expiração, que
    // reflete a janela de 30 dias do trigger fn_set_product_as_new).
    is_highlighted: daysAsNovelty <= NOVELTY_FRESH_DAYS,
    is_active: daysRemaining > 0,
    stock_quantity: stock,
    min_quantity: minQty,
    stock_status: stockStatus,
  };
}

/**
 * Ordena novidades pelos campos REAIS de NoveltyWithDetails.
 * ISSUE-4 FIX: não-mutante — cria cópia com spread antes de ordenar, assim o
 * caller não precisa passar um array descartável. Alinha o comportamento com
 * sortProducts (não-mutante desde PR #915).
 *
 * FIX (auditoria Novidades 2026-06-18, P1): o grid antes fazia
 * `sortProducts(novelties as unknown as Product[])`, mas as formas divergem
 * (`product_name`≠`name`, `base_price`≠`price`, `detected_at`≠`created_at`),
 * então TODAS as ordenações eram no-op silencioso — "Mais recentes" caía em A-Z.
 */
export function sortNovelties(
  novelties: NoveltyWithDetails[],
  sortBy: string,
): NoveltyWithDetails[] {
  const sorted = [...novelties]; // ISSUE-4: cópia para não mutar o original

  const byNameThenId = (a: NoveltyWithDetails, b: NoveltyWithDetails): number => {
    const byName = compareNamePtBR(a.product_name, b.product_name);
    if (byName !== 0) return byName;
    return a.product_id < b.product_id ? -1 : a.product_id > b.product_id ? 1 : 0;
  };

  switch (sortBy) {
    case 'newest': {
      // ISSUE-3 FIX: Schwartzian transform — pré-computa getTime() uma vez por item
      // (O(n)) em vez de criar new Date() dentro do comparador (O(n log n) alocações).
      const withTs = sorted.map((n) => [n, new Date(n.detected_at).getTime()] as const);
      withTs.sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : byNameThenId(a[0], b[0])));
      return withTs.map(([n]) => n);
    }
    case 'name':
    case 'name-asc':
      sorted.sort(byNameThenId);
      break;
    case 'name-desc':
      sorted.sort((a, b) => byNameThenId(b, a));
      break;
    case 'price-asc':
      sorted.sort((a, b) => {
        const d = (a.base_price ?? 0) - (b.base_price ?? 0);
        return d !== 0 ? d : byNameThenId(a, b);
      });
      break;
    case 'price-desc':
      sorted.sort((a, b) => {
        const d = (b.base_price ?? 0) - (a.base_price ?? 0);
        return d !== 0 ? d : byNameThenId(a, b);
      });
      break;
    case 'stock':
      sorted.sort((a, b) => {
        const d = (b.stock_quantity ?? 0) - (a.stock_quantity ?? 0);
        return d !== 0 ? d : byNameThenId(a, b);
      });
      break;
    default:
      // Valor desconhecido → no-op (preserva ordem), igual a sortProducts.
      break;
  }
  return sorted;
}

export interface UseNoveltiesOptions {
  limit?: number;
  offset?: number;
  onlyHighlighted?: boolean;
}

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
        // causando loop infinito até SUP_MAX_PAGES. Só quebra quando a data é válida.
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

      return allRaw
        .map(toNovelty)
        .filter((n) => n.days_remaining <= maxDays) // is_active já garantido pelo predicado DB
        .sort((a, b) => a.days_remaining - b.days_remaining);
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
