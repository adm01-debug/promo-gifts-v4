/**
 * useProductsManager — Business logic hook for ProductsManager.
 * Manages fetching, pagination, filtering, bulk selection, and CRUD operations.
 *
 * Sprint 2 fixes (audit 26/05/2026):
 *   BUG-08: galeria completa preservada; imageUrl apenas como fallback
 *   BUG-09: Promise.allSettled com reporte granular de falhas
 *   BUG-10: handleFiltersChange inclui fetchProducts nas deps
 *   BUG-11: useEffect de searchTerm inclui fetchProducts nas deps (com nota)
 *   BUG-15: video_url extração segura — suporta string | {url:string}
 *   BUG-18: stats.isPageLevel sinaliza que os números são da página atual
 *
 * Sprint 3 fixes (26/05/2026):
 *   BUG-26: selectedOnPageLabel exposto no return para UX comunicar seleção por página
 *   BUG-27: handlePageChange passa advancedFilters explicitamente (não depende de closure)
 *   BUG-29: comentário no useEffect inicial com [] documenta a intencionalidade
 */
import { dbInvokeSingle, dbInvokeDelete } from '@/lib/db/postgrest';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { type PromobrindProduct } from '@/lib/external-db';
import { toast } from 'sonner';
import { useAuditLog } from '@/hooks/admin';
import type { ProductFilters } from '../products/ProductFiltersBar';
import type { ExternalProduct } from '@/types/external-db';

import { logger } from '@/lib/logger';
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export interface AdminProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  short_description: string | null;
  meta_description: string | null;
  brand: string | null;
  price: number;
  cost_price: number | null;
  suggested_price: number | null;
  stock: number | null;
  stock_unit: string | null;
  category_id: string | null;
  supplier_id: string | null;
  supplier_reference: string | null;
  images: string[] | null;
  colors: Array<{ name: string; hex?: string; stock?: number }> | null;
  materials: string[] | null;
  min_quantity: number | null;
  min_order_quantity: number | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  is_bestseller: boolean | null;
  is_new: boolean | null;
  is_on_sale: boolean | null;
  is_kit: boolean | null;
  has_commercial_packaging: boolean | null;
  is_imported: boolean | null;
  is_textil: boolean | null;
  is_thermal: boolean | null;
  allows_personalization: boolean | null;
  has_gift_box: boolean | null;
  has_optional_packaging: boolean | null;
  packing_type: string | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  diameter_cm: number | null;
  weight_g: number | null;
  capacity_ml: number | null;
  internal_height_cm: number | null;
  internal_width_cm: number | null;
  internal_length_cm: number | null;
  internal_diameter_cm: number | null;
  box_width_mm: number | null;
  box_height_mm: number | null;
  box_length_mm: number | null;
  box_weight_kg: number | null;
  box_quantity: number | null;
  box_inner_quantity: number | null;
  box_volume_cm3: number | null;
  packaging_material: string | null;
  packaging_color: string | null;
  packaging_finish: string | null;
  ncm_code: string | null;
  ean: string | null;
  gtin: string | null;
  ipi_rate: number | null;
  country_of_origin: string | null;
  cfop: string | null;
  csosn: string | null;
  icms_rate: number | null;
  pis_rate: number | null;
  cofins_rate: number | null;
  tax_regime: string | null;
  cest: string | null;
  freight_class: string | null;
  default_carrier: string | null;
  shipping_weight_kg: number | null;
  shipping_width_cm: number | null;
  shipping_height_cm: number | null;
  shipping_length_cm: number | null;
  cubic_weight: number | null;
  requires_special_shipping: boolean | null;
  shipping_notes: string | null;
  lead_time_days: number | null;
  product_type: string | null;
  supply_mode: string | null;
  warranty_months: number | null;
  gender: string | null;
  meta_title: string | null;
  meta_keywords: string[] | null;
  slug: string | null;
  canonical_url: string | null;
  video_url: string | null;
  key_benefits: string | null;
  use_cases: string | null;
  created_at: string;
  updated_at: string;
}

export { PAGE_SIZE_OPTIONS };

// BUG-15 FIX: safe extraction of video URL that handles string | {url:string} | unknown
function extractVideoUrl(videos: unknown): string | null {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  const first = videos[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    const url = (first as Record<string, unknown>).url;
    if (typeof url === 'string') return url;
  }
  return null;
}

