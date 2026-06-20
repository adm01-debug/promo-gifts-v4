/**
 * QuantityPriceCalculator — Main orchestrator.
 * Sub-components extracted to calculator/ folder.
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomizationPricing, type PriceCalculation } from '@/hooks/simulation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calculator, Package, Paintbrush, Palette, Plus, X, FileText, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductSearch as UnifiedProductSearch } from './simulator/ProductSearch';
import { TechniqueMultiSelector } from './calculator/TechniqueMultiSelector';
import { TechniqueConfigCard } from './calculator/TechniqueConfigCard';
import { QuantityComparisonTable } from './calculator/QuantityComparisonTable';
import {
  type CalcProduct,
  type ProductTechnique,
  type SelectedTechniqueConfig,
  formatNumber,
} from './calculator/types';
import type { Product as SimulatorProduct } from './simulator/types';

interface QuantityPriceCalculatorProps {
  productBasePrice?: number;
  productName?: string;
  onSelectTechnique?: (techniqueCode: string, calculation: PriceCalculation) => void;
  className?: string;
}

export function QuantityPriceCalculator({ className }: QuantityPriceCalculatorProps) {
  const navigate = useNavigate();
  const { isLoading: pricingLoading } = useCustomizationPricing();

  const [selectedProduct, setSelectedProduct] = useState<CalcProduct | null>(null);
  const [selectedConfigs, setSelectedConfigs] = useState<SelectedTechniqueConfig[]>([]);
  const [customQuantities, setCustomQuantities] = useState<number[]>([250, 500, 1000, 2500, 5000]);
  const [newQuantity, setNewQuantity] = useState('');

  const handleProductSelect = useCallback((product: SimulatorProduct | null) => {
    if (!product) {
      setSelectedProduct(null);
      setSelectedConfigs([]);
      return;
    }
    setSelectedProduct({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      images: product.images,
      category_name: null,
    });
    setSelectedConfigs([]);
  }, []);

  const handleToggleTechnique = useCallback((technique: ProductTechnique, add: boolean) => {
    if (add)
      setSelectedConfigs((prev) => [
        ...prev,
        { technique, colors: 1, sizeOption: 'standard', sizeModifier: 1 },
      ]);
    else setSelectedConfigs((prev) => prev.filter((c) => c.technique.id !== technique.id));
  }, []);

  const handleUpdateConfig = useCallback((index: number, updated: SelectedTechniqueConfig) => {
    setSelectedConfigs((prev) => {
      const n = [...prev];
      n[index] = updated;
      return n;
    });
  }, []);

  const handleRemoveConfig = useCallback((index: number) => {
    setSelectedConfigs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddQuantity = useCallback(() => {
    const qty = parseInt(newQuantity, 10);
    if (qty > 0 && !customQuantities.includes(qty)) {
      setCustomQuantities((prev) => [...prev, qty].sort((a, b) => a - b));
      setNewQuantity('');
    }
  }, [newQuantity, customQuantities]);

  const handleRemoveQuantity = useCallback(
    (qty: number) => {
      if (customQuantities.length > 1) setCustomQuantities((prev) => prev.filter((q) => q !== qty));
    },
    [customQuantities.length],
  );

  const handleCreateQuote = useCallback(() => {
    navigate('/orcamentos', {
      state: {
        fromSimulator: true,
        product: selectedProduct,
        techniques: selectedConfigs,
        quantities: customQuantities,
      },
    });
  }, [navigate, selectedProduct, selectedConfigs, customQuantities]);

  if (pricingLoading)
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Step 1: Product */}
      <Card className="animate-fade-in">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle className="font-display text-lg">1. Selecione o Produto</CardTitle>
          </div>
          <CardDescription>
            Escolha o produto base para simular preços de gravação em diferentes tiragens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UnifiedProductSearch
            onSelect={handleProductSelect}
            selectedProduct={selectedProduct as unknown as SimulatorProduct}
          />
        </CardContent>
      </Card>

      {/* Step 2: Techniques */}
      {selectedProduct && (
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Paintbrush className="h-5 w-5 text-primary" />
              <CardTitle className="font-display text-lg">
                2. Selecione as Técnicas de Gravação
              </CardTitle>
            </div>
            <CardDescription>Escolha uma ou mais técnicas para comparar preços</CardDescription>
          </CardHeader>
          <CardContent>
            <TechniqueMultiSelector
              productId={selectedProduct.id}
              selectedTechniques={selectedConfigs}
              onToggleTechnique={handleToggleTechnique}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Configure */}
      {selectedConfigs.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle className="font-display text-lg">3. Configure as Opções</CardTitle>
            </div>
            <CardDescription>Defina cores e tamanho para cada técnica selecionada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedConfigs.map((config, index) => (
                <TechniqueConfigCard
                  key={config.technique.id}
                  config={config}
                  onUpdate={(u) => handleUpdateConfig(index, u)}
                  onRemove={() => handleRemoveConfig(index)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Compare */}
      {selectedProduct && selectedConfigs.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <CardTitle className="font-display text-lg">4. Compare Preços por Tiragem</CardTitle>
            </div>
            <CardDescription>
              Veja como o preço por unidade muda conforme a quantidade.{' '}
              <Trophy className="inline h-3 w-3 text-success" /> = melhor preço.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Tiragens para comparar:</label>
              <div className="flex flex-wrap gap-2">
                {customQuantities.map((qty) => (
                  <Badge
                    key={qty}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 pl-3 pr-1"
                  >
                    {formatNumber(qty)}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Fechar"
                      className="h-5 w-5 hover:bg-destructive/20"
                      onClick={() => handleRemoveQuantity(qty)}
                      disabled={customQuantities.length <= 1}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    placeholder="Nova qtd"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="h-7 w-24 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddQuantity()}
                  />
                  <Button variant="outline" size="sm" className="h-7" onClick={handleAddQuantity}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            <QuantityComparisonTable
              product={selectedProduct}
              selectedConfigs={selectedConfigs}
              quantities={customQuantities}
            />
            <Button
              size="lg"
              className="w-full gap-2 font-display font-semibold"
              onClick={handleCreateQuote}
            >
              <FileText className="h-5 w-5" />
              Criar Orçamento a partir desta Simulação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default QuantityPriceCalculator;
