/**
 * Cart utility components: Skeletons, FollowUpTimer, Suggestions, History, and re-exports
 *
 * Dialogs, export utils, and mobile sheet extracted to ./cart-utils/
 */

import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CartItemSkeleton } from './CartItemSkeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  Package,
  Trash2,
  Plus,
  Copy,
  Eraser,
  FileText,
  Timer,
  Sparkles,
  TrendingUp,
  Lightbulb,
  History,
  MessageSquare,
  MoveRight,
  ChevronDown,
} from 'lucide-react';
import { type SellerCart, type CartStatus } from '@/hooks/products';
import { differenceInDays, differenceInHours, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================
// HELPERS
// ============================================

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const STATUS_CONFIG: Record<CartStatus, { label: string; color: string; bg: string }> = {
  novo: {
    label: 'Novo',
    color: 'bg-primary/10 text-primary border-primary/20',
    bg: 'bg-primary/10',
  },
  em_negociacao: {
    label: 'Em negociação',
    color: 'bg-warning/10 text-warning border-warning/20',
    bg: 'bg-warning/10',
  },
  pronto_orcamento: {
    label: 'Pronto p/ orçamento',
    color: 'bg-success/10 text-success border-success/20',
    bg: 'bg-success/10',
  },
};

export function getStatusCfg(
  status: string | undefined | null,
): { label: string; color: string; bg: string } {
  return STATUS_CONFIG[status as CartStatus] || STATUS_CONFIG.novo;
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
          'font-bold uppercase tracking-tight text-muted-foreground opacity-60 transition-opacity group-hover:opacity-80',
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
// ACTION HISTORY (in-memory per session)
// ============================================

export interface CartAction {
  type: 'add' | 'remove' | 'qty' | 'move' | 'duplicate' | 'clear';
  itemName: string;
  detail?: string;
  time: Date;
}

const actionHistoryMap = new Map<string, CartAction[]>();

export function recordAction(cartId: string, action: CartAction): void {
  const list = actionHistoryMap.get(cartId) || [];
  list.unshift(action);
  if (list.length > 20) list.pop();
  actionHistoryMap.set(cartId, list);
}

export function getActionHistory(cartId: string): CartAction[] {
  return actionHistoryMap.get(cartId) || [];
}

export function clearActionHistory(cartId: string): void {
  actionHistoryMap.delete(cartId);
}

// ============================================
// SKELETON LOADER
// ============================================

export { CartItemSkeleton };

export function SuggestionSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="group flex items-start gap-2.5 rounded-xl border border-border/20 bg-muted/5 p-3"
        >
          <Skeleton className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full opacity-40 transition-opacity group-hover:opacity-60" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-2.5 w-full opacity-30" />
            <Skeleton className="h-2.5 w-4/5 opacity-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// FOLLOW-UP TIMER
// ============================================

export function FollowUpTimer({ createdAt, status }: { createdAt: string; status?: string }) {
  const days = differenceInDays(new Date(), new Date(createdAt));
  const hours = differenceInHours(new Date(), new Date(createdAt));

  if (days < 1 || status === 'pronto_orcamento') return null;

  const isUrgent = days >= 3;
  const isWarning = days >= 2;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
        isUrgent
          ? 'border-destructive/20 bg-destructive/10 text-destructive'
          : isWarning
            ? 'border-warning/20 bg-warning/10 text-warning'
            : 'border-border/30 bg-muted/50 text-muted-foreground',
      )}
    >
      <Timer className="h-3.5 w-3.5" />
      <span>
        {isUrgent
          ? `${days} dias — Hora do follow-up!`
          : isWarning
            ? `${days} dias desde a criação`
            : `Criado há ${hours}h`}
      </span>
    </div>
  );
}

// ============================================
// SMART SUGGESTIONS
// ============================================

interface ProductLike {
  id: string;
  name: string;
  category_name?: string | null;
  category?: { name?: string };
  is_active?: boolean;
}

