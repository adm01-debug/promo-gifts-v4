/**
 * PriceFreshnessThresholdEditor
 *
 * Editor inline (Popover) para configurar a janela de validade de preço
 * (30/60/90 dias) de UM produto. Visível apenas para admins.
 *
 * Grava em `public.product_price_freshness_overrides` (RLS admin-only).
 * O override local sempre tem precedência sobre o valor do BD externo.
 */
import { useState } from 'react';
import { Settings2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import {
  ALLOWED_FRESHNESS_THRESHOLDS,
  type FreshnessThreshold,
  useDeleteFreshnessOverride,
  useProductFreshnessOverride,
  useUpsertFreshnessOverride,
} from '@/hooks/products/useProductFreshnessOverride';

interface Props {
  productId: string;
  /** Valor efetivo atual usado pelo badge (override > externo > 60). */
  currentEffectiveDays: number;
}

export function PriceFreshnessThresholdEditor({ productId, currentEffectiveDays }: Props) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: override, isLoading } = useProductFreshnessOverride(productId);
  const upsert = useUpsertFreshnessOverride();
  const remove = useDeleteFreshnessOverride();

  // Estado local controla a seleção dentro do popover.
  const initial: FreshnessThreshold =
    override?.threshold_days ??
    (ALLOWED_FRESHNESS_THRESHOLDS.includes(currentEffectiveDays as FreshnessThreshold)
      ? (currentEffectiveDays as FreshnessThreshold)
      : 60);
  const [selected, setSelected] = useState<FreshnessThreshold>(initial);

  if (!isAdmin) return null;

  const isOverride = !!override;
  const busy = upsert.isPending || remove.isPending || isLoading;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSelected(initial);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label="Configurar validade do preço"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Validade: {currentEffectiveDays}d
          {isOverride && (
            <span className="ml-0.5 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
              custom
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Validade do preço</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Define quando o sistema avisará que o preço pode estar defasado para este produto.
            </p>
          </div>

          <RadioGroup
            value={String(selected)}
            onValueChange={(v) => setSelected(Number(v) as FreshnessThreshold)}
            className="gap-2"
          >
            {ALLOWED_FRESHNESS_THRESHOLDS.map((days) => (
              <div key={days} className="flex items-center gap-2">
                <RadioGroupItem value={String(days)} id={`pft-${days}`} />
                <Label
                  htmlFor={`pft-${days}`}
                  className="flex flex-1 cursor-pointer items-center justify-between text-sm"
                >
                  <span>{days} dias</span>
                  {days === 60 && <span className="text-[10px] text-muted-foreground">padrão</span>}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              disabled={!isOverride || busy}
              onClick={() => remove.mutate(productId, { onSuccess: () => setOpen(false) })}
            >
              Restaurar padrão
            </Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={busy || selected === initial}
              onClick={() =>
                upsert.mutate(
                  { productId, thresholdDays: selected },
                  { onSuccess: () => setOpen(false) },
                )
              }
            >
              {upsert.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
