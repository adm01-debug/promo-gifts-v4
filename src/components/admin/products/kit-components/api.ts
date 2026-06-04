/**
 * API helpers for kit components and print areas.
 * Uses invokeExternalDb (REST-native) — bridge edge function is permanently decommissioned.
 */
import { invokeExternalDb } from '@/lib/external-db/bridge';
import type { KitComponent, PrintArea } from './types';

export async function fetchKitComponents(productId: string): Promise<KitComponent[]> {
  const result = await invokeExternalDb<KitComponent>({
    table: 'product_kit_components',
    operation: 'select',
    filters: { kit_product_id: productId },
    limit: 100,
    orderBy: { column: 'display_order', ascending: true },
  });
  return result.records;
}

export async function createComponent(payload: Record<string, unknown>): Promise<void> {
  await invokeExternalDb({
    table: 'product_kit_components',
    operation: 'insert',
    data: payload,
  });
}

export async function updateComponent(id: string, payload: Record<string, unknown>): Promise<void> {
  await invokeExternalDb({
    table: 'product_kit_components',
    operation: 'update',
    id,
    data: payload,
  });
}

export async function deleteComponent(id: string): Promise<void> {
  await invokeExternalDb({
    table: 'product_kit_components',
    operation: 'delete',
    id,
  });
}

export async function fetchPrintAreas(componentId: string): Promise<PrintArea[]> {
  const result = await invokeExternalDb<PrintArea>({
    table: 'kit_component_print_areas',
    operation: 'select',
    filters: { kit_component_id: componentId },
    limit: 50,
    orderBy: { column: 'display_order', ascending: true },
  });
  return result.records;
}

export async function createPrintArea(payload: Record<string, unknown>): Promise<void> {
  await invokeExternalDb({
    table: 'kit_component_print_areas',
    operation: 'insert',
    data: payload,
  });
}

export async function updatePrintArea(id: string, payload: Record<string, unknown>): Promise<void> {
  await invokeExternalDb({
    table: 'kit_component_print_areas',
    operation: 'update',
    id,
    data: payload,
  });
}

export async function deletePrintArea(id: string): Promise<void> {
  await invokeExternalDb({
    table: 'kit_component_print_areas',
    operation: 'delete',
    id,
  });
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
  const result = await invokeExternalDb<ComponentMedia>({
    table: 'kit_component_media',
    operation: 'select',
    filters: { kit_component_id: componentId },
    limit: 100,
    orderBy: { column: 'sort_order', ascending: true },
  });
  return result.records;
}

export async function createComponentMedia(payload: Record<string, unknown>): Promise<void> {
  await invokeExternalDb({
    table: 'kit_component_media',
    operation: 'insert',
    data: payload,
  });
}

export async function updateComponentMedia(
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await invokeExternalDb({
    table: 'kit_component_media',
    operation: 'update',
    id,
    data: payload,
  });
}

export async function deleteComponentMedia(id: string): Promise<void> {
  await invokeExternalDb({
    table: 'kit_component_media',
    operation: 'delete',
    id,
  });
}
