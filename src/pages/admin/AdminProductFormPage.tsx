/**
 * AdminProductFormPage — Página full-screen para criar/editar produtos
 * Substitui o Dialog modal por uma experiência imersiva com sidebar de navegação
 *
 * Sprint 3 (26/05/2026):
 *   BUG-03: engravingFlushRef criado aqui e passado para ProductFormFullscreen.
 *            Após criação bem-sucedida do produto, chama flushLocalAreas(newProduct.id)
 *            ANTES de navigate() para que as áreas de gravação configuradas no wizard
 *            sejam persistidas e apareçam em edit mode.
 */

import { dbInvokeSingle } from '@/lib/db/postgrest';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchPromobrindProductById,
  getProductImageUrl,
  getProductPrice,
  getProductStock,
  type PromobrindProduct,
} from '@/lib/external-db';
import { useAuditLog, fetchAuditHistory } from '@/hooks/admin';
import { toast } from 'sonner';
import type { ProductFormData } from '@/components/admin/products/ProductFormSchema';
import { ORGANIZATION_ID } from '@/components/admin/products/new-supplier/types';
import { Loader2, ArrowLeft, History, Pencil, Copy, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { PageSEO } from '@/components/seo/PageSEO';

import { logger } from '@/lib/logger';
const ProductFormFullscreen = lazyWithRetry(() =>
  import('@/components/admin/products/ProductFormFullscreen').then((m) => ({
    default: m.ProductFormFullscreen,
  })),
);
const AuditHistory = lazyWithRetry(() =>
  import('@/components/audit/AuditHistory').then((m) => ({ default: m.AuditHistory })),
);

const PRICE_FRESHNESS_THRESHOLD_COLUMN = 'price_freshness_threshold_days';

function isMissingPriceFreshnessThresholdColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /price_freshness_threshold_days|column products\.price_freshness_threshold_days does not exist/i.test(
    message,
  );
}

function withoutPriceFreshnessThreshold(data: Record<string, unknown>): Record<string, unknown> {
  const fallbackData = { ...data };
  delete fallbackData[PRICE_FRESHNESS_THRESHOLD_COLUMN];
  return fallbackData;
}

/**
 * Convert a multi-line textarea value into a clean Postgres text[] (one entry per
 * non-empty line). products.key_benefits and products.use_cases are ARRAY columns;
 * sending a raw string makes PostgREST reject the write ("malformed array literal").
 */
function splitLines(value: string | null | undefined): string[] | null {
  if (!value) return null;
  const arr = value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length > 0 ? arr : null;
}

