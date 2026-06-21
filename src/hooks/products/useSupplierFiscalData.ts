/**
 * Hook to fetch fiscal data from variant_supplier_sources + supplier_branches
 * for a given product's preferred supplier source.
 *
 * INHERITANCE: If no VSS record exists, falls back to supplier_branches defaults.
 * OVERRIDE: saveFiscalOverride() creates/updates VSS records to override inherited data.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { untypedFrom } from '@/lib/supabase-untyped';
import { useCallback } from 'react';
import { logger } from '@/lib/logger';

export interface SupplierFiscalData {
  // From variant_supplier_sources
  cst: string | null;
  cfop: string | null;
  cfop_interstate: string | null;
  icms_rate: number | null;
  pis_rate: number | null;
  cofins_rate: number | null;
  cest: string | null;
  csosn: string | null;
  operation_nature: string | null;
  supplier_branch_id: string | null;
  // From supplier_branches (joined or fetched separately)
  branch_name: string | null;
  branch_cnpj: string | null;
  branch_state_uf: string | null;
  branch_tax_regime: string | null;
  branch_icms_internal: number | null;
  branch_icms_interstate: number | null;
  // Inheritance flag
  isInherited: boolean;
  // Internal: variant ID used for VSS (needed for save)
  _variantId?: string;
}

export interface FiscalOverrideInput {
  cst: string | null;
  cfop: string | null;
  icms_rate: number | null;
  pis_rate: number | null;
  cofins_rate: number | null;
  cest: string | null;
  csosn: string | null;
  operation_nature: string | null;
}

interface VSSRecord {
  id?: string;
  cst: string | null;
  cfop: string | null;
  icms_rate: number | null;
  pis_rate: number | null;
  cofins_rate: number | null;
  cest: string | null;
  csosn: string | null;
  operation_nature: string | null;
  supplier_branch_id: string | null;
  variant_id?: string;
}

interface BranchRecord {
  id: string;
  branch_name: string | null;
  cnpj: string | null;
  state_uf: string | null;
  tax_regime: string | null;
  icms_internal_rate: number | null;
  icms_interstate_rate: number | null;
  default_cst: string | null;
  default_cfop_internal: string | null;
  default_cfop_interstate: string | null;
  default_pis_rate: number | null;
  default_cofins_rate: number | null;
  default_cest: string | null;
  default_csosn: string | null;
  default_operation_nature: string | null;
}

const BRANCH_SELECT =
  'id, branch_name, cnpj, state_uf, tax_regime, icms_internal_rate, icms_interstate_rate, default_cst, default_cfop_internal, default_cfop_interstate, default_pis_rate, default_cofins_rate, default_cest, default_csosn, default_operation_nature';

/**
 * Builds SupplierFiscalData from branch defaults (inheritance mode).
 */
function buildFromBranch(branch: BranchRecord): SupplierFiscalData {
  return {
    cst: branch.default_cst || null,
    cfop: branch.default_cfop_internal || null,
    cfop_interstate: branch.default_cfop_interstate || null,
    icms_rate: branch.icms_internal_rate ?? null,
    pis_rate: branch.default_pis_rate ?? null,
    cofins_rate: branch.default_cofins_rate ?? null,
    cest: branch.default_cest || null,
    csosn: branch.default_csosn || null,
    operation_nature: branch.default_operation_nature || null,
    supplier_branch_id: branch.id,
    branch_name: branch.branch_name || null,
    branch_cnpj: branch.cnpj || null,
    branch_state_uf: branch.state_uf || null,
    branch_tax_regime: branch.tax_regime || null,
    branch_icms_internal: branch.icms_internal_rate ?? null,
    branch_icms_interstate: branch.icms_interstate_rate ?? null,
    isInherited: true,
  };
}

/**
 * Fetches fiscal data for a specific supplier source (by supplier_id + product variants).
 * Uses the external DB bridge to query variant_supplier_sources.
 *
 * INHERITANCE: If no VSS record exists for the product+supplier combo,
 * falls back to supplier_branches defaults for that supplier.
 */
