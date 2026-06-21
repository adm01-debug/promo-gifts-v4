/**
 * buildCustomKitInsert — Helper tipado para construir payloads de insert/update em custom_kits.
 * Remove a necessidade de `as never` em chamadas Supabase.
 */
import type { CustomKitRow } from '@/hooks/kit-builder';

export type CustomKitInsertPayload = Omit<
  CustomKitRow,
  'created_at' | 'id' | 'is_pinned' | 'last_used_at' | 'updated_at'
> & {
  last_used_at?: string | null;
  is_pinned?: boolean;
};

export function buildCustomKitInsert(
  source: CustomKitRow,
  overrides: Partial<CustomKitInsertPayload> & { user_id: string },
): CustomKitInsertPayload {
  return {
    user_id: overrides.user_id,
    name: overrides.name ?? source.name,
    status: overrides.status ?? source.status,
    box_data: overrides.box_data ?? source.box_data,
    items_data: overrides.items_data ?? source.items_data,
    personalization_data: overrides.personalization_data ?? source.personalization_data,
    kit_quantity: overrides.kit_quantity ?? source.kit_quantity,
    box_price: overrides.box_price ?? source.box_price,
    items_price: overrides.items_price ?? source.items_price,
    personalization_price: overrides.personalization_price ?? source.personalization_price,
    total_price: overrides.total_price ?? source.total_price,
    volume_usage_percent: overrides.volume_usage_percent ?? source.volume_usage_percent,
    color: overrides.color ?? source.color,
    icon: overrides.icon ?? source.icon,
    tag: overrides.tag ?? source.tag,
    description: overrides.description ?? source.description,
    is_favorite: overrides.is_favorite ?? source.is_favorite,
    is_pinned: overrides.is_pinned ?? source.is_pinned ?? false,
    last_used_at: overrides.last_used_at ?? source.last_used_at ?? null,
  };
}