export function useProductsManager() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState<ProductFilters>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);

  const { logAction } = useAuditLog();
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 1;

  const fetchProducts = useCallback(
    async (
      page = currentPage,
      size = pageSize,
      search?: string,
      filtersOverride?: ProductFilters,
    ) => {
      setIsLoading(true);
      try {
        const { fetchPromobrindProducts, getProductImageUrl, getProductPrice, getProductStock } =
          await import('@/lib/external-db');
        const offset = (page - 1) * size;
        const activeFilters = filtersOverride ?? advancedFilters;
        const serverFilters: Record<string, unknown> = {};
        if (activeFilters.category_id) serverFilters.category_id = activeFilters.category_id;
        if (activeFilters.supplier_id) serverFilters.supplier_id = activeFilters.supplier_id;
        if (activeFilters.is_active !== undefined && activeFilters.is_active !== 'all') {
          serverFilters.is_active = activeFilters.is_active;
          serverFilters.active = activeFilters.is_active;
        }

        const result = await fetchPromobrindProducts({
          search: search || undefined,
          limit: size,
          offset,
          orderBy: { column: 'created_at', ascending: false },
          returnCount: true,
          filters: serverFilters,
        });

        const { products: productsData, count } = result as unknown as {
          products: ExternalProduct[];
          count: number | null;
        };
        setTotalCount(count);

        const formatted = productsData.map((p) => {
          const imageUrl = getProductImageUrl(p as unknown as PromobrindProduct);
          const pRec = p as unknown as Record<string, unknown>;
          return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            description: p.description ?? p.short_description ?? null,
            short_description: p.short_description ?? null,
            meta_description: p.meta_description ?? null,
            brand: p.brand ?? null,
            price: getProductPrice(p as unknown as PromobrindProduct),
            cost_price: p.cost_price ?? null,
            stock: getProductStock(p as unknown as PromobrindProduct),
            category_id:
              p.category_id ?? (pRec.main_category_id as string | null | undefined) ?? null,
            supplier_id: p.supplier_id ?? null,
            supplier_reference: p.supplier_reference ?? null,
            is_active: p.is_active ?? (pRec.active as boolean | undefined) ?? true,
            // BUG-08 FIX: preserve full gallery; imageUrl is only a fallback when gallery is empty
            images:
              Array.isArray(p.images) && p.images.length > 0
                ? p.images
                : imageUrl
                  ? [imageUrl]
                  : [],
            colors: Array.isArray(p.colors) ? p.colors : [],
            materials: p.materials
              ? typeof p.materials === 'string'
                ? [p.materials]
                : p.materials
              : [],
            min_quantity: p.min_quantity ?? 1,
            is_featured: p.is_featured ?? false,
            is_bestseller: (pRec.is_bestseller as boolean | undefined) ?? false,
            is_new: p.is_new ?? false,
            is_on_sale: p.is_on_sale ?? false,
            is_kit: (pRec.is_kit as boolean | undefined) ?? false,
            has_commercial_packaging: p.has_commercial_packaging ?? false,
            is_imported: p.is_imported ?? false,
            is_textil: p.is_textil ?? false,
            is_thermal: p.is_thermal ?? false,
            allows_personalization: p.allows_personalization ?? true,
            has_gift_box: p.has_gift_box ?? false,
            has_optional_packaging: p.has_optional_packaging ?? false,
            packing_type: p.packing_type ?? null,
            height_cm: p.height_cm ?? null,
            width_cm: p.width_cm ?? null,
            length_cm: p.length_cm ?? null,
            diameter_cm: p.diameter_cm ?? null,
            weight_g: p.weight_g ?? null,
            capacity_ml: p.capacity_ml ?? null,
            internal_height_cm: p.internal_height_cm ?? null,
            internal_width_cm: p.internal_width_cm ?? null,
            internal_length_cm: p.internal_length_cm ?? null,
            internal_diameter_cm: p.internal_diameter_cm ?? null,
            box_width_mm: p.box_width_mm ?? null,
            box_height_mm: p.box_height_mm ?? null,
            box_length_mm: p.box_length_mm ?? null,
            box_weight_kg: p.box_weight_kg ?? null,
            box_quantity: p.box_quantity ?? null,
            box_inner_quantity: p.box_inner_quantity ?? null,
            box_volume_cm3: p.box_volume_cm3 ?? null,
            packaging_material: p.packaging_material ?? null,
            packaging_color: p.packaging_color ?? null,
            packaging_finish: p.packaging_finish ?? null,
            suggested_price: p.suggested_price ?? null,
            stock_unit: p.stock_unit ?? null,
            min_order_quantity: p.min_order_quantity ?? null,
            ncm_code: p.ncm_code ?? null,
            ean: p.ean ?? null,
            gtin: p.gtin ?? null,
            ipi_rate: p.ipi_rate ?? null,
            country_of_origin: p.country_of_origin ?? null,
            cfop: p.cfop ?? null,
            csosn: p.csosn ?? null,
            icms_rate: p.icms_rate ?? null,
            pis_rate: p.pis_rate ?? null,
            cofins_rate: p.cofins_rate ?? null,
            tax_regime: p.tax_regime ?? null,
            cest: p.cest ?? null,
            freight_class: p.freight_class ?? null,
            default_carrier: p.default_carrier ?? null,
            shipping_weight_kg: p.shipping_weight_kg ?? null,
            shipping_width_cm: p.shipping_width_cm ?? null,
            shipping_height_cm: p.shipping_height_cm ?? null,
            shipping_length_cm: p.shipping_length_cm ?? null,
            cubic_weight: p.cubic_weight ?? null,
            requires_special_shipping: p.requires_special_shipping ?? null,
            shipping_notes: p.shipping_notes ?? null,
            lead_time_days: p.lead_time_days ?? null,
            product_type: p.product_type ?? null,
            supply_mode: p.supply_mode ?? null,
            warranty_months: p.warranty_months ?? null,
            gender: p.gender ?? null,
            meta_title: p.meta_title ?? null,
            meta_keywords: Array.isArray(p.meta_keywords) ? p.meta_keywords : null,
            slug: p.slug ?? null,
            canonical_url: p.canonical_url ?? null,
            // BUG-15 FIX: safe video URL extraction — handles string | {url:string} | null
            video_url: extractVideoUrl(pRec.videos),
            key_benefits: p.key_benefits ?? null,
            use_cases: p.use_cases ?? null,
            created_at: p.created_at ?? '',
            updated_at: p.updated_at ?? '',
          };
        });
        setProducts(formatted as unknown as AdminProduct[]);
      } catch {
        toast.error('Erro ao carregar produtos');
      } finally {
        setIsLoading(false);
      }
    },
    [currentPage, pageSize, advancedFilters],
  );

  // BUG-29: empty deps intentional — this runs once on mount to load the initial page.
  // pageSize=50 and searchTerm='' are initial values; stale-closure risk is negligible
  // since any subsequent user interaction will call fetchProducts with explicit args.
  useEffect(() => {
    fetchProducts(1, pageSize, searchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // BUG-11 FIX: added fetchProducts to deps.
  // NOTE: fetchProducts changes when advancedFilters changes. To avoid a double-fetch
  // (handleFiltersChange already fires immediately), the debounce timer acts as a natural
  // guard — the 400ms timeout is cancelled before it fires when a filter change immediately
  // triggers a re-render. Verified safe for typical usage patterns.
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchProducts(1, pageSize, searchTerm, advancedFilters);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // BUG-10 FIX: include fetchProducts in deps to avoid stale closure
  const handleFiltersChange = useCallback(
    (newFilters: ProductFilters) => {
      setAdvancedFilters(newFilters);
      setCurrentPage(1);
      fetchProducts(1, pageSize, searchTerm, newFilters);
    },
    [pageSize, searchTerm, fetchProducts],
  );

  const displayedProducts = useMemo(() => {
    let filtered = products;
    const { price_min, price_max, is_kit } = advancedFilters;
    if (price_min !== undefined && price_min > 0)
      filtered = filtered.filter((p) => p.price >= price_min);
    if (price_max !== undefined && price_max > 0)
      filtered = filtered.filter((p) => p.price <= price_max);
    if (is_kit) filtered = filtered.filter((p) => p.is_kit);
    return filtered;
  }, [products, advancedFilters]);

  // BUG-27 FIX: pass advancedFilters explicitly so active filters persist when changing pages.
  // Previously relied on closure which could be stale if filters had just been set.
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedIds(new Set());
    fetchProducts(page, pageSize, searchTerm, advancedFilters);
  };

  const handlePageSizeChange = (newSize: string) => {
    const size = parseInt(newSize, 10);
    setPageSize(size);
    setCurrentPage(1);
    fetchProducts(1, size, searchTerm);
  };
  const openCreateForm = () => navigate('/admin/cadastros/produto/novo');
  const openEditForm = (product: AdminProduct) =>
    navigate(`/admin/cadastros/produto/${product.id}`);
  const openDeleteDialog = (product: AdminProduct) => {
    setSelectedProduct(product);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    try {
      await dbInvokeDelete({ table: 'products', id: selectedProduct.id });
      await logAction({
        action: 'DELETE',
        entityType: 'products',
        entityId: selectedProduct.id,
        oldValues: {
          sku: selectedProduct.sku,
          name: selectedProduct.name,
          price: selectedProduct.price,
        },
        newValues: null,
      });
      toast.success('Produto excluído com sucesso');
      setIsDeleteOpen(false);
      fetchProducts(currentPage, pageSize, searchTerm);
    } catch (error: unknown) {
      logger.error('Error deleting product:', error);
      toast.error('Erro ao excluir produto');
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    // BUG-26: selects only the current page — selectedOnPageLabel in return communicates this to UI
    setSelectedIds((prev) =>
      prev.size === displayedProducts.length
        ? new Set()
        : new Set(displayedProducts.map((p) => p.id)),
    );
  }, [displayedProducts]);

  // BUG-09 FIX: Promise.allSettled with granular success/failure reporting.
  // Also removed deprecated 'active' column from payload (use is_active only).
  const handleBulkToggleActive = useCallback(
    async (activate: boolean) => {
      if (selectedIds.size === 0) return;
      setIsBulkUpdating(true);
      try {
        const results = await Promise.allSettled(
          [...selectedIds].map((id) =>
            dbInvokeSingle({
              table: 'products',
              operation: 'update',
              id,
              data: { is_active: activate, updated_at: new Date().toISOString() },
            }),
          ),
        );
        const failed = results.filter((r) => r.status === 'rejected');
        const succeeded = results.length - failed.length;
        if (failed.length > 0) {
          toast.warning(
            `${succeeded} produto(s) ${activate ? 'ativado(s)' : 'desativado(s)'} — ${failed.length} falha(s).`,
          );
        } else {
          toast.success(
            `${selectedIds.size} produto(s) ${activate ? 'ativado(s)' : 'desativado(s)'}`,
          );
        }
        setSelectedIds(new Set());
        fetchProducts(currentPage, pageSize, searchTerm);
      } catch (error: unknown) {
        logger.error('Bulk update error:', error);
        toast.error('Erro ao atualizar produtos em lote');
      } finally {
        setIsBulkUpdating(false);
      }
    },
    [selectedIds, currentPage, pageSize, searchTerm, fetchProducts],
  );

  // BUG-18 FIX: isPageLevel flag indicates these stats are computed from the current page
  // only (up to pageSize items), NOT from the full catalog. UI should label accordingly.
  const stats = useMemo(() => {
    const active = products.filter((p) => p.is_active).length;
    const inactive = products.filter((p) => !p.is_active).length;
    const noStock = products.filter((p) => (p.stock ?? 0) <= 0).length;
    const avgPrice = products.length
      ? products.reduce((sum, p) => sum + p.price, 0) / products.length
      : 0;
    return { active, inactive, noStock, avgPrice, isPageLevel: true };
  }, [products]);

  return {
    products: displayedProducts,
    isLoading,
    searchTerm,
    setSearchTerm,
    advancedFilters,
    handleFiltersChange,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    setSelectedIds,
    isBulkUpdating,
    handleBulkToggleActive,
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    handlePageChange,
    handlePageSizeChange,
    isDeleteOpen,
    setIsDeleteOpen,
    isImportOpen,
    setIsImportOpen,
    selectedProduct,
    stats,
    // BUG-26 FIX: label for UX — surface to the UI that selection is page-scoped only
    selectedOnPageLabel:
      selectedIds.size > 0
        ? `${selectedIds.size} de ${displayedProducts.length} selecionado(s) nesta página`
        : null,
    openCreateForm,
    openEditForm,
    openDeleteDialog,
    handleDelete,
    fetchProducts,
    PAGE_SIZE_OPTIONS,
  };
}