export function useSupplierFiscalData(
  productId: string | undefined,
  supplierId: string | undefined,
) {
  const queryClient = useQueryClient();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queryKey = ['supplier-fiscal-data', productId, supplierId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<SupplierFiscalData | null> => {
      if (!productId || !supplierId) return null;

      // 1. First get variant IDs for this product to scope the VSS query
      const variantsResult = await untypedFrom('product_variants')
        .select('id')
        .eq('product_id', productId)
        .limit(200);

      if (variantsResult.error) throw variantsResult.error;

      let vss: VSSRecord | null = null;
      let matchedVariantId: string | null = null;

      if (variantsResult.data.length) {
        // 2. Get variant_supplier_sources for this supplier + product's variants.
        // Single batched .in() query replaces the old sequential loop (N+1 → 1 round-trip).
        const variantIds = variantsResult.data.map((v) => v.id);
        const vssResult = await untypedFrom('variant_supplier_sources')
          .select(
            'id, cst, cfop, icms_rate, pis_rate, cofins_rate, cest, csosn, operation_nature, supplier_branch_id, variant_id',
          )
          .eq('supplier_id', supplierId)
          .in('variant_id', variantIds);

        if (vssResult.data?.length) {
          // Pick the VSS record whose variant appears earliest in the priority order
          const vssByVariantId = new Map<string, VSSRecord>(
            vssResult.data.map((r) => [(r as VSSRecord).variant_id!, r as VSSRecord]),
          );
          const matched = variantIds.find((vid) => vssByVariantId.has(vid));
          if (matched) {
            vss = vssByVariantId.get(matched)!;
            matchedVariantId = matched;
          }
        }

        // Keep first variant ID for potential new VSS creation
        if (!matchedVariantId && variantsResult.data.length) {
          matchedVariantId = variantsResult.data[0].id;
        }
      }

      // 3. If we have VSS, fetch branch details and return specific data
      if (vss) {
        let branchData: Partial<BranchRecord> = {};
        if (vss.supplier_branch_id) {
          try {
            const branchResult = await untypedFrom('supplier_branches')
              .select(BRANCH_SELECT)
              .eq('id', vss.supplier_branch_id)
              .limit(1);
            if (branchResult.data?.length) {
              branchData = branchResult.data[0];
            }
          } catch (err) {
            logger.warn('[useSupplierFiscalData] Failed to fetch branch data:', err);
          }
        }

        return {
          cst: vss.cst,
          cfop: vss.cfop,
          cfop_interstate: null,
          icms_rate: vss.icms_rate,
          pis_rate: vss.pis_rate,
          cofins_rate: vss.cofins_rate,
          cest: vss.cest,
          csosn: vss.csosn,
          operation_nature: vss.operation_nature,
          supplier_branch_id: vss.supplier_branch_id,
          branch_name: branchData.branch_name || null,
          branch_cnpj: branchData.cnpj || null,
          branch_state_uf: branchData.state_uf || null,
          branch_tax_regime: branchData.tax_regime || null,
          branch_icms_internal: branchData.icms_internal_rate ?? null,
          branch_icms_interstate: branchData.icms_interstate_rate ?? null,
          isInherited: false,
          _variantId: matchedVariantId || undefined,
        };
      }

      // 4. INHERITANCE: No VSS found — fall back to supplier_branches defaults.
      // Errors here are NOT swallowed: this is the only data source when no override
      // exists, so a fetch failure should surface to TanStack Query's retry logic.
      const branchesResult = await untypedFrom('supplier_branches')
        .select(BRANCH_SELECT)
        .eq('supplier_id', supplierId)
        .eq('is_active', true)
        .limit(5);

      if (branchesResult.error) {
        throw branchesResult.error;
      }

      if (branchesResult.data?.length) {
        const branch = branchesResult.data[0] as BranchRecord;
        const result = buildFromBranch(branch);
        result._variantId = matchedVariantId || undefined;
        return result;
      }

      return null;
    },
    enabled: !!productId && !!supplierId,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Save fiscal override: creates or updates a variant_supplier_sources record.
   */
  const saveFiscalOverride = useCallback(
    async (input: FiscalOverrideInput): Promise<boolean> => {
      if (!productId || !supplierId) return false;

      try {
        // Get existing data to know if we're creating or updating
        const currentData = query.data;
        let variantId = currentData?._variantId;

        // If no variant exists, create a default one for this product
        if (!variantId) {
          logger.log(
            '[saveFiscalOverride] No variant found, creating default variant for product:',
            productId,
          );
          const createResult = await untypedFrom('product_variants')
            .insert({
              product_id: productId,
              sku: `DEFAULT-${productId.substring(0, 8)}`,
              is_active: true,
              attributes: {},
            })
            .select('id');
          if (createResult.error) {
            throw new Error(
              `Não foi possível criar variante padrão: ${createResult.error.message}`,
            );
          }
          variantId = createResult.data?.[0]?.id;
        }

        if (!variantId) {
          throw new Error('Nenhum ID de variante disponível para salvar dados fiscais');
        }

        // Check if VSS record already exists
        const existingResult = await untypedFrom('variant_supplier_sources')
          .select('id')
          .eq('supplier_id', supplierId)
          .eq('variant_id', variantId)
          .limit(1);

        const payload = {
          cst: input.cst || null,
          cfop: input.cfop || null,
          icms_rate: input.icms_rate,
          pis_rate: input.pis_rate,
          cofins_rate: input.cofins_rate,
          cest: input.cest || null,
          csosn: input.csosn || null,
          operation_nature: input.operation_nature || null,
        };

        if (existingResult.data?.length) {
          // Update existing VSS
          await untypedFrom('variant_supplier_sources')
            .update(payload)
            .eq('id', existingResult.data[0].id);
        } else {
          // Fetch organization_id from an existing VSS record for this supplier
          let organizationId: string | null = null;
          try {
            const orgResult = await untypedFrom('variant_supplier_sources')
              .select('organization_id')
              .eq('supplier_id', supplierId)
              .limit(1);
            if (orgResult.data?.length) {
              organizationId = orgResult.data[0].organization_id;
            }
          } catch (e) {
            logger.warn('[saveFiscalOverride] Could not fetch org_id from existing VSS:', e);
          }

          // Create new VSS with supplier_branch_id from inherited data
          await untypedFrom('variant_supplier_sources').insert({
            ...payload,
            supplier_id: supplierId,
            variant_id: variantId,
            supplier_branch_id: currentData?.supplier_branch_id || null,
            ...(organizationId ? { organization_id: organizationId } : {}),
          });
        }

        // Invalidate and refetch
        await queryClient.invalidateQueries({ queryKey });
        return true;
      } catch (err) {
        logger.error('[saveFiscalOverride] Failed to save fiscal override:', err);
        return false;
      }
    },
    [productId, supplierId, query.data, queryClient, queryKey],
  );

  /**
   * Revert to inherited: deletes the VSS record so data falls back to branch defaults.
   */
  const revertToInherited = useCallback(async (): Promise<boolean> => {
    if (!productId || !supplierId) return false;
    const currentData = query.data;
    if (!currentData || currentData.isInherited) return false;

    try {
      const variantId = currentData._variantId;
      if (!variantId) return false;

      const vssResult = await untypedFrom('variant_supplier_sources')
        .select('id')
        .eq('supplier_id', supplierId)
        .eq('variant_id', variantId)
        .limit(1);

      if (vssResult.data?.length) {
        await untypedFrom('variant_supplier_sources').delete().eq('id', vssResult.data[0].id);
      }

      await queryClient.invalidateQueries({ queryKey });
      return true;
    } catch (err) {
      logger.error('[revertToInherited] Failed:', err);
      return false;
    }
  }, [productId, supplierId, query.data, queryClient, queryKey]);

  return { ...query, saveFiscalOverride, revertToInherited };
}