export default function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'novo';

  const [product, setProduct] = useState<PromobrindProduct | null>(null);
  const [duplicateProduct, setDuplicateProduct] = useState<PromobrindProduct | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [lastPriceUpdate, setLastPriceUpdate] = useState<{ date: string; user: string } | null>(
    null,
  );

  // BUG-03 FIX: ref populated by ProductEngravingSection with flushLocalAreas.
  // After product creation, we call this before navigate() so local engraving areas
  // are persisted and immediately visible when the page re-renders in edit mode.
  const engravingFlushRef = useRef<((id: string) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!isEdit) {
      const stored = sessionStorage.getItem('duplicate_product');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setDuplicateProduct(parsed);
          toast.info(`Duplicando produto: ${parsed.name}. Altere o SKU antes de salvar.`);
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem('duplicate_product');
      }
    }
  }, [isEdit]);

  const { logAction, getChangedFields } = useAuditLog();

  useEffect(() => {
    if (!isEdit) return;
    const loadProduct = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const fullProduct = await fetchPromobrindProductById(id);
        if (fullProduct) {
          setProduct(fullProduct);
        } else {
          toast.error('Produto não encontrado');
          navigate('/admin/cadastros');
        }
      } catch {
        toast.error('Erro ao carregar produto');
        navigate('/admin/cadastros');
      } finally {
        setIsLoading(false);
      }
    };
    loadProduct();

    // Fetch last price freshness update from audit log
    if (isEdit && id) {
      const loadHistory = async () => {
        const logs = await fetchAuditHistory('products', id);
        const priceLog = logs.find(
          (log) =>
            log.action === 'UPDATE' &&
            log.new_values &&
            'price_freshness_threshold_days' in log.new_values,
        );
        if (priceLog) {
          setLastPriceUpdate({
            date: priceLog.created_at,
            user: priceLog.profiles?.full_name || priceLog.profiles?.email || 'Sistema',
          });
        }
      };
      loadHistory();
    }
  }, [id, isEdit, navigate]);

  const productToFormData = useCallback((p: PromobrindProduct): Partial<ProductFormData> => {
    return {
      sku: p.sku || '',
      name: p.name || '',
      description: p.description ?? p.short_description ?? '',
      short_description: p.short_description ?? '',
      meta_description: p.meta_description ?? '',
      brand: p.brand ?? '',
      category_id: p.category_id ?? p.main_category_id ?? '',
      supplier_id: p.supplier_id ?? '',
      supplier_reference: p.supplier_reference ?? '',
      supplier_product_url: p.supplier_product_url ?? '',
      sale_price: getProductPrice(p) ?? 0,
      cost_price: p.cost_price ?? 0,
      suggested_price: p.suggested_price ?? null,
      stock_quantity: getProductStock(p) ?? 0,
      stock_unit: p.stock_unit ?? 'un',
      product_type: p.product_type ?? (p.is_kit ? 'kit' : 'product'),
      min_quantity: p.min_quantity ?? 1,
      min_order_quantity: p.min_order_quantity ?? null,
      price_freshness_threshold_days: p.price_freshness_threshold_days ?? 60,
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
      packing_type: p.packing_type ?? '',
      box_width_mm: p.box_width_mm ?? null,
      box_height_mm: p.box_height_mm ?? null,
      box_length_mm: p.box_length_mm ?? null,
      box_weight_kg: p.box_weight_kg ?? null,
      box_quantity: p.box_quantity ?? null,
      box_inner_quantity: p.box_inner_quantity ?? null,
      box_volume_cm3: p.box_volume_cm3 ?? null,
      packaging_material: p.packaging_material ?? '',
      packaging_color: p.packaging_color ?? '',
      packaging_finish: p.packaging_finish ?? '',
      is_active: p.is_active ?? p.active ?? true,
      is_featured: p.is_featured ?? false,
      is_bestseller: p.is_bestseller ?? false,
      is_new: p.is_new ?? false,
      is_on_sale: p.is_on_sale ?? false,
      is_featured_expires_at: p.is_featured_expires_at ?? null,
      is_bestseller_expires_at: p.is_bestseller_expires_at ?? null,
      is_new_expires_at: p.is_new_expires_at ?? p.novelty_expires_at ?? null,
      is_on_sale_expires_at: p.is_on_sale_expires_at ?? null,
      is_kit: p.is_kit ?? false,
      has_commercial_packaging: p.has_commercial_packaging ?? false,
      is_imported: p.is_imported ?? false,
      is_textil: p.is_textil ?? false,
      is_thermal: p.is_thermal ?? false,
      allows_personalization: p.allows_personalization ?? true,
      has_gift_box: p.has_gift_box ?? false,
      has_optional_packaging: p.has_optional_packaging ?? false,
      ncm_code: p.ncm_code ?? '',
      ean: p.ean ?? '',
      gtin: p.gtin ?? '',
      ipi_rate: p.ipi_rate ?? null,
      country_of_origin: p.country_of_origin ?? p.origin_country ?? '',
      cfop: p.cfop ?? '',
      csosn: p.csosn ?? '',
      icms_rate: p.icms_rate ?? null,
      pis_rate: p.pis_rate ?? null,
      cofins_rate: p.cofins_rate ?? null,
      tax_regime: p.tax_regime ?? '',
      cest: p.cest ?? '',
      freight_class: p.freight_class ?? '',
      default_carrier: p.default_carrier ?? '',
      shipping_weight_kg: p.shipping_weight_kg ?? null,
      shipping_width_cm: p.shipping_width_cm ?? null,
      shipping_height_cm: p.shipping_height_cm ?? null,
      shipping_length_cm: p.shipping_length_cm ?? null,
      cubic_weight: p.cubic_weight ?? null,
      requires_special_shipping: p.requires_special_shipping ?? false,
      shipping_notes: p.shipping_notes ?? '',
      lead_time_days: p.lead_time_days ?? null,
      supply_mode: p.supply_mode ?? '',
      warranty_months: p.warranty_months ?? null,
      gender: p.gender ?? '',
      meta_title: p.meta_title ?? '',
      meta_keywords: Array.isArray(p.meta_keywords) ? p.meta_keywords.join(', ') : '',
      slug: p.slug ?? '',
      canonical_url: p.canonical_url ?? '',
      video_url: p.videos?.[0] ?? p.video_url ?? '',
      key_benefits: Array.isArray(p.key_benefits)
        ? p.key_benefits.join('\n')
        : (p.key_benefits ?? ''),
      use_cases: Array.isArray(p.use_cases) ? p.use_cases.join('\n') : (p.use_cases ?? ''),
    };
  }, []);

  const handleFormSubmit = async (data: ProductFormData, images: string[]) => {
    setIsSaving(true);
    try {
      const skuChanged = isEdit && product && data.sku !== product.sku;
      if (!isEdit || skuChanged) {
        const { fetchPromobrindProducts } = await import('@/lib/external-db');
        const existing = await fetchPromobrindProducts({ search: data.sku, limit: 5 });
        const products: PromobrindProduct[] = Array.isArray(existing)
          ? existing
          : ((existing as { products?: PromobrindProduct[] }).products ?? []);
        const duplicate = products.find(
          (p: PromobrindProduct) => p.sku?.toLowerCase() === data.sku.toLowerCase(),
        );
        if (duplicate) {
          toast.error(`SKU "${data.sku}" já está cadastrado no produto "${duplicate.name}"`);
          setIsSaving(false);
          return;
        }
      }

      const productData: Record<string, unknown> = {
        sku: data.sku,
        name: data.name,
        // REQUIRED by the products RLS INSERT/UPDATE policy, which gates on
        // is_org_owner_or_admin(organization_id). Without it the row's org is NULL and
        // the WITH CHECK fails → "new row violates row-level security policy".
        organization_id: ORGANIZATION_ID,
        description: data.description || null,
        short_description: data.short_description || null,
        meta_description: data.meta_description || null,
        brand: data.brand || null,
        category_id: data.category_id || null,
        supplier_id: data.supplier_id || null,
        supplier_reference: data.supplier_reference || null,
        sale_price: data.sale_price ?? 0,
        cost_price: data.cost_price ?? null,
        suggested_price: data.suggested_price ?? null,
        stock_quantity: data.stock_quantity ?? 0,
        product_type: data.product_type || 'product',
        is_kit: data.product_type === 'kit',
        min_quantity: data.min_quantity ?? 1,
        min_order_quantity: data.min_order_quantity ?? null,
        price_freshness_threshold_days: data.price_freshness_threshold_days ?? 60,
        is_active: data.is_active,
        active: data.is_active,
        is_featured: data.is_featured,
        is_bestseller: data.is_bestseller,
        is_new: data.is_new,
        is_on_sale: data.is_on_sale,
        is_featured_expires_at: data.is_featured_expires_at || null,
        is_bestseller_expires_at: data.is_bestseller_expires_at || null,
        is_new_expires_at: data.is_new_expires_at || null,
        is_on_sale_expires_at: data.is_on_sale_expires_at || null,
        has_commercial_packaging: data.has_commercial_packaging,
        is_imported: data.is_imported,
        is_textil: data.is_textil,
        is_thermal: data.is_thermal,
        allows_personalization: data.allows_personalization,
        has_gift_box: data.has_gift_box,
        has_optional_packaging: data.has_optional_packaging,
        packing_type: data.packing_type || null,
        height_cm: data.height_cm ?? null,
        width_cm: data.width_cm ?? null,
        length_cm: data.length_cm ?? null,
        diameter_cm: data.diameter_cm ?? null,
        weight_g: data.weight_g ?? null,
        capacity_ml: data.capacity_ml ?? null,
        internal_height_cm: data.internal_height_cm ?? null,
        internal_width_cm: data.internal_width_cm ?? null,
        internal_length_cm: data.internal_length_cm ?? null,
        internal_diameter_cm: data.internal_diameter_cm ?? null,
        box_width_mm: data.box_width_mm ?? null,
        box_height_mm: data.box_height_mm ?? null,
        box_length_mm: data.box_length_mm ?? null,
        box_weight_kg: data.box_weight_kg ?? null,
        box_quantity: data.box_quantity ?? null,
        box_inner_quantity: data.box_inner_quantity ?? null,
        box_volume_cm3: data.box_volume_cm3 ?? null,
        packaging_material: data.packaging_material || null,
        packaging_color: data.packaging_color || null,
        packaging_finish: data.packaging_finish || null,
        ncm_code: data.ncm_code || null,
        ean: data.ean || null,
        gtin: data.gtin || null,
        origin_country: data.country_of_origin || null,
        supplier_product_url: data.supplier_product_url || null,
        supply_mode: data.supply_mode || null,
        ipi_rate: data.ipi_rate ?? null,
        lead_time_days: data.lead_time_days ?? null,
        gender: data.gender || null,
        meta_title: data.meta_title || null,
        meta_keywords: data.meta_keywords
          ? data.meta_keywords
              .split(',')
              .map((k: string) => k.trim())
              .filter(Boolean)
          : null,
        slug: data.slug || null,
        canonical_url: data.canonical_url || null,
        videos: data.video_url ? [data.video_url] : [],
        key_benefits: splitLines(data.key_benefits),
        use_cases: splitLines(data.use_cases),
        updated_at: new Date().toISOString(),
      };

      if (images.length > 0) {
        productData.images = images;
        productData.primary_image_url = images[0];
      }

      let savedProductData = productData;

      if (isEdit && product) {
        try {
          await dbInvokeSingle<PromobrindProduct>({
            table: 'products',
            operation: 'update',
            id: product.id,
            data: productData,
          });
        } catch (error) {
          if (!isMissingPriceFreshnessThresholdColumn(error)) throw error;
          savedProductData = withoutPriceFreshnessThreshold(productData);
          await dbInvokeSingle<PromobrindProduct>({
            table: 'products',
            operation: 'update',
            id: product.id,
            data: savedProductData,
          });
          toast.warning(
            'Produto salvo. A validade do preço usará 60 dias até a coluna existir no banco.',
          );
        }

        const { oldFields, newFields } = getChangedFields(
          {
            sku: product.sku,
            name: product.name,
            description: product.description,
            sale_price: getProductPrice(product),
            stock_quantity: getProductStock(product),
            is_active: product.is_active,
            price_freshness_threshold_days: product.price_freshness_threshold_days,
          },
          savedProductData,
        );
        if (Object.keys(newFields).length > 0) {
          await logAction({
            action: 'UPDATE',
            entityType: 'products',
            entityId: product.id,
            oldValues: oldFields,
            newValues: newFields,
          });
        }

        toast.success('Produto atualizado com sucesso');
        const refreshed = await fetchPromobrindProductById(product.id);
        if (refreshed) setProduct(refreshed);
      } else {
        let newProduct: PromobrindProduct | null;
        try {
          newProduct = await dbInvokeSingle<PromobrindProduct>({
            table: 'products',
            operation: 'insert',
            data: { ...productData, created_at: new Date().toISOString() },
          });
        } catch (error) {
          if (!isMissingPriceFreshnessThresholdColumn(error)) throw error;
          savedProductData = withoutPriceFreshnessThreshold(productData);
          newProduct = await dbInvokeSingle<PromobrindProduct>({
            table: 'products',
            operation: 'insert',
            data: { ...savedProductData, created_at: new Date().toISOString() },
          });
          toast.warning(
            'Produto criado. A validade do preço usará 60 dias até a coluna existir no banco.',
          );
        }

        if (newProduct) {
          await logAction({
            action: 'INSERT',
            entityType: 'products',
            entityId: newProduct.id,
            oldValues: null,
            newValues: {
              sku: savedProductData.sku,
              name: savedProductData.name,
              sale_price: savedProductData.sale_price,
              is_active: savedProductData.is_active,
            },
          });

          // BUG-03 FIX: flush local engraving areas to DB BEFORE navigating to edit mode.
          // This prevents areas configured in the wizard from being silently discarded.
          if (engravingFlushRef.current) {
            try {
              await engravingFlushRef.current(newProduct.id);
            } catch (flushErr) {
              // Non-fatal: log and continue — user can re-add areas in edit mode
              logger.error('[AdminProductFormPage] Failed to flush engraving areas:', flushErr);
              toast.warning(
                'Produto criado, mas algumas áreas de gravação não puderam ser salvas. Verifique na aba de Gravação.',
              );
            }
          }

          toast.success('Produto criado! Agora vincule Tags, Ramos, Marketing e Técnicas.');
          navigate(`/admin/cadastros/produto/${newProduct.id}`, { replace: true });
          return;
        }
        toast.success('Produto criado com sucesso');
        navigate('/admin/cadastros');
      }
    } catch (error: unknown) {
      logger.error('Error saving product:', error);
      toast.error('Erro ao salvar produto');
    } finally {
      setIsSaving(false);
    }
  };

  const getProductImages = useCallback((p: PromobrindProduct): string[] => {
    if (!p) return [];
    const imgUrl = getProductImageUrl(p);
    if (imgUrl)
      return [
        imgUrl,
        ...(Array.isArray(p.images) ? p.images.filter((i: string) => i !== imgUrl) : []),
      ];
    return Array.isArray(p.images) ? p.images : [];
  }, []);

  if (isLoading) {
    return (
      <>
        <PageSEO
          title="Carregando Produto..."
          description="Aguarde enquanto carregamos os dados do produto."
          path="/admin/cadastros/produto"
          noIndex
        />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando produto...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageSEO
        title={isEdit ? `Editar: ${product?.sku || 'Produto'}` : 'Novo Produto'}
        description={
          isEdit ? `Editando o produto ${product?.name}` : 'Cadastre um novo produto no catálogo.'
        }
        path={`/admin/cadastros/produto/${id || 'novo'}`}
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <h1 data-testid="page-title-admin-produto" className="sr-only">
          {isEdit ? 'Editar Produto' : 'Novo Produto'}
        </h1>

        {isEdit && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Voltar"
                onClick={() => navigate('/admin/cadastros')}
                className="h-9 w-9 rounded-lg"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {isEdit && product && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {product.sku} — {product.name}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isEdit && product && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={async () => {
                      const { exportProductPdf } = await import('@/utils/productPdfExport');
                      const formData = productToFormData(product) as ProductFormData;
                      exportProductPdf({
                        formData,
                        productImages: getProductImages(product),
                        categoryName: product.category_name || product.category || '',
                        supplierName: product.supplier_name || product.supplier || '',
                      });
                      toast.success('PDF gerado com sucesso!');
                    }}
                  >
                    <FileDown className="h-3.5 w-3.5" /> Exportar PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      const dupeData = { ...product, sku: `${product.sku}-COPIA` };
                      sessionStorage.setItem('duplicate_product', JSON.stringify(dupeData));
                      navigate('/admin/cadastros/produto/novo');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicar
                  </Button>
                </>
              )}

              {isEdit && (
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as 'form' | 'history')}
                >
                  <TabsList className="h-9">
                    <TabsTrigger value="form" className="gap-1.5 text-xs">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5 text-xs">
                      <History className="h-3.5 w-3.5" /> Histórico
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
          </div>
        )}

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          }
        >
          {activeTab === 'form' ? (
            <ProductFormFullscreen
              initialData={
                isEdit && product
                  ? productToFormData(product)
                  : duplicateProduct
                    ? productToFormData(duplicateProduct)
                    : undefined
              }
              productImages={
                isEdit && product
                  ? getProductImages(product)
                  : duplicateProduct
                    ? getProductImages(duplicateProduct)
                    : []
              }
              productId={isEdit ? id : undefined}
              onSubmit={handleFormSubmit}
              onCancel={() => navigate('/admin/cadastros')}
              isSaving={isSaving}
              isEdit={isEdit}
              engravingFlushRef={engravingFlushRef}
              lastPriceUpdate={lastPriceUpdate}
            />
          ) : (
            isEdit &&
            id && (
              <AuditHistory
                entityType="products"
                entityId={id}
                title="Histórico de Alterações"
                maxHeight="70vh"
              />
            )
          )}
        </Suspense>
      </div>
    </>
  );
}
