/**
 * Hook to fetch fiscal data from variant_supplier_sources + supplier_branches
 * for a given product's preferred supplier source.
 * 
 * INHERITANCE: If no VSS record exists, falls back to supplier_branches defaults.
 * OVERRIDE: saveFiscalOverride() creates/updates VSS records to override inherited data.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db';
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

const BRANCH_SELECT = 'id, branch_name, cnpj, state_uf, tax_regime, icms_internal_rate, icms_interstate_rate, default_cst, default_cfop_internal, default_cfop_interstate, default_pis_rate, default_cofins_rate, default_cest, default_csosn, default_operation_nature';

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
export function useSupplierFiscalData(productId: string | undefined, supplierId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['supplier-fiscal-data', productId, supplierId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<SupplierFiscalData | null> => {
      if (!productId || !supplierId) return null;

      // 1. First get variant IDs for this product to scope the VSS query
      const variantsResult = await invokeExternalDb<{ id: string }>({
        table: 'product_variants',
        operation: 'select',
        select: 'id',
        filters: { product_id: productId },
        limit: 200,
      });

      let vss: VSSRecord | null = null;
      let matchedVariantId: string | null = null;

      if (variantsResult.records.length) {
        // 2. Get variant_supplier_sources for this supplier + product's variants
        const variantIds = variantsResult.records.map(v => v.id);
        
        for (const variantId of variantIds.slice(0, 5)) {
          const vssResult = await invokeExternalDb<VSSRecord>({
            table: 'variant_supplier_sources',
            operation: 'select',
            select: 'id, cst, cfop, icms_rate, pis_rate, cofins_rate, cest, csosn, operation_nature, supplier_branch_id, variant_id',
            filters: { supplier_id: supplierId, variant_id: variantId },
            limit: 1,
          });
          if (vssResult.records.length) {
            vss = vssResult.records[0];
            matchedVariantId = variantId;
            break;
          }
        }

        // Keep first variant ID for potential new VSS creation
        if (!matchedVariantId && variantsResult.records.length) {
          matchedVariantId = variantsResult.records[0].id;
        }
      }

      // 3. If we have VSS, fetch branch details and return specific data
      if (vss) {
        let branchData: Partial<BranchRecord> = {};
        if (vss.supplier_branch_id) {
          try {
            const branchResult = await invokeExternalDb<BranchRecord>({
              table: 'supplier_branches',
              operation: 'select',
              select: BRANCH_SELECT,
              filters: { id: vss.supplier_branch_id },
              limit: 1,
            });
            if (branchResult.records.length) {
              branchData = branchResult.records[0];
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

      // 4. INHERITANCE: No VSS found — fall back to supplier_branches defaults
      try {
        const branchesResult = await invokeExternalDb<BranchRecord>({
          table: 'supplier_branches',
          operation: 'select',
          select: BRANCH_SELECT,
          filters: { supplier_id: supplierId, is_active: true },
          limit: 5,
        });

        if (branchesResult.records.length) {
          const branch = branchesResult.records[0];
          const result = buildFromBranch(branch);
          result._variantId = matchedVariantId || undefined;
          return result;
        }
      } catch (err) {
        logger.warn('[useSupplierFiscalData] Failed to fetch branch defaults for inheritance:', err);
      }

      return null;
    },
    enabled: !!productId && !!supplierId,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Save fiscal override: creates or updates a variant_supplier_sources record.
   */
  const saveFiscalOverride = useCallback(async (input: FiscalOverrideInput): Promise<boolean> => {
    if (!productId || !supplierId) return false;

    try {
      // Get existing data to know if we're creating or updating
      const currentData = query.data;
      let variantId = currentData?._variantId;

      // If no variant exists, create a default one for this product
      if (!variantId) {
        logger.log('[saveFiscalOverride] No variant found, creating default variant for product:', productId);
        try {
          const createResult = await invokeExternalDb<{ id: string }>({
            table: 'product_variants',
            operation: 'insert',
            data: {
              product_id: productId,
              sku: `DEFAULT-${productId.substring(0, 8)}`,
              is_active: true,
              attributes: {},
            },
          });
          if (createResult.records?.length) {
            variantId = createResult.records[0].id;
          } else if ((createResult as Record<string, unknown>).id) {
            variantId = (createResult as Record<string, unknown>).id as string;
          }
        } catch (err) {
          console.error('[saveFiscalOverride] Failed to create default variant:', err);
        }
      }

      if (!variantId) {
        console.error('[saveFiscalOverride] No variant ID available even after creation attempt');
        return false;
      }

      // Check if VSS record already exists
      const existingResult = await invokeExternalDb<{ id: string }>({
        table: 'variant_supplier_sources',
        operation: 'select',
        select: 'id',
        filters: { supplier_id: supplierId, variant_id: variantId },
        limit: 1,
      });

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

      if (existingResult.records.length) {
        // Update existing VSS
        await invokeExternalDb({
          table: 'variant_supplier_sources',
          operation: 'update',
          id: existingResult.records[0].id,
          data: payload,
        });
      } else {
        // Fetch organization_id from an existing VSS record for this supplier
        let organizationId: string | null = null;
        try {
          const orgResult = await invokeExternalDb<{ organization_id: string }>({
            table: 'variant_supplier_sources',
            operation: 'select',
            select: 'organization_id',
            filters: { supplier_id: supplierId },
            limit: 1,
          });
          if (orgResult.records.length) {
            organizationId = orgResult.records[0].organization_id;
          }
        } catch (e) {
          logger.warn('[saveFiscalOverride] Could not fetch org_id from existing VSS:', e);
        }

        // Create new VSS with supplier_branch_id from inherited data
        await invokeExternalDb({
          table: 'variant_supplier_sources',
          operation: 'insert',
          data: {
            ...payload,
            supplier_id: supplierId,
            variant_id: variantId,
            supplier_branch_id: currentData?.supplier_branch_id || null,
            ...(organizationId ? { organization_id: organizationId } : {}),
          },
        });
      }

      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey });
      return true;
    } catch (err) {
      console.error('[saveFiscalOverride] Failed to save fiscal override:', err);
      return false;
    }
  }, [productId, supplierId, query.data, queryClient, queryKey]);

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

      const vssResult = await invokeExternalDb<{ id: string }>({
        table: 'variant_supplier_sources',
        operation: 'select',
        select: 'id',
        filters: { supplier_id: supplierId, variant_id: variantId },
        limit: 1,
      });

      if (vssResult.records.length) {
        await invokeExternalDb({
          table: 'variant_supplier_sources',
          operation: 'delete',
          id: vssResult.records[0].id,
        });
      }

      await queryClient.invalidateQueries({ queryKey });
      return true;
    } catch (err) {
      console.error('[revertToInherited] Failed:', err);
      return false;
    }
  }, [productId, supplierId, query.data, queryClient, queryKey]);

  return { ...query, saveFiscalOverride, revertToInherited };
}
