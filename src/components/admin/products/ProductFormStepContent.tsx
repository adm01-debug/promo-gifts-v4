/**
 * ProductFormStepContent — Renderiza o conteúdo de cada etapa do formulário
 *
 * Sprint 3 (26/05/2026):
 *   BUG-03: pass engravingFlushRef down to ProductEngravingSection
 */
import React, { Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Package, Layers, Info, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionCard, type FormSectionProps } from './ProductFormHelpers';
import { CategoryCascadeSelector } from './CategoryCascadeSelector';
import { ProductSupplierSection } from './sections/ProductSupplierSection';
import { ProductInfoSection } from './sections/ProductInfoSection';
import { ProductDimensionsSection } from './sections/ProductDimensionsSection';
import { ProductPriceSection } from './sections/ProductPriceSection';
import { ProductFlagsSection } from './sections/ProductFlagsSection';
import { ProductPackagingSection } from './sections/ProductPackagingSection';
import { ProductFiscalSection } from './sections/ProductFiscalSection';
import { ProductSeoSection } from './sections/ProductSeoSection';
import { ProductMarketingTextsSection } from './sections/ProductMarketingTextsSection';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import type { ProductFormData } from './ProductFormSchema';

const ProductClassificationSection = lazyWithRetry(
  () => import('./sections/ProductClassificationSection'),
);
const ProductMediaSection = lazyWithRetry(() => import('./sections/ProductMediaSection'));
const ProductEngravingSection = lazyWithRetry(() => import('./sections/ProductEngravingSection'));
const ProductKitComponentsSection = lazyWithRetry(() =>
  import('../products/kit-components/ProductKitComponentsSection').then((m) => ({
    default: m.ProductKitComponentsSection,
  })),
);

function SectionSkeleton() {
  return (
    <Card className="overflow-hidden border-border/50 bg-card/70">
      <div className="space-y-4 p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    </Card>
  );
}

type FormProps = FormSectionProps;

interface StepContentProps {
  stepId: string;
  formProps: FormProps;
  formValues: ProductFormData;
  productId?: string;
  isEdit: boolean;
  images: string[];
  onImagesChange: (imgs: string[]) => void;
  supplierId: string;
  onSupplierChange: (id: string, name?: string, markupPercent?: number | null) => void;
  skuStatus: string;
  duplicateName: string | null;
  skuManuallyEdited: boolean;
  onSkuManualEdit: () => void;
  isBoxProduct: boolean;
  supplierMarkup: number | null;
  costPriceDisplay: string;
  salePriceDisplay: string;
  onCostPriceDisplayChange: (v: string) => void;
  onSalePriceDisplayChange: (v: string) => void;
  onSalePriceManualEdit: () => void;
  flags: Record<string, boolean>;
  expirations: Record<string, string | null>;
  generateSeoAI: () => void;
  isSeoGenerating: boolean;
  /** BUG-03: ref populated by ProductEngravingSection with flushLocalAreas */
  engravingFlushRef?: React.MutableRefObject<((id: string) => Promise<void>) | null>;
  lastPriceUpdate?: { date: string; user: string } | null;
}

