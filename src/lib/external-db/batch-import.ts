/**
 * Batch Import Helper — Client-side orchestrator for bulk product imports.
 * Sends products in chunks to external-db-bridge batch_insert/upsert.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';

export type ImportMode = 'insert' | 'upsert';

export interface ImportRow {
  sku: string;
  name: string;
  sale_price: number;
  // Textos
  description?: string | null;
  short_description?: string | null;
  meta_description?: string | null;
  // Comercial
  brand?: string | null;
  supplier_reference?: string | null;
  supplier_id?: string | null;
  cost_price?: number | null;
  stock_quantity?: number | null;
  min_quantity?: number | null;
  category_id?: string | null;
  main_category_id?: string | null;
  // Dimensões
  height_cm?: number | null;
  width_cm?: number | null;
  length_cm?: number | null;
  diameter_cm?: number | null;
  weight_g?: number | null;
  capacity_ml?: number | null;
  // Embalagem
  packing_type?: string | null;
  packing_classification?: string | null;
  has_commercial_packaging?: boolean | null;
  repacking_type?: string | null;
  packaging_context?: string | null;
  // Caixa
  box_width_mm?: number | null;
  box_height_mm?: number | null;
  box_length_mm?: number | null;
  box_weight_kg?: number | null;
  box_quantity?: number | null;
  box_volume_cm3?: number | null;
  box_image?: string | null;
  // Mídia
  image_url?: string | null;
  primary_image_url?: string | null;
  og_image_url?: string | null;
  // Flags
  is_active?: boolean;
  active?: boolean;
  is_featured?: boolean | null;
  is_bestseller?: boolean | null;
  is_new?: boolean | null;
  is_on_sale?: boolean | null;
  is_kit?: boolean | null;
  // Outros
  gender?: string | null;
  dimensions?: string | null;
  [key: string]: unknown;
}

export interface BatchImportProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentChunk: number;
  totalChunks: number;
}

export interface BatchImportResult {
  succeeded: number;
  failed: number;
  errors: Array<{ chunkIndex: number; startRow: number; endRow: number; message: string }>;
  insertedIds: string[];
}

const CHUNK_SIZE = 25;

/**
 * Check which SKUs already exist in the external DB.
 * Returns a Set of existing SKUs.
 */
export async function checkExistingSkus(skus: string[]): Promise<Set<string>> {
  if (skus.length === 0) return new Set();

  const existingSkus = new Set<string>();
  const uniqueSkus = [...new Set(skus)];

  // Query in chunks of 100 SKUs
  for (let i = 0; i < uniqueSkus.length; i += 100) {
    const chunk = uniqueSkus.slice(i, i + 100);
    try {
      const response = await dbInvoke<{ sku: string }>({
        table: 'products',
        operation: 'select',
        select: 'sku',
        filters: { sku: chunk }, // FIX: array -> .in() (era string 'in.(...)' -> .eq() -> 400)
        limit: 100,
      });

      const records = response.records ?? [];
      if (Array.isArray(records)) {
        records.forEach((r: { sku: string }) => {
          if (r.sku) existingSkus.add(r.sku);
        });
      }
    } catch (err) {
      logger.warn('[batch-import] Error checking SKUs chunk:', err);
    }
  }

  return existingSkus;
}

/**
 * Execute batch import of products.
 * Sends rows in chunks of CHUNK_SIZE to the edge function.
 */
export async function executeBatchImport(
  rows: ImportRow[],
  mode: ImportMode,
  onProgress?: (progress: BatchImportProgress) => void,
): Promise<BatchImportResult> {
  const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);
  const progress: BatchImportProgress = {
    total: rows.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    currentChunk: 0,
    totalChunks,
  };

  const result: BatchImportResult = {
    succeeded: 0,
    failed: 0,
    errors: [],
    insertedIds: [],
  };

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE);
    progress.currentChunk = chunkIndex + 1;

    try {
      const response = await dbInvoke<{ id: string; sku: string; name: string }>({
        table: 'products',
        operation: 'batch_insert',
        data: chunk as unknown as Record<string, unknown>,
        ...(mode === 'upsert' ? { onConflict: 'sku' } : {}),
      });

      const records = response.records ?? [];
      const insertedCount = Array.isArray(records) ? records.length : 0;

      result.succeeded += insertedCount;
      result.failed += chunk.length - insertedCount;
      progress.succeeded += insertedCount;
      progress.failed += chunk.length - insertedCount;

      if (Array.isArray(records)) {
        records.forEach((r: { id: string }) => {
          if (r.id) result.insertedIds.push(r.id);
        });
      }

      if (insertedCount < chunk.length) {
        result.errors.push({
          chunkIndex,
          startRow: i + 1,
          endRow: i + chunk.length,
          message: `${chunk.length - insertedCount} registros não foram processados`,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      logger.error(`[batch-import] Chunk ${chunkIndex} failed:`, err);

      result.failed += chunk.length;
      progress.failed += chunk.length;
      result.errors.push({
        chunkIndex,
        startRow: i + 1,
        endRow: i + chunk.length,
        message: errorMessage,
      });
    }

    progress.processed += chunk.length;
    onProgress?.({ ...progress });
  }

  result.succeeded = progress.succeeded;
  result.failed = progress.failed;
  return result;
}

/**
 * Generate error report as CSV string
 */
export function generateErrorReportCSV(
  errors: BatchImportResult['errors'],
  failedRows?: Array<{ row: number; sku: string; name: string; errors: string[] }>,
): string {
  const BOM = '\uFEFF';
  const lines = ['Linha;SKU;Nome;Erro'];

  if (failedRows?.length) {
    for (const r of failedRows) {
      lines.push(`${r.row};${r.sku ?? ''};${r.name ?? ''};${r.errors.join(' | ')}`);
    }
  }

  if (errors.length) {
    for (const e of errors) {
      lines.push(`${e.startRow}-${e.endRow};;Chunk;${e.message}`);
    }
  }

  return BOM + lines.join('\n');
}
