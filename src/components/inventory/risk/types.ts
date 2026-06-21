/**
 * Tipos compartilhados do painel de risco de fornecedor.
 */
import { type StockStatus, type ProductStockSummary } from '@/types/stock';

export type RiskSeverity = 'critical' | 'ok' | 'warning';

export interface RiskProduct {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStock: number;
  severity: RiskSeverity;
  status: StockStatus;
  variantsCritical: number;
  variantsOutOfStock: number;
  totalVariants: number;
}

export const SEVERITY_ORDER: Record<RiskSeverity, number> = { critical: 0, warning: 1, ok: 2 };

/**
 * Derives risk severity from a product's stock summary.
 * #15 fix: handles Infinity in daysUntilFullStockout.
 * Considers incoming stock as mitigating factor.
 */
export function deriveSeverity(p: ProductStockSummary): RiskSeverity {
  // Incoming stock mitigates severity — treat as warning instead of critical
  if (p.overallStatus === 'incoming') return 'warning';
  if (p.overallStatus === 'out_of_stock' || p.overallStatus === 'critical') return 'critical';
  // #15 fix: guard against Infinity — only trigger if finite AND below threshold
  if (
    typeof p.daysUntilFullStockout === 'number' &&
    Number.isFinite(p.daysUntilFullStockout) &&
    p.daysUntilFullStockout < 7
  )
    return 'critical';
  if (p.overallStatus === 'low_stock') return 'warning';
  if (
    typeof p.daysUntilFullStockout === 'number' &&
    Number.isFinite(p.daysUntilFullStockout) &&
    p.daysUntilFullStockout < 15
  )
    return 'warning';
  if (p.variantsOutOfStock > 0 || p.variantsCritical > 0) return 'warning';
  return 'ok';
}
