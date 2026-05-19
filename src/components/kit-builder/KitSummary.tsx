/**
 * Kit Summary — Refactored orchestrator
 * Sub-components extracted to ./kit-summary/
 */
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { KitMarginSimulator } from './KitMarginSimulator';
import { KitVisualPreview } from './KitVisualPreview';
import { DiscontinuedItemsAlert } from './DiscontinuedItemsAlert';
import { FreightEstimator } from './FreightEstimator';
import { useKitStockValidation } from '@/hooks/kit-builder';
import { calculateTotalKitPrice, type KitState } from '@/lib/kit-builder';
import { KitIdentificationCard } from './kit-summary/KitIdentificationCard';
import { KitStatsCards } from './kit-summary/KitStatsCards';
import { KitCompositionCard } from './kit-summary/KitCompositionCard';
import { KitPricingCard } from './kit-summary/KitPricingCard';
import { KitActionsBar } from './kit-summary/KitActionsBar';
import { KitConflictAlerts } from './KitConflictAlerts';
import { KitPresentablePreview } from './KitPresentablePreview';

interface KitSummaryProps {
  kitState: KitState;
  kitQuantity: number;
  kitName: string;
  onKitNameChange: (name: string) => void;
  onKitQuantityChange: (quantity: number) => void;
  onAddToQuote?: () => void;
  onExportPDF?: () => void;
  isAddingToQuote?: boolean;
  currentKitId?: string;
}

export function KitSummary({ kitState, kitQuantity, kitName, onKitNameChange, onKitQuantityChange, onAddToQuote, onExportPDF, isAddingToQuote, currentKitId }: KitSummaryProps) {
  const { box, items, personalization } = kitState;
  const pricing = calculateTotalKitPrice(box, items, personalization, kitQuantity);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const personalizedCount = (personalization.box.enabled ? 1 : 0) + Object.values(personalization.items).filter(p => p.enabled).length;
  const { alerts: stockAlerts, stockByProduct } = useKitStockValidation(items, box, kitQuantity);

  return (
    <div className="space-y-6">
      <KitIdentificationCard kitName={kitName} kitQuantity={kitQuantity} onKitNameChange={onKitNameChange} onKitQuantityChange={onKitQuantityChange} />
      <KitStatsCards kitState={kitState} totalItems={totalItems} itemsCount={items.length} personalizedCount={personalizedCount} />
      <KitVisualPreview kitState={kitState} />
      <KitPresentablePreview kitState={kitState} kitQuantity={kitQuantity} kitName={kitName} currentKitId={currentKitId} />
      <KitConflictAlerts kitState={kitState} />
      <DiscontinuedItemsAlert items={items} />
      <KitCompositionCard kitState={kitState} kitQuantity={kitQuantity} stockByProduct={stockByProduct} />
      <KitPricingCard kitState={kitState} kitQuantity={kitQuantity} onKitQuantityChange={onKitQuantityChange} />
      <KitMarginSimulator unitPrice={pricing.unitPrice} totalPrice={pricing.total} kitQuantity={kitQuantity} />

      {stockAlerts.length > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="pt-6">
            <h4 className="font-medium text-warning flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4" />Alerta de Estoque ({stockAlerts.length} {stockAlerts.length === 1 ? 'item' : 'itens'})</h4>
            <ul className="space-y-2">
              {stockAlerts.map(alert => (
                <li key={alert.itemId} className="text-sm flex items-center justify-between bg-background/50 rounded-lg p-2">
                  <div><p className="font-medium">{alert.isBox ? '📦 ' : ''}{alert.itemName}</p><p className="text-xs text-muted-foreground font-mono">{alert.sku}</p></div>
                  <div className="text-right"><p className="text-sm"><span className="text-destructive font-bold">{alert.available}</span><span className="text-muted-foreground"> / {alert.required} necessários</span></p><p className="text-xs text-destructive">Faltam {alert.deficit} un.</p></div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <FreightEstimator totalWeightGrams={kitState.totalWeight} kitQuantity={kitQuantity} />

      {!kitState.isValid && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <h4 className="font-medium text-destructive mb-2">Pendências</h4>
            <ul className="space-y-1">{kitState.validationErrors.map((error, i) => <li key={i} className="text-sm text-destructive flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-destructive" />{error}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      <KitActionsBar isValid={kitState.isValid} isAddingToQuote={isAddingToQuote} kitName={kitName} kitTag={kitState.identity?.tag} kitQuantity={kitQuantity} unitPrice={pricing.unitPrice} total={pricing.total} items={items} onAddToQuote={onAddToQuote} onExportPDF={onExportPDF} />
    </div>
  );
}
