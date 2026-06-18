/**
 * ProductFormFullscreen — Stepper horizontal com preview lateral
 * Refatorado: conteúdo das etapas em ProductFormStepContent.tsx
 *
 * Sprint 3 (26/05/2026):
 *   BUG-03: engravingFlushRef prop passed down through to ProductFormStepContent
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productFormSchema, type ProductFormData, defaultFormValues } from './ProductFormSchema';
import { useSystemSettings } from '@/hooks/admin/useSystemSettings';
import { ProductPreviewPanel } from './ProductPreviewPanel';
import { HorizontalStepper, type StepDef } from './HorizontalStepper';
import { ProductFormStepContent } from './ProductFormStepContent';
import { useProductFormDraft } from './hooks/useProductFormDraft';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Loader2,
  Package,
  Tag,
  ImageIcon,
  Layers,
  Megaphone,
  Paintbrush,
  AlertCircle,
  FileText,
  Save,
  X,
  PanelRightClose,
  PanelRightOpen,
  ChevronLeft,
  ChevronRight,
  Info,
  Boxes,
} from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { useSkuValidation } from './hooks/useSkuValidation';
import { useProductSeoAI } from '@/hooks/products';

interface ProductFormFullscreenProps {
  initialData?: Partial<ProductFormData>;
  productImages?: string[];
  productId?: string;
  onSubmit: (data: ProductFormData, images: string[]) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  isEdit: boolean;
  /** BUG-03: ref populated by ProductEngravingSection with flushLocalAreas */
  engravingFlushRef?: React.MutableRefObject<((id: string) => Promise<void>) | null>;
  lastPriceUpdate?: { date: string; user: string } | null;
}

const STEPS: StepDef[] = [
  {
    id: 'essentials',
    label: 'Identificação',
    description: 'Fornecedor e dados',
    icon: Info,
    requiredFields: ['supplier_id', 'sku', 'name'],
    fieldLabels: { supplier_id: 'Fornecedor', sku: 'SKU Interno', name: 'Nome do Produto' },
  },
  {
    id: 'fiscal',
    label: 'Financeiro e Fiscal',
    description: 'Preços, estoque e tributos',
    icon: FileText,
    requiredFields: ['sale_price'],
    fieldLabels: { sale_price: 'Preço de Venda' },
  },
  {
    id: 'classification',
    label: 'Classificação',
    description: 'Gênero, cores e vínculos',
    icon: Layers,
    requiredFields: [],
    fieldLabels: {},
  },
  {
    id: 'commercial',
    label: 'Categorias e Dimensões',
    description: 'Categoria, dimensões e flags',
    icon: Tag,
    requiredFields: [],
    fieldLabels: {},
  },
  {
    id: 'engraving',
    label: 'Gravação',
    description: 'Áreas de personalização',
    icon: Paintbrush,
    requiredFields: [],
    fieldLabels: {},
  },
  {
    id: 'packaging',
    label: 'Embalagem',
    description: 'Dados da embalagem',
    icon: Package,
    requiredFields: [],
    fieldLabels: {},
  },
  {
    id: 'kits',
    label: 'Kits',
    description: 'Gestão de kits nativos',
    icon: Boxes,
    requiredFields: [],
    fieldLabels: {},
  },
  {
    id: 'media',
    label: 'Mídia',
    description: 'Imagens e vídeos',
    icon: ImageIcon,
    requiredFields: [],
    fieldLabels: {},
  },
  {
    id: 'content',
    label: 'SEO',
    description: 'Meta tags e marketing',
    icon: Megaphone,
    requiredFields: [],
    fieldLabels: {},
  },
];

