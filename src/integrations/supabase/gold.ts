/**
 * Acesso tipado à camada OURO (Gold) da arquitetura Medallion.
 *
 * Complementa `gold-relations.ts` (contratos puros) com helpers ligados ao
 * client Supabase do projeto SSOT (doufsxqlfjyuvxuezpln). Use `goldFrom()`
 * em vez de `untypedFrom()` para relações do catálogo: o nome da relação é
 * restrito ao conjunto Ouro auditado e a linha volta tipada.
 *
 * Regra de arquitetura (ADR 0007): o frontend NUNCA lê Bronze
 * (`supplier_products_raw*`) nem Prata (`produtos_padronizacao*`).
 * Qualquer dado do pipeline chega aqui já promovido para a camada Ouro.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { GoldRelationName, GoldRowMap } from './gold-relations';

export type {
  GoldRelationName,
  GoldRowMap,
  GoldProductRow,
  GoldVariantRow,
  GoldVariantSupplierSourceRow,
  GoldVariantSalePricesRow,
  GoldProductImageCdnRow,
  GoldProductMinPriceRow,
  GoldPrintAreaTechniqueRow,
  GoldSupplierRow,
  MedallionCoverageRow,
  PipelineProgressRow,
} from './gold-relations';
export { GOLD_READ_ALIASES, GOLD_RELATIONS } from './gold-relations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mesmo cast permissivo de supabase-untyped.ts: as relações Ouro ainda não estão no types.ts gerado.
type AnyClient = SupabaseClient<any, any, any>;

/**
 * Query builder para uma relação da camada Ouro.
 *
 * O generic flui para `.select()` etc. via a anotação do chamador:
 *   const { data } = await goldFrom('v_products_min_price').select('*');
 *   // tipar com: (data ?? []) as GoldProductMinPriceRow[]
 */
export function goldFrom<K extends GoldRelationName>(relation: K) {
  return (supabase as unknown as AnyClient).from(relation) as ReturnType<AnyClient['from']> & {
    _row?: GoldRowMap[K];
  };
}

/**
 * Dispara a sincronização manual de `external_connections` a partir das
 * credenciais, via wrapper admin-gated `fn_admin_sync_external_connections`
 * (migration 20260611183200). A função original
 * `sync_external_connections_from_credentials` é SECURITY DEFINER sem checagem
 * de chamador e teve EXECUTE revogado de anon/authenticated — o wrapper exige
 * papel admin e mantém a original trancada.
 */
export async function rpcAdminSyncExternalConnections(): Promise<{ error: Error | null }> {
  const { error } = await (supabase as unknown as AnyClient).rpc(
    'fn_admin_sync_external_connections',
  );
  return { error: error ? new Error(error.message) : null };
}