export function SmartSuggestions({
  cart,
  allProducts,
  isLoading,
}: {
  cart: SellerCart;
  allProducts: ProductLike[];
  isLoading?: boolean;
}) {
  const suggestions = useMemo(() => {
    const tips: { icon: typeof Lightbulb; text: string }[] = [];
    const totalQty = cart.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const subtotal = cart.items.reduce(
      (s, i) => s + (Number(i.product_price) || 0) * (Number(i.quantity) || 0),
      0,
    );

    if (cart.items.length === 1) {
      tips.push({ icon: Lightbulb, text: 'Carrinhos com 3+ SKUs distintos convertem 40% mais' });
    }
    if (totalQty < 50) {
      tips.push({
        icon: TrendingUp,
        text: 'Pedidos acima de 50 unidades costumam ter melhor margem',
      });
    }
    if (subtotal > 5000 && !cart.notes) {
      tips.push({
        icon: MessageSquare,
        text: 'Negociações acima de R$5k com notas detalhadas fecham mais rápido',
      });
    }
    if (cart.items.some((i) => !i.notes) && cart.items.length > 2) {
      tips.push({
        icon: FileText,
        text: 'Adicione observações em cada item para acelerar a produção',
      });
    }

    if (allProducts.length > 0 && cart.items.length > 0) {
      // O(n+m): build a Map once instead of O(n*m) repeated .find() calls
      const productMap = new Map(allProducts.map((p) => [p.id, p]));
      const cartCategoryNames = new Set(
        cart.items
          .map((i) => {
            const prod = productMap.get(i.product_id);
            return prod?.category_name || prod?.category?.name;
          })
          .filter(Boolean),
      );
      const cartProductIds = new Set(cart.items.map((i) => i.product_id));
      const similar = allProducts.find((p) => {
        const pCatName = p.category_name || p.category?.name;
        return (
          !cartProductIds.has(p.id) &&
          pCatName &&
          cartCategoryNames.has(pCatName) &&
          p.is_active !== false
        );
      });
      if (similar) {
        tips.push({
          icon: Sparkles,
          text: `Clientes similares também compraram: ${similar.name}`,
        });
      }
    }

    return tips.slice(0, 3);
  }, [cart, allProducts]);

  if (isLoading) return <SuggestionSkeleton />;
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      {suggestions.map((s, i) => {
        const Icon = s.icon;
        return (
          <div
            key={i}
            className="flex items-start gap-2.5 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground transition-colors hover:bg-primary/10"
          >
            <div className="mt-0.5 flex-shrink-0 rounded-full bg-background/80 p-1 shadow-sm">
              <Icon className="h-3 w-3 text-primary" />
            </div>
            <span>{s.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// ACTION HISTORY PANEL
// ============================================

const ACTION_HISTORY_ICONS: Record<string, typeof Plus> = {
  add: Plus,
  remove: Trash2,
  qty: Package,
  move: MoveRight,
  duplicate: Copy,
  clear: Eraser,
} as const;

export function ActionHistoryPanel({ cartId }: { cartId: string }) {
  const history = getActionHistory(cartId);
  if (history.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button
          className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <History className="h-3.5 w-3.5" />
          Histórico de ações ({history.length})
          <ChevronDown className="ml-auto h-3 w-3" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {history.slice(0, 10).map((action, i) => {
            const Icon = ACTION_HISTORY_ICONS[action.type] || Package;
            return (
              <div
                key={`${action.type}-${action.time.getTime()}-${i}`}
                className="flex items-center gap-2 py-1 text-[10px] text-muted-foreground"
              >
                <Icon className="h-3 w-3 flex-shrink-0" />
                <span className="flex-1 truncate">
                  {action.type === 'add' && `Adicionou ${action.itemName}`}
                  {action.type === 'remove' && `Removeu ${action.itemName}`}
                  {action.type === 'qty' &&
                    `Alterou qtd de ${action.itemName}${action.detail ? ` → ${action.detail}` : ''}`}
                  {action.type === 'move' &&
                    `Moveu ${action.itemName}${action.detail ? ` → ${action.detail}` : ''}`}
                  {action.type === 'duplicate' &&
                    `Duplicou ${action.itemName}${action.detail ? ` → ${action.detail}` : ''}`}
                  {action.type === 'clear' && `Limpou ${action.itemName}`}
                </span>
                <span className="flex-shrink-0 text-[9px] tabular-nums">
                  {formatDistanceToNow(action.time, { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// RE-EXPORTS from extracted modules
// ============================================

export { exportCartToCSV, exportCartToPDF, shareCartLink } from './cart-utils/CartExport';
export {
  CompareCartsDialog,
  SaveTemplateDialog,
  LoadTemplateDialog,
} from './cart-utils/CartDialogs';
export { MobileSummarySheet } from './cart-utils/CartMobileSheet';
