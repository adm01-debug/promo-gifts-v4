/**
 * ============================================================================
 * FONTE ÚNICA DE VERDADE — Status de estoque de CATÁLOGO (exibição pública)
 * ============================================================================
 *
 * Este módulo centraliza a derivação e a rotulagem do status de estoque
 * exibido ao cliente no catálogo. Antes desta consolidação, a mesma lógica
 * (`stock <= 0 ? 'out-of-stock' : stock < 10 ? 'low-stock' : 'in-stock'`)
 * e os mesmos rótulos pt-BR estavam duplicados em múltiplos arquivos, com
 * limiares divergentes — origem de regressões recorrentes.
 *
 * ⚠️ NÃO confundir com o modelo de INVENTÁRIO / reposição interna
 * (`src/types/stock.ts`), que usa convenção com underscore
 * (`'in_stock' | 'low_stock' | 'critical' | 'out_of_stock' | ...`) e pertence
 * a outro domínio (gestão de estoque, reorder points). São deliberadamente
 * distintos e não devem ser unificados.
 */

/** Status de estoque para exibição no catálogo (convenção com hífen). */
export type CatalogStockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

/**
 * Limiar padrão (exclusivo) abaixo do qual um item COM estoque positivo é
 * considerado "estoque baixo". Ex.: com o padrão 10, uma quantidade de 9 é
 * "low-stock" e 10 já é "in-stock".
 */
export const CATALOG_LOW_STOCK_THRESHOLD = 10;

/**
 * Deriva o status de catálogo a partir da quantidade em estoque.
 *
 * Regras (avaliadas nesta ordem):
 * - `qty <= 0` (inclui valores negativos anômalos): `'out-of-stock'`
 * - `minOrderQuantity >= 1` e `qty < minOrderQuantity`: `'out-of-stock'`
 *   (o item TEM estoque, mas abaixo do mínimo exigido pelo fornecedor →
 *   não pode ser pedido, logo é indisponível para o cliente)
 * - `0 < qty < lowStockThreshold`: `'low-stock'`
 * - `qty >= lowStockThreshold`: `'in-stock'`
 *
 * Entradas não-finitas (`NaN`, `Infinity`, `-Infinity`), `null` ou `undefined`
 * são normalizadas para `0` e, portanto, resultam em `'out-of-stock'` — o
 * estado seguro para exibição (nunca anuncia disponibilidade sem dado válido).
 *
 * BUG-STOCK-01 (2026-06-18) → CONSOLIDADO (2026-06-20): a regra de
 * `min_quantity` (estoque positivo porém abaixo do mínimo pedível = zerado)
 * vivia apenas em `useProductsLightweight.getStockStatus`, divergente do
 * caminho pesado (`product-mapper`, que ignorava min_quantity) e de
 * `useNovelties` (que passava min_quantity como limiar de low-stock). Agora a
 * regra pertence a esta SSOT e todos os callers a aplicam de forma idêntica.
 *
 * @param stock quantidade em estoque (pode ser nula/indefinida)
 * @param lowStockThreshold limiar de "estoque baixo" (padrão {@link CATALOG_LOW_STOCK_THRESHOLD})
 * @param minOrderQuantity quantidade mínima pedível (min_quantity do fornecedor);
 *   quando informada (>= 1), estoque positivo abaixo dela vira `'out-of-stock'`.
 */
export function getCatalogStockStatus(
  stock: number | null | undefined,
  lowStockThreshold: number = CATALOG_LOW_STOCK_THRESHOLD,
  minOrderQuantity?: number | null,
): CatalogStockStatus {
  const qty = typeof stock === 'number' && Number.isFinite(stock) ? stock : 0;
  if (qty <= 0) return 'out-of-stock';
  if (
    typeof minOrderQuantity === 'number' &&
    Number.isFinite(minOrderQuantity) &&
    minOrderQuantity >= 1 &&
    qty < minOrderQuantity
  ) {
    return 'out-of-stock';
  }
  if (qty < lowStockThreshold) return 'low-stock';
  return 'in-stock';
}

/** Rótulos pt-BR canônicos para cada status de catálogo. */
export const CATALOG_STOCK_STATUS_LABEL: Record<CatalogStockStatus, string> = {
  'in-stock': 'Em estoque',
  'low-stock': 'Estoque baixo',
  'out-of-stock': 'Estoque zerado',
};

/**
 * Token de cor/semântica associado a cada status (mantém a convenção legada em
 * que o próprio identificador do status é usado como chave de cor no tema).
 */
export const CATALOG_STOCK_STATUS_COLOR: Record<CatalogStockStatus, string> = {
  'in-stock': 'in-stock',
  'low-stock': 'low-stock',
  'out-of-stock': 'out-of-stock',
};

/**
 * Retorna o rótulo pt-BR de um status. Aceita `string` por conveniência (valores
 * vindos de dados não tipados) e cai para "Em estoque" em entradas desconhecidas,
 * preservando o comportamento de fallback histórico.
 */
export function getCatalogStockStatusLabel(status: string): string {
  return (
    CATALOG_STOCK_STATUS_LABEL[status as CatalogStockStatus] ??
    CATALOG_STOCK_STATUS_LABEL['in-stock']
  );
}

/** Retorna o token de cor de um status, com o mesmo fallback do rótulo. */
export function getCatalogStockStatusColor(status: string): string {
  return (
    CATALOG_STOCK_STATUS_COLOR[status as CatalogStockStatus] ??
    CATALOG_STOCK_STATUS_COLOR['in-stock']
  );
}
