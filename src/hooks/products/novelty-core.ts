/**
 * novelty-core.ts — Tipos, constantes e funções puras do domínio de Novidades.
 * Separado de useNovelties.ts para manter os hooks < 500 LOC (invariante de
 * arquitetura `mem://architecture/component-refactoring-and-modularity`).
 *
 * Importado apenas por: useNovelties.ts (e opcionalmente por testes unitários).
 * Não importar diretamente do produto — usar `@/hooks/products/useNovelties`.
 */
import { getCatalogStockStatus } from '@/lib/catalog-stock-status';
import { resolveTable } from '@/lib/supabase-direct';
import { untypedFrom } from '@/lib/supabase-untyped';
import { compareNamePtBR } from '@/utils/product-sorting';
import { logger } from '@/lib/logger';

export const fromTable = (table: string) => untypedFrom(resolveTable(table));

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
export const NOVELTY_DISPLAY_WINDOW_DAYS = 30; // fallback quando novelty_expires_at vier nulo
export const NOVELTY_FRESH_DAYS = 5; // "recém-chegado" = detectado há ≤ 5 dias
export const NOVELTY_EXPIRING_SOON_DAYS = 7; // "expirando" = expira em ≤ 7 dias

export const NOVELTY_SELECT =
  'id, name, sku, primary_image_url, set_image_url, sale_price, category_id, supplier_id, created_at, stock_quantity, min_quantity, is_new, novelty_detected_at, novelty_expires_at';

/**
 * Filtros de qualidade aplicados a TODOS os hooks de novidades.
 * - is_stockout=false  → produto em stockout não é novidade
 * - sale_price > 0     → produto sem preço não aparece como novidade
 * - primary_image_url  → produto sem imagem não aparece como novidade
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase filter builder after .select(); ReturnType<...['select']> hits TS2589.
export type NoveltyQuery = any;

export const applyNoveltyQualityFilters = (query: NoveltyQuery): NoveltyQuery =>
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
export const applyNoveltyPredicate = (query: NoveltyQuery, nowIso: string): NoveltyQuery =>
  applyNoveltyQualityFilters(query.eq('is_active', true))
    .eq('is_new', true)
    .gt('novelty_expires_at', nowIso);

/**
 * Dias restantes como novidade — derivado da expiração REAL da pipeline.
 * Clampa em 0 (nunca negativo).
 */
export function calcDaysRemaining(expiresAt: string | null | undefined): number {
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
export function calcDaysAsNovelty(detectedAt: string | null | undefined): number {
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
export async function enrichNovelties(
  novelties: NoveltyWithDetails[],
): Promise<NoveltyWithDetails[]> {
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
  const stockStatus: NoveltyWithDetails['stock_status'] = getCatalogStockStatus(stock, minQty);

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
