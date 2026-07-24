import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const TABLE_ALIASES: Record<string, string> = {
  products: 'v_products_public',
  suppliers: 'v_suppliers_public',
  print_area_techniques: 'v_print_area_techniques_public',
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  // NOTE: 'personalization_techniques' is intentionally NOT aliased.
  // It is a real table in doufsxqlfjyuvxuezpln (uuid PK, EN columns, own RLS).
  // Redirecting it to tecnicas_gravacao (PT columns) returned wrong data — see
  // rest-native.ts "BUG A" / postgrest.ts "BUG 1". Queries go directly to it.
  customization_price_tables: 'tabela_preco_gravacao_oficial',
  tecnica_gravacao_variante: 'tabela_preco_gravacao_oficial',
  v_products_without_videos: 'v_products_without_video',
};

export function resolveTable(table: string): string {
  return TABLE_ALIASES[table] ?? table;
}

export function isGoneError(error: { message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return msg.includes('410') || msg.toLowerCase().includes('gone');
}

export function handleQueryError(
  hookName: string,
  table: string,
  error: { message?: string } | null,
): never | [] {
  if (!error) return [];
  if (isGoneError(error)) {
    logger.warn(`[${hookName}] Bridge deprecated (410) for ${table}`);
    return [];
  }
  throw new Error(`[${hookName}] Query error on ${table}: ${error.message}`);
}

export { supabase };
