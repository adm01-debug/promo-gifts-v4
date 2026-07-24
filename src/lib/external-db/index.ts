/**
 * External DB module — barrel export.
 *
 * Refactored from monolithic external-db.ts (1856 lines) into:
 * - bridge.ts         → Core invocation, retry, batch, CRUD helpers
 * - product-types.ts  → PromobrindProduct type + helper functions
 * - products.ts       → Full product fetch with enrichment
 * - products-lightweight.ts → Lightweight product fetch (no enrichment)
 * - products-detail.ts     → Single product fetch, categories, colors
 * - techniques.ts     → Print areas + techniques
 * - price-tables.ts   → Price table queries
 * - types.ts          → Hook-level types (existing)
 * - tables.ts         → Table constants (existing)
 * - invoke.ts         → Hook-level invoke (existing)
 *
 * ARQUITETURA (2026-06):
 * A edge function `external-db-bridge` foi desativada (kill-switch OFF).
 * Todo o acesso ao banco de catálogo (products, categories, variants) agora
 * usa PostgREST nativo via supabase.from() diretamente em doufsxqlfjyuvxuezpln.
 *
 * O único DB externo restante é pgxfvjmuubtbowutlide (CRM), acessado via
 * crm-db-bridge — que é gerenciado por src/lib/crm-db.ts, NÃO por este módulo.
 *
 * ATENÇÃO AO IMPORTAR DESTE MÓDULO:
 * As funções bridge.ts (invokeExternalDb, invokeBridge, etc.) ainda invocam
 * a edge function 'external-db-bridge'. O kill-switch em invoke.ts intercepta
 * essas chamadas ANTES de chegarem à edge function quando o switch está OFF.
 *
 * Não importe diretamente de bridge.ts, rest-native.ts ou invoke.ts para
 * novos recursos. Use supabase.from() direto ou o padrão de hooks existentes.
 */

/**
 * Bridge (core) — AVISO: estas funções passam pelo kill-switch em invoke.ts.
 * Quando `edge_external_db_bridge` está OFF em system_kill_switches, as chamadas
 * são interceptadas antes de chegarem à edge function (short-circuit).
 *
 * @internal Não usar para novos recursos. Preferir supabase.from() direto.
 */
export {
  invokeExternalDb,
  invokeExternalDbSingle,
  invokeExternalDbDelete,
  invokeBatchBridge,
  invokeBridge,
  isWriteOperation,
  WriteUnavailableError,
} from './bridge';
export type {
  InvokeOptions,
  InvokeResult,
  BatchQuery,
  BatchResult,
  BridgeResponse,
  Operation,
} from './bridge';

// Silent-empty diagnostics (Etapa 1) — source for Etapa 2 telemetry + console.
export {
  reportSilentEmpty,
  getSilentEmptyReport,
  getSilentEmptySummary,
  resetSilentEmptyReport,
} from './silent-empty-report';
export type { SilentEmptyEvent, SilentEmptyReason } from './silent-empty-report';

// Batch Import
export { checkExistingSkus, executeBatchImport, generateErrorReportCSV } from './batch-import';
export type { ImportMode, ImportRow, BatchImportProgress, BatchImportResult } from './batch-import';

// Product types + helpers
export type { PromobrindProduct } from './product-types';
export { getProductImageUrl, getProductPrice, getProductStock } from './product-types';
export {
  PRODUCT_SELECT_FIELDS_WITH_SALE,
  PRODUCT_SELECT_FIELDS_WITH_SALE_NO_THRESHOLD,
  PRODUCT_SELECT_FIELDS_LEGACY,
  PRODUCT_SELECT_FIELDS_LEGACY_NO_THRESHOLD,
  PRODUCT_SELECT_FIELDS_DETAIL,
  PRODUCT_SELECT_FIELDS_DETAIL_NO_THRESHOLD,
  shouldFallbackSelect,
} from './product-types';

// Product fetch (full enrichment)
export { fetchPromobrindProducts } from './products';

// Product fetch (lightweight)
export { fetchPromobrindProductsLightweight } from './products-lightweight';
export type { LightweightProduct } from './products-lightweight';

// Product detail
export {
  fetchPromobrindProductById,
  fetchPromobrindProductBySku,
  fetchPromobrindCategories,
  fetchPromobrindColors,
} from './products-detail';

// Techniques + Print Areas
export {
  fetchPromobrindPrintAreas,
  fetchPromobrindTechniques,
  fetchPromobrindTechniqueById,
} from './techniques';
export type { PromobrindPrintArea, PromobrindTechnique } from './techniques';

// Price Tables
export { fetchPromobrindPriceTables, findBestPriceTable } from './price-tables';
export type { PromobrindPriceTable } from './price-tables';

// Legacy hook-level exports (existing modules)
export * from './tables';
export { extractFunctionErrorMessage } from './invoke';