export function ProductFormFullscreen({
  initialData,
  productImages: initialImages = [],
  productId,
  onSubmit,
  onCancel,
  isSaving,
  isEdit,
  engravingFlushRef,
  lastPriceUpdate,
}: ProductFormFullscreenProps) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(isEdit);
  const [supplierMarkup, setSupplierMarkup] = useState<number | null>(null);
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(isEdit);
  const [costPriceDisplay, setCostPriceDisplay] = useState('');
  const [salePriceDisplay, setSalePriceDisplay] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(() => {
    const stored = localStorage.getItem('product-form-show-preview');
    return stored !== null ? stored === 'true' : true;
  });

  const { getSetting } = useSystemSettings();
  const globalDefault = parseInt(getSetting('default_price_freshness_threshold', '60'), 10);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { ...defaultFormValues, ...initialData },
  });

  // Update threshold for new products if global default changes or is loaded
  useEffect(() => {
    if (!isEdit && !initialData?.price_freshness_threshold_days) {
      setValue('price_freshness_threshold_days', globalDefault);
    }
  }, [globalDefault, isEdit, initialData, setValue]);

  const formValues = watch();
  const supplierId = formValues.supplier_id || '';
  const packingType = formValues.packing_type || '';
  const isBoxProduct = packingType.toLowerCase().includes('caixa');
  const skuValue = formValues.sku || '';
  const nameValue = formValues.name || '';
  const salePriceValue = formValues.sale_price ?? 0;
  const costPriceValue = formValues.cost_price ?? 0;
  const stockQuantityValue = formValues.stock_quantity ?? 0;
  const brandValue = formValues.brand || '';
  const supplierRefValue = formValues.supplier_reference || '';

  const flags: Record<string, boolean> = {
    is_active: formValues.is_active,
    is_featured: formValues.is_featured,
    is_bestseller: formValues.is_bestseller,
    is_new: formValues.is_new,
    is_on_sale: formValues.is_on_sale,
    is_kit: formValues.is_kit,
    is_imported: formValues.is_imported,
    is_textil: formValues.is_textil,
    is_thermal: formValues.is_thermal,
    allows_personalization: formValues.allows_personalization,
    has_gift_box: formValues.has_gift_box,
    has_optional_packaging: formValues.has_optional_packaging,
    has_commercial_packaging: formValues.has_commercial_packaging,
  };
  const expirations: Record<string, string | null> = {
    is_featured_expires_at: formValues.is_featured_expires_at ?? null,
    is_bestseller_expires_at: formValues.is_bestseller_expires_at ?? null,
    is_new_expires_at: formValues.is_new_expires_at ?? null,
    is_on_sale_expires_at: formValues.is_on_sale_expires_at ?? null,
  };

  const { status: skuStatus, duplicateName } = useSkuValidation(skuValue, isEdit, initialData?.sku);
  const { clearDraft } = useProductFormDraft(
    productId,
    setValue,
    formValues,
    images,
    stepIndex,
    setImages,
    setStepIndex,
  );

  useEffect(() => {
    if (!skuManuallyEdited && !isEdit && supplierRefValue)
      setValue('sku', supplierRefValue, { shouldValidate: true });
  }, [supplierRefValue, skuManuallyEdited, isEdit, setValue]);

  useEffect(() => {
    if (costPriceValue && costPriceValue > 0 && !costPriceDisplay)
      setCostPriceDisplay(costPriceValue.toFixed(2));
  }, [costPriceValue, costPriceDisplay]);

  useEffect(() => {
    if (salePriceValue && salePriceValue > 0 && !salePriceDisplay)
      setSalePriceDisplay(salePriceValue.toFixed(2));
  }, [salePriceValue, salePriceDisplay]);

  useEffect(() => {
    if (!supplierMarkup || !costPriceValue || costPriceValue <= 0) return;
    const calc = Math.round(costPriceValue * (1 + supplierMarkup / 100) * 100) / 100;
    setValue('suggested_price', calc);
    if (!priceManuallyEdited) {
      setValue('sale_price', calc);
      setSalePriceDisplay(calc.toFixed(2));
    }
  }, [costPriceValue, supplierMarkup, priceManuallyEdited, setValue]);

  const numericProps = (name: keyof ProductFormData | (string & {})) => ({
    ...register(name as keyof ProductFormData, { valueAsNumber: true }),
    type: 'number' as const,
    step: name.includes('price') ? '0.01' : '1',
  });

  const formProps = { register, setValue, watch, errors, numericProps };
  const { generate: generateSeoAI, isGenerating: isSeoGenerating } = useProductSeoAI(
    getValues,
    setValue,
  );

  const [showValidation, setShowValidation] = useState(false);

  const missingFields = useMemo(() => {
    return STEPS.map((step) =>
      step.requiredFields
        .filter((f) => {
          const val = formValues[f];
          if (typeof val === 'number') return val <= 0;
          return !val;
        })
        .map((f) => step.fieldLabels[f] || f),
    );
  }, [formValues]);

  const stepReady = useMemo(
    () => [
      Boolean(formValues.supplier_id && formValues.sku && formValues.name), // 0: essentials
      Boolean((formValues.sale_price ?? 0) > 0),                           // 1: fiscal
      true,                                                                  // 2: classification
      true,                                                                  // 3: commercial
      isEdit && !!productId,                                                 // 4: engraving
      Boolean(formValues.packing_type),                                      // 5: packaging
      true,                                                                  // 6: kits
      images.length > 0 || Boolean(formValues.video_url),                   // 7: media
      Boolean(formValues.meta_title || formValues.meta_description || formValues.key_benefits), // 8: content/SEO
    ],
    [formValues, images.length, isEdit, productId],
  );

  const stepErrors = useMemo(() => {
    const errs = Object.keys(errors);
    return STEPS.map((step) =>
      step.requiredFields.reduce((c, f) => c + (errs.includes(f) ? 1 : 0), 0),
    );
  }, [errors]);

  const [direction, setDirection] = useState(0);
  const goStep = useCallback(
    (i: number) => {
      setDirection(i > stepIndex ? 1 : -1);
      setStepIndex(i);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [stepIndex],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          document.querySelector<HTMLFormElement>('form')?.requestSubmit();
        } else if (e.key === 'ArrowRight' && stepIndex < STEPS.length - 1) {
          e.preventDefault();
          goStep(stepIndex + 1);
        } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
          e.preventDefault();
          goStep(stepIndex - 1);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stepIndex, goStep]);

  const handleSubmitWithValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await trigger();
    const totalMissing = missingFields.reduce((sum, arr) => sum + arr.length, 0);
    if (!isValid || totalMissing > 0) {
      setShowValidation(true);
      const firstBadStep = missingFields.findIndex((arr) => arr.length > 0);
      if (firstBadStep >= 0 && firstBadStep !== stepIndex) goStep(firstBadStep);
      return;
    }
    clearDraft();
    handleSubmit(async (data) => {
      if (skuStatus === 'duplicate' || skuStatus === 'checking') return;
      await onSubmit(data, images);
    })(e);
  };

  const currentStep = STEPS[stepIndex];
  const hasPrev = stepIndex > 0;
  const hasNext = stepIndex < STEPS.length - 1;
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <form
      data-testid="admin-form"
      onSubmit={handleSubmitWithValidation}
      className="flex flex-col gap-4"
    >
      <Card className="border-border/50 bg-card/80 px-6 py-4">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0 flex-1">
            <HorizontalStepper
              steps={STEPS}
              activeIndex={stepIndex}
              stepReady={stepReady}
              stepErrors={stepErrors}
              onStepClick={goStep}
              missingFields={missingFields}
              showValidation={showValidation}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-1">
            {Object.keys(errors).length > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {Object.keys(errors).length}
              </span>
            )}
            <Button
              type="submit"
              size="sm"
              data-testid="admin-save-btn"
              disabled={isSaving || skuStatus === 'duplicate' || skuStatus === 'checking'}
              className="gap-2 font-semibold shadow-sm"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isEdit ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-5">
          {skuStatus === 'duplicate' && (
            <Card className="border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">SKU duplicado</p>
                  <p className="mt-1 text-sm">
                    Este SKU já está em uso{duplicateName ? ` no produto "${duplicateName}"` : ''}.
                    Ajuste antes de salvar.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={currentStep.id}
              custom={direction}
              className="space-y-5"
              initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* BUG-03: engravingFlushRef is threaded down to ProductFormStepContent → ProductEngravingSection */}
              <ProductFormStepContent
                stepId={currentStep.id}
                formProps={formProps}
                formValues={formValues}
                productId={productId}
                isEdit={isEdit}
                images={images}
                onImagesChange={setImages}
                supplierId={supplierId}
                onSupplierChange={(id, name, markupPercent) => {
                  setValue('supplier_id', id);
                  if (name) setValue('brand', name);
                  setSupplierMarkup(markupPercent ?? null);
                  setPriceManuallyEdited(false);
                }}
                skuStatus={skuStatus}
                duplicateName={duplicateName}
                skuManuallyEdited={skuManuallyEdited}
                onSkuManualEdit={() => setSkuManuallyEdited(true)}
                isBoxProduct={isBoxProduct}
                supplierMarkup={supplierMarkup}
                costPriceDisplay={costPriceDisplay}
                salePriceDisplay={salePriceDisplay}
                onCostPriceDisplayChange={setCostPriceDisplay}
                onSalePriceDisplayChange={setSalePriceDisplay}
                onSalePriceManualEdit={() => setPriceManuallyEdited(true)}
                flags={flags}
                expirations={expirations}
                generateSeoAI={generateSeoAI}
                isSeoGenerating={isSeoGenerating}
                engravingFlushRef={engravingFlushRef}
                lastPriceUpdate={lastPriceUpdate}
              />
            </motion.div>
          </AnimatePresence>

          {showValidation && missingFields[stepIndex].length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-warning/30 bg-warning/5 p-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-semibold text-warning">
                    {missingFields[stepIndex].length} campo
                    {missingFields[stepIndex].length > 1 ? 's' : ''} obrigatório
                    {missingFields[stepIndex].length > 1 ? 's' : ''} nesta etapa
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {missingFields[stepIndex].map((label) => (
                      <li
                        key={label}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span className="h-1 w-1 rounded-full bg-warning" />
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex items-center justify-between pb-20 pt-2 lg:pb-4">
            <div className="flex items-center gap-3">
              {hasPrev && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => goStep(stepIndex - 1)}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {STEPS[stepIndex - 1].label}
                </Button>
              )}
              <span className="hidden text-[10px] text-muted-foreground/50 lg:inline">
                Ctrl+←/→ navegar · Ctrl+S salvar
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasNext && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => goStep(stepIndex + 1)}
                  className="gap-2"
                >
                  {STEPS[stepIndex + 1].label}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {isLast && (
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving || skuStatus === 'duplicate' || skuStatus === 'checking'}
                  className="gap-2 font-semibold shadow-sm"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isEdit ? 'Salvar produto' : 'Criar produto'}
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 flex-col xl:flex">
          <div className="sticky top-24">
            <div className="mb-2 flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setShowPreview((v) => {
                    const next = !v;
                    localStorage.setItem('product-form-show-preview', String(next));
                    return next;
                  })
                }
              >
                {showPreview ? (
                  <PanelRightClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                )}
                {showPreview ? 'Ocultar' : 'Preview'}
              </Button>
            </div>
            {showPreview && (
              <div className="w-64 duration-200 animate-in slide-in-from-right-4">
                <ProductPreviewPanel
                  name={nameValue}
                  sku={skuValue}
                  salePrice={salePriceValue}
                  stockQuantity={stockQuantityValue}
                  images={images}
                  brand={brandValue}
                  isFeatured={flags.is_featured}
                  isNew={flags.is_new}
                  isOnSale={flags.is_on_sale}
                  isKit={formValues.is_kit}
                  isActive={flags.is_active}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 p-3 backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {hasPrev && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goStep(stepIndex - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {stepIndex + 1}/{STEPS.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasNext ? (
              <Button
                type="button"
                size="sm"
                onClick={() => goStep(stepIndex + 1)}
                className="gap-2"
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={isSaving || skuStatus === 'duplicate' || skuStatus === 'checking'}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {isEdit ? 'Salvar' : 'Criar'}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