export function ProductFormStepContent({
  stepId,
  formProps,
  formValues,
  productId,
  isEdit,
  images,
  onImagesChange,
  supplierId,
  onSupplierChange,
  skuStatus,
  duplicateName,
  skuManuallyEdited,
  onSkuManualEdit,
  isBoxProduct,
  supplierMarkup,
  costPriceDisplay,
  salePriceDisplay,
  onCostPriceDisplayChange,
  onSalePriceDisplayChange,
  onSalePriceManualEdit,
  flags,
  expirations,
  generateSeoAI,
  isSeoGenerating,
  engravingFlushRef,
  lastPriceUpdate,
}: StepContentProps) {
  const { register, setValue, errors } = formProps;

  switch (stepId) {
    case 'essentials':
      return (
        <>
          <ProductSupplierSection
            supplierId={supplierId}
            onSupplierChange={(id, name, markupPercent) =>
              onSupplierChange(id, name, markupPercent)
            }
            setValue={setValue}
            errors={errors}
            productId={productId}
            isEdit={isEdit}
            primarySupplierName={formValues.brand ?? ''}
          />
          <ProductInfoSection
            {...formProps}
            skuStatus={skuStatus as 'idle' | 'valid' | 'duplicate' | 'checking'}
            duplicateName={duplicateName ?? ''}
            skuManuallyEdited={skuManuallyEdited}
            onSkuManualEdit={onSkuManualEdit}
          />
          <ProductDimensionsSection {...formProps} isBoxProduct={isBoxProduct} />
        </>
      );
    case 'commercial':
      return (
        <>
          <SectionCard
            id="category"
            title="Categoria"
            icon={Layers}
            subtitle="Classificação principal do produto no catálogo"
          >
            <CategoryCascadeSelector
              value={formValues.category_id ?? ''}
              onChange={(id) => setValue('category_id', id)}
              error={errors.category_id?.message}
            />
          </SectionCard>
          <ProductFlagsSection setValue={setValue} flags={flags} expirations={expirations} />
        </>
      );
    case 'packaging':
      return <ProductPackagingSection {...formProps} />;
    case 'fiscal':
      return (
        <>
          <ProductPriceSection
            {...formProps}
            supplierMarkup={supplierMarkup}
            costPriceDisplay={costPriceDisplay}
            salePriceDisplay={salePriceDisplay}
            onCostPriceDisplayChange={onCostPriceDisplayChange}
            onSalePriceDisplayChange={onSalePriceDisplayChange}
            onSalePriceManualEdit={onSalePriceManualEdit}
            lastPriceUpdate={lastPriceUpdate}
          />
          <ProductFiscalSection {...formProps} />
        </>
      );
    case 'content':
      return (
        <>
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateSeoAI}
              disabled={isSeoGenerating}
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              {isSeoGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 animate-pulse" />
              )}
              {isSeoGenerating ? 'Gerando...' : 'Preencher com IA'}
            </Button>
          </div>
          <ProductSeoSection {...formProps} />
          <ProductMarketingTextsSection register={register} />
        </>
      );
    case 'engraving':
      return (
        <Suspense fallback={<SectionSkeleton />}>
          {/* BUG-03: pass engravingFlushRef so AdminProductFormPage can flush local areas after creation */}
          <ProductEngravingSection
            productId={productId}
            isEdit={isEdit}
            engravingFlushRef={engravingFlushRef}
          />
        </Suspense>
      );
    case 'classification':
      return (
        <Suspense fallback={<SectionSkeleton />}>
          <ProductClassificationSection
            productId={productId}
            isEdit={isEdit}
            productName={formValues.name}
            productSku={formValues.sku}
            gender={formValues.gender ?? ''}
            onGenderChange={(v) => setValue('gender', v)}
          />
        </Suspense>
      );
    case 'kits':
      return (
        <>
          <SectionCard
            id="kit-flag"
            title="Tipo de Produto"
            icon={Package}
            subtitle="Defina se este produto é um kit"
          >
            <div
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:bg-accent/30',
                formValues.is_kit ? 'border-primary/20 bg-primary/5' : 'border-border/50',
              )}
              onClick={() => setValue('is_kit', !formValues.is_kit)}
              role="switch"
              aria-checked={!!formValues.is_kit}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setValue('is_kit', !formValues.is_kit);
                }
              }}
            >
              <div className="flex items-center gap-1.5">
                <Label className="cursor-pointer text-xs font-medium">É Kit</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/40" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Define como kit composto por múltiplos componentes
                  </TooltipContent>
                </Tooltip>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={!!formValues.is_kit}
                  onCheckedChange={(v) => setValue('is_kit', v)}
                />
              </div>
            </div>
          </SectionCard>
          {formValues.is_kit && (
            <Suspense fallback={<SectionSkeleton />}>
              <ProductKitComponentsSection
                productId={productId ?? ''}
                boxInternalDimensions={{
                  height_cm: formValues.internal_height_cm ?? null,
                  width_cm: formValues.internal_width_cm ?? null,
                  length_cm: formValues.internal_length_cm ?? null,
                }}
              />
            </Suspense>
          )}
        </>
      );
    case 'media':
      return (
        <Suspense fallback={<SectionSkeleton />}>
          <ProductMediaSection
            images={images}
            onImagesChange={onImagesChange}
            productId={productId}
          />
        </Suspense>
      );
    default:
      return null;
  }
}
