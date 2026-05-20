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
 */

// Bridge (core)
export {
  invokeExternalDb,
  invokeExternalDbSingle,
  invokeExternalDbDelete,
  invokeBatchBridge,
  invokeBridge,
} from './bridge';
export type {
  InvokeOptions,
  InvokeResult,
  BatchQuery,
  BatchResult,
  BridgeResponse,
  Operation,
} from './bridge';

// Batch Import
export { checkExistingSkus, executeBatchImport, generateErrorReportCSV } from './batch-import';
export type { ImportMode, ImportRow, BatchImportProgress, BatchImportResult } from './batch-import';

// Product types + helpers
export type { PromobrindProduct } from './product-types';
export { getProductImageUrl, getProductPrice, getProductStock } from './product-types';
export {
  PRODUCT_SELECT_FIELDS_WITH_SALE,
  PRODUCT_SELECT_FIELDS_LEGACY,
  PRODUCT_SELECT_FIELDS_DETAIL,
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
export * from './types';
export * from './tables';
export { extractFunctionErrorMessage } from './invoke';
