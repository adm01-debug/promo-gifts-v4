/**
 * Cart utility components: Skeleton, PriceLabel, formatters, status config.
 *
 * Dialogs, export utils, and mobile sheet extracted to ./cart-utils/.
 *
 * NOTA (faxina pós-remoção CartHealthChecklist):
 *   - `SmartSuggestions` e `ActionHistoryPanel` foram removidos junto com os
 *     painéis "Saúde do carrinho" / "Inteligência de vendas" do CartSidebar.
 *   - Helpers `recordAction` / `getActionHistory` / `clearActionHistory` /
 *     `SuggestionSkeleton` / `CartAction` também foram excluídos por serem
 *     dead code após a remoção dos consumidores.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { CartItemSkeleton } from './CartItemSkeleton';
import { cn } from '@/lib/utils';
import { type CartStatus } from '@/hooks/products';

// ============================================
// HELPERS
// ============================================

export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const STATUS_CONFIG: Record<CartStatus, { label: string; color: string }> = {
  em_separacao: {
    label: 'Separação',
    color: 'bg-warning/10 text-warning border-warning/20',
  },
  pronto_orcamento: {
    label: 'Pronto p/ orçamento',
    color: 'bg-success/10 text-success border-success/20',
  },
};

export function getStatusCfg(status: string | null | undefined) {
  return STATUS_CONFIG[status as CartStatus] || STATUS_CONFIG.em_separacao;
}

// ============================================
// SHARED UI COMPONENTS
// ============================================

interface PriceLabelProps {
  label: string;
  value: number;
  testId?: string;
  className?: string;
  isPrimary?: boolean;
}

/**
 * PriceLabel - Componente padronizado para exibir rótulo + valor monetário
 */
export function PriceLabel({ label, value, testId, className, isPrimary }: PriceLabelProps) {
  return (
    <div className={cn('flex flex-col space-y-0.5', className)}>
      <span
        className={cn(
          'font-medium tracking-tight text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100',
          className?.includes('flex-row') ? 'text-[8px]' : 'text-[10px]',
        )}
      >
        {label}
      </span>
      <span
        data-testid={testId}
        className={cn(
          'font-bold tabular-nums',
          className?.includes('flex-row') ? 'text-[11px]' : 'text-sm',
          isPrimary ? 'text-primary' : 'text-foreground',
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

// ============================================
// SKELETON LOADERS
// ============================================

export { CartItemSkeleton };

export function CartListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12 w-full opacity-40" />
      ))}
    </div>
  );
}

// ============================================
// RE-EXPORTS from extracted modules
// ============================================

export { exportCartToCSV, exportCartToPDF, shareCartLink } from './cart-utils/CartExport';
// SaveTemplateDialog e LoadTemplateDialog removidos: dead code — nunca importados.
// O fluxo de templates é gerenciado inline em CartSidebar.tsx com Dialog próprio.
export { CompareCartsDialog } from './cart-utils/CartDialogs';
export { MobileSummarySheet } from './cart-utils/CartMobileSheet';
