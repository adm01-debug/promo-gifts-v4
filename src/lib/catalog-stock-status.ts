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
 * Regras:
 * - `qty <= 0` (inclui valores negativos anômalos): `'out-of-stock'`
 * - `0 < qty < lowStockThreshold`: `'low-stock'`
 * - `qty >= lowStockThreshold`: `'in-stock'`
 *
 * Entradas não-finitas (`NaN`, `Infinity`, `-Infinity`), `null` ou `undefined`
 * são normalizadas para `0` e, portanto, resultam em `'out-of-stock'` — o
 * estado seguro para exibição (nunca anuncia disponibilidade sem dado válido).
 *
 * @param stock quantidade em estoque (pode ser nula/indefinida)
 * @param lowStockThreshold limiar de "estoque baixo" (padrão {@link CATALOG_LOW_STOCK_THRESHOLD})
 */
export function getCatalogStockStatus(
  stock: number | null | undefined,
  lowStockThreshold: number = CATALOG_LOW_STOCK_THRESHOLD,
): CatalogStockStatus {
  const qty = typeof stock === 'number' && Number.isFinite(stock) ? stock : 0;
  if (qty <= 0) return 'out-of-stock';
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
