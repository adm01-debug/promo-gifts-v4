import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Package, Paintbrush, Palette, Check, Plus, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  ProductSearch,
  ProductVariantSelector,
  TechniqueSelector,
  CustomizationOptions,
  formatCurrency,
  type Product,
  type ProductTechnique,
  type ConfiguredEngraving,
  type ProductColor,
  type ProductVariant,
} from './simulator';
import { EngravingList } from './simulator/EngravingList';
import { MultiEngravingResult } from './simulator/MultiEngravingResult';

interface ProductPriceSimulatorProps {
  className?: string;
}

type SimulatorMode = 'adding' | 'list';

// ── Progress bar conectada (#4) ──
function StepProgressBar({
  steps,
  currentStep,
}: {
  steps: { number: number; label: string; icon: React.ElementType }[];
  currentStep: number;
}) {
  return (
    <div className="flex w-full items-center gap-0 overflow-x-auto border-b border-border pb-4">
      {steps.map((step, idx) => {
        const isComplete = step.number < currentStep;
        const isActive = step.number === currentStep;
        const Icon = step.icon;

        return (
          <div key={step.number} className="flex min-w-0 flex-1 items-center last:flex-none">
            {/* Step circle */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300',
                  isComplete
                    ? 'bg-success text-success-foreground'
                    : isActive
                      ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  'hidden whitespace-nowrap text-[10px] font-medium transition-colors md:block',
                  isActive
                    ? 'text-foreground'
                    : isComplete
                      ? 'text-success'
                      : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div
                className="mx-2 h-0.5 flex-1 rounded-full transition-colors duration-300"
                style={{
                  background: isComplete ? 'hsl(var(--success))' : 'hsl(var(--border))',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProductPriceSimulator({ className }: ProductPriceSimulatorProps) {
  const navigate = useNavigate();

  // Estado do produto
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Lista de gravações configuradas
  const [engravings, setEngravings] = useState<ConfiguredEngraving[]>([]);

  // Estado para adicionar nova gravação
  const [mode, setMode] = useState<SimulatorMode>('list');
  const [currentTechnique, setCurrentTechnique] = useState<ProductTechnique | null>(null);
  const [currentColors, setCurrentColors] = useState(1);
  const [currentSizeOption, setCurrentSizeOption] = useState<string | null>(null);
  const [currentTableCode, setCurrentTableCode] = useState<string | null>(null);

  // Quantidade
  const [quantity, setQuantity] = useState(100);

  const MAX_ENGRAVINGS = 5;

  // Fetch real variants from external DB
  const { data: dbVariants } = useQuery({
    queryKey: ['simulator-variants', selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct) return [];
      const result = await dbInvoke<{
        id: string;
        color_name: string | null;
        color_hex: string | null;
        color_code: string | null;
        size_code: string | null;
        stock_quantity: number | null;
        sku: string | null;
      }>({
        table: 'product_variants',
        operation: 'select',
        select: 'id, color_name, color_hex, color_code, size_code, stock_quantity, sku',
        filters: { product_id: selectedProduct.id, is_active: true },
        limit: 200,
        orderBy: { column: 'color_name', ascending: true },
      });
      return result.records.filter((v) => v.color_name);
    },
    enabled: !!selectedProduct?.id,
    staleTime: 5 * 60 * 1000,
  });

  const productVariants: ProductVariant[] = useMemo(() => {
    if (dbVariants && dbVariants.length > 0) {
      return dbVariants.map((v) => ({
        code: v.id,
        name: v.color_name || 'Padrão',
        hex: v.color_hex || undefined,
        stock: v.stock_quantity ?? undefined,
        size_code: v.size_code,
      }));
    }
    if (!selectedProduct?.colors) return [];
    return (selectedProduct.colors as ProductColor[]).map((c) => ({
      code: c.code,
      name: c.name,
      hex: c.hex,
      stock: c.stock,
    }));
  }, [dbVariants, selectedProduct]);

  const hasSizes = useMemo(() => productVariants.some((v) => v.size_code), [productVariants]);
  const hasVariants = productVariants.length > 0;
  const needsVariantSelection = hasVariants && !selectedVariant;

  const handleProductSelect = useCallback((product: Product | null) => {
    setSelectedProduct(product);
    setSelectedVariant(null);
    setEngravings([]);
    setMode('list');
    setCurrentTechnique(null);
  }, []);

  const handleVariantSelect = useCallback((variant: ProductVariant | null) => {
    setSelectedVariant(variant);
  }, []);

  const handleStartAddEngraving = useCallback(() => {
    setMode('adding');
    setCurrentTechnique(null);
    setCurrentColors(1);
    setCurrentSizeOption(null);
    setCurrentTableCode(null);
  }, []);

  const handleCancelAddEngraving = useCallback(() => {
    setMode('list');
    setCurrentTechnique(null);
  }, []);

  const handleTechniqueSelect = useCallback((technique: ProductTechnique | null) => {
    setCurrentTechnique(technique);
    if (technique) {
      setCurrentColors(1);
      setCurrentSizeOption(null);
    }
  }, []);

  const handleConfirmEngraving = useCallback(() => {
    if (!currentTechnique) return;

    const newEngraving: ConfiguredEngraving = {
      id: crypto.randomUUID(),
      technique: currentTechnique,
      colors: currentColors,
      sizeOption: currentSizeOption,
      tableCode: currentTableCode,
    };

    setEngravings((prev) => [...prev, newEngraving]);
    setMode('list');
    setCurrentTechnique(null);
  }, [currentTechnique, currentColors, currentSizeOption, currentTableCode]);

  const handleRemoveEngraving = useCallback((id: string) => {
    setEngravings((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const canAddMore = engravings.length < MAX_ENGRAVINGS;
  const hasEngravings = engravings.length > 0;
  const showResults = selectedProduct && hasEngravings && (!hasVariants || selectedVariant);

  const getCurrentStep = () => {
    if (!selectedProduct) return 1;
    if (needsVariantSelection) return 2;
    if (mode === 'adding') {
      if (!currentTechnique) return 3;
      return 4;
    }
    if (hasEngravings) return 5;
    return 3;
  };

  const currentStep = getCurrentStep();

  const steps = [
    { number: 1, label: 'Produto', icon: Package },
    { number: 2, label: hasSizes ? 'Cor/Tam' : 'Cor', icon: Palette },
    { number: 3, label: 'Gravação', icon: Paintbrush },
    { number: 4, label: 'Opções', icon: Palette },
    { number: 5, label: 'Resultado', icon: Calculator },
  ];

  // #9 — CTA para criar orçamento
  const handleCreateQuote = useCallback(() => {
    navigate('/orcamentos', {
      state: {
        fromSimulator: true,
        product: selectedProduct,
        engravings,
        quantity,
      },
    });
  }, [navigate, selectedProduct, engravings, quantity]);

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle className="font-display">Simulador por Produto</CardTitle>
        </div>
        <CardDescription>
          Configure produto, cores e personalizações para simular o orçamento
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* #4 — Progress bar conectada */}
        <StepProgressBar steps={steps} currentStep={currentStep} />

        {/* Step 1: Produto */}
        <div className="animate-fade-in space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display font-medium">
              <Package className="h-4 w-4 text-primary" />
              1. Selecione o Produto
            </h3>
            {selectedProduct && (
              <Button variant="ghost" size="sm" onClick={() => handleProductSelect(null)}>
                Alterar
              </Button>
            )}
          </div>
          {!selectedProduct && (
            <ProductSearch onSelect={handleProductSelect} selectedProduct={selectedProduct} />
          )}
          {selectedProduct && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Check className="h-5 w-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{selectedProduct.name}</span>
                <span className="text-xs text-muted-foreground">SKU: {selectedProduct.sku}</span>
              </div>
              <Badge variant="secondary">{formatCurrency(selectedProduct.price)}</Badge>
            </div>
          )}
        </div>

        {/* Step 2: Variação/Cor */}
        {selectedProduct && hasVariants && (
          <div className="animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display font-medium">
                <Palette className="h-4 w-4 text-primary" />
                2. {hasSizes ? 'Selecione Cor e Tamanho' : 'Selecione a Cor do Produto'}
              </h3>
            </div>
            <ProductVariantSelector
              variants={productVariants}
              selectedVariant={selectedVariant}
              onSelect={handleVariantSelect}
              label=""
            />
          </div>
        )}

        {/* Step 3: Gravações */}
        {selectedProduct && (!hasVariants || selectedVariant) && (
          <div className="animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display font-medium">
                <Paintbrush className="h-4 w-4 text-primary" />
                {hasVariants ? '3' : '2'}. Personalizações
              </h3>
            </div>

            {mode === 'list' && (
              <EngravingList
                engravings={engravings}
                onRemove={handleRemoveEngraving}
                onAddNew={handleStartAddEngraving}
                canAddMore={canAddMore}
                maxEngravings={MAX_ENGRAVINGS}
              />
            )}

            {mode === 'adding' && (
              <div className="animate-scale-in space-y-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Nova Gravação</h4>
                  <Button variant="ghost" size="sm" onClick={handleCancelAddEngraving}>
                    <X className="mr-1 h-4 w-4" />
                    Cancelar
                  </Button>
                </div>

                {!currentTechnique && (
                  <TechniqueSelector
                    productId={selectedProduct.id}
                    onSelect={handleTechniqueSelect}
                    selectedTechnique={currentTechnique}
                  />
                )}

                {currentTechnique && (
                  <div className="animate-fade-in space-y-4">
                    <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
                      <Check className="h-5 w-5 shrink-0 text-success" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{currentTechnique.techniqueName}</p>
                        <p className="text-xs text-muted-foreground">
                          {currentTechnique.componentName} → {currentTechnique.locationName}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setCurrentTechnique(null)}>
                        Alterar
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 text-sm font-medium">
                        <Palette className="h-4 w-4 text-primary" />
                        Opções de Personalização
                      </h4>
                      <CustomizationOptions
                        technique={currentTechnique}
                        colors={currentColors}
                        onColorsChange={setCurrentColors}
                        sizeOption={currentSizeOption}
                        onSizeChange={setCurrentSizeOption}
                        onTableCodeChange={setCurrentTableCode}
                      />
                    </div>

                    <Button className="w-full" onClick={handleConfirmEngraving}>
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Gravação
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Resultados */}
        {showResults && mode === 'list' && (
          <div className="animate-fade-in space-y-4">
            <h3 className="flex items-center gap-2 font-display font-medium">
              <Calculator className="h-4 w-4 text-primary" />
              {hasVariants ? '4' : '3'}. Quantidade e Resultado
            </h3>
            <MultiEngravingResult
              product={selectedProduct}
              engravings={engravings}
              quantity={quantity}
              onQuantityChange={setQuantity}
            />

            {/* #9 — CTA Criar Orçamento */}
            <Button
              size="lg"
              className="w-full gap-2 font-display font-semibold"
              onClick={handleCreateQuote}
            >
              <FileText className="h-5 w-5" />
              Criar Orçamento a partir desta Simulação
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProductPriceSimulator;
