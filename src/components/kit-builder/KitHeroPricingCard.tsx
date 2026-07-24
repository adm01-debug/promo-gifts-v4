/**
 * Kit Hero Pricing Card — premium sidebar topper
 * Giant unit price with tabular-nums + total + health micro-badge.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/kit-builder';
import { cn } from '@/lib/utils';

const GLOW_STYLE = {
  background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
} as const;

interface KitHeroPricingCardProps {
  unitPrice: number;
  total: number;
  kitQuantity: number;
  isValid: boolean;
  hasContent: boolean;
}

export function KitHeroPricingCard({
  unitPrice,
  total,
  kitQuantity,
  isValid,
  hasContent,
}: KitHeroPricingCardProps) {
  if (!hasContent) {
    return (
      <Card className="border-2 border-dashed border-border/60 bg-gradient-to-br from-muted/30 to-transparent">
        <CardContent className="space-y-2 p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="font-display text-sm font-semibold">Comece seu kit</p>
          <p className="text-xs text-muted-foreground">Selecione uma caixa para ver o preço</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-primary/20 dark:border-primary/30',
        'bg-gradient-to-br from-card via-card to-primary/[0.04] dark:to-primary/[0.10]',
        'shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.25)] dark:shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.35)]',
      )}
    >
      {/* Subtle decorative glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={GLOW_STYLE}
        aria-hidden
      />
      <CardContent className="relative space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Preço por kit
          </p>
          {isValid && (
            <Badge className="h-5 gap-1 border-success/30 bg-success/15 text-[10px] text-success hover:bg-success/20">
              <TrendingUp className="h-2.5 w-2.5" /> Pronto
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-display text-4xl font-bold tabular-nums tracking-tight">
            {formatCurrency(unitPrice)}
          </span>
        </div>
        <div className="space-y-1.5 border-t border-border/40 pt-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Total ({kitQuantity}x)</span>
            <span className="font-display text-base font-bold tabular-nums text-primary">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
