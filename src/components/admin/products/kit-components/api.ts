/**
 * API helpers for kit components and print areas
 *
 * Migrated from supabase.functions.invoke('external-db-bridge') to native
 * PostgREST access (dbInvoke for reads, untypedFrom for writes, dbInvokeDelete
 * for deletes). The bridge edge function is permanently OFF (kill-switch).
 */
import { dbInvoke, dbInvokeDelete } from '@/lib/db/postgrest';
import { untypedFrom } from '@/lib/supabase-untyped';
import type { KitComponent, PrintArea } from './types';

export async function fetchKitComponents(productId: string): Promise<KitComponent[]> {
  const { records } = await dbInvoke<KitComponent>({
    table: 'product_kit_components',
    operation: 'select',
    filters: { kit_product_id: productId },
    limit: 100,
    orderBy: { column: 'display_order', ascending: true },
  });
  return records;
}

export async function createComponent(payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedFrom('product_kit_components').insert(payload);
  if (error) throw new Error(error.message || 'Erro ao criar componente');
}

export async function updateComponent(id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedFrom('product_kit_components').update(payload).eq('id', id);
  if (error) throw new Error(error.message || 'Erro ao atualizar componente');
}

export async function deleteComponent(id: string): Promise<void> {
  await dbInvokeDelete({ table: 'product_kit_components', id });
}

// kit_component_print_areas real columns: kit_component_id, location_code, location_name,
// location_order, max_width, max_height, tabela_preco_id, shape, is_curved, technique_order,
// is_active, created_at, updated_at. The UI types (PrintArea/PrintAreaFormData) historically
// used `_mm` suffixes + `display_order`/`technique_name`/`technique_id`/`area_name`/`notes`,
// none of which are columns — so EVERY print-area read 400'd on orderBy=display_order and
// every write 400'd (PGRST204). Translate UI keys ⇄ real columns here so the feature works
// without touching the UI; the technique association survives via `tabela_preco_id`.
const PRINT_AREA_WRITE_MAP: Record<string, string> = {
  max_width_mm: 'max_width',
  max_height_mm: 'max_height',
  display_order: 'location_order',
};
const PRINT_AREA_UNSTORABLE = new Set(['area_name', 'technique_name', 'technique_id', 'notes']);

function toPrintAreaRow(payload: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (PRINT_AREA_UNSTORABLE.has(key)) continue;
    row[PRINT_AREA_WRITE_MAP[key] ?? key] = value;
  }
  return row;
}

function fromPrintAreaRow(row: Record<string, unknown>): PrintArea {
  return {
    id: String(row.id ?? ''),
    kit_component_id: String(row.kit_component_id ?? ''),
    location_code: (row.location_code as string | null) ?? null,
    location_name: (row.location_name as string | null) ?? null,
    area_name: (row.location_name as string | null) ?? null,
    max_width_mm: (row.max_width as number | null) ?? null,
    max_height_mm: (row.max_height as number | null) ?? null,
    technique_name: null,
    technique_id: null,
    tabela_preco_id: (row.tabela_preco_id as string | null) ?? null,
    display_order: (row.location_order as number | null) ?? null,
    notes: null,
    is_active: (row.is_active as boolean | null) ?? true,
    created_at: (row.created_at as string | null) ?? '',
  };
}

export async function fetchPrintAreas(componentId: string): Promise<PrintArea[]> {
  const { records } = await dbInvoke<Record<string, unknown>>({
    table: 'kit_component_print_areas',
    operation: 'select',
    filters: { kit_component_id: componentId },
    limit: 50,
    orderBy: { column: 'location_order', ascending: true },
  });
  return records.map(fromPrintAreaRow);
}

export async function createPrintArea(payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedFrom('kit_component_print_areas').insert(toPrintAreaRow(payload));
  if (error) throw new Error(error.message || 'Erro ao criar área');
}

export async function updatePrintArea(id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedFrom('kit_component_print_areas')
    .update(toPrintAreaRow(payload))
    .eq('id', id);
  if (error) throw new Error(error.message || 'Erro ao atualizar área');
}

export async function deletePrintArea(id: string): Promise<void> {
  await dbInvokeDelete({ table: 'kit_component_print_areas', id });
}

// ── Kit Component Media ──
// FIX 2026-06-11 (auditoria medallion): a tabela real no SSOT é component_media
// (FK component_id). O nome bridge-era kit_component_media nunca existiu no
// banco — todas as operações retornavam 404/PGRST205.

export interface ComponentMedia {
  id: string;
  component_id: string;
  product_id: string;
  media_type: 'image' | 'video';
  url: string;
  title: string | null;
  sort_order: number | null;
  is_cover: boolean | null;
}

export async function fetchComponentMedia(componentId: string): Promise<ComponentMedia[]> {
  const { records } = await dbInvoke<ComponentMedia>({
    table: 'component_media',
    operation: 'select',
    filters: { component_id: componentId },
    limit: 100,
    orderBy: { column: 'sort_order', ascending: true },
  });
  return records;
}

export async function createComponentMedia(payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedFrom('component_media').insert(payload);
  if (error) throw new Error(error.message || 'Erro ao criar mídia');
}

export async function updateComponentMedia(
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await untypedFrom('component_media').update(payload).eq('id', id);
  if (error) throw new Error(error.message || 'Erro ao atualizar mídia');
}

export async function deleteComponentMedia(id: string): Promise<void> {
  await dbInvokeDelete({ table: 'component_media', id });
}
