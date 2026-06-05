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

export async function fetchPrintAreas(componentId: string): Promise<PrintArea[]> {
  const { records } = await dbInvoke<PrintArea>({
    table: 'kit_component_print_areas',
    operation: 'select',
    filters: { kit_component_id: componentId },
    limit: 50,
    orderBy: { column: 'display_order', ascending: true },
  });
  return records;
}

export async function createPrintArea(payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedFrom('kit_component_print_areas').insert(payload);
  if (error) throw new Error(error.message || 'Erro ao criar área');
}

export async function updatePrintArea(id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedFrom('kit_component_print_areas').update(payload).eq('id', id);
  if (error) throw new Error(error.message || 'Erro ao atualizar área');
}

export async function deletePrintArea(id: string): Promise<void> {
  await dbInvokeDelete({ table: 'kit_component_print_areas', id });
}

// ── Kit Component Media (external DB) ──

export interface ComponentMedia {
  id: string;
  kit_component_id: string;
  product_id: string;
  media_type: 'image' | 'video';
  url: string;
  title: string | null;
  sort_order: number | null;
  is_cover: boolean | null;
}

export async function fetchComponentMedia(componentId: string): Promise<ComponentMedia[]> {
  const { records } = await dbInvoke<ComponentMedia>({
    table: 'kit_component_media',
    operation: 'select',
    filters: { kit_component_id: componentId },
    limit: 100,
    orderBy: { column: 'sort_order', ascending: true },
  });
  return records;
}

export async function createComponentMedia(payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedFrom('kit_component_media').insert(payload);
  if (error) throw new Error(error.message || 'Erro ao criar mídia');
}

export async function updateComponentMedia(
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await untypedFrom('kit_component_media').update(payload).eq('id', id);
  if (error) throw new Error(error.message || 'Erro ao atualizar mídia');
}

export async function deleteComponentMedia(id: string): Promise<void> {
  await dbInvokeDelete({ table: 'kit_component_media', id });
}
