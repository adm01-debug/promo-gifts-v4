import { ArrowRight, Sparkles, FileText, ShoppingCart, Tag, Truck, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useZeroResultSubstitutes,
  type Substitute,
} from '@/hooks/intelligence/useZeroResultSubstitutes';
import type { FilterKey } from '@/hooks/intelligence/useZeroResultDiagnosis';

interface Props {
  enabled: boolean;
  days: number;
  categoryId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  culprit: FilterKey | 'intersection' | 'window' | null;
  onApplySubstitute?: (
    key: FilterKey,
    value: { id: string; name: string },
  ) => void;
}

const AXIS_ICON: Record<FilterKey, typeof Tag> = {
  category: Tag,
  supplier: Truck,
  product: Package,
};

const AXIS_LABEL_PLURAL: Record<FilterKey, string> = {
  category: 'categorias',
  supplier: 'fornecedores',
  product: 'produtos',
};

function SubstituteRow({
  axis,
  item,
  onApply,
}: {
  axis: FilterKey;
  item: Substitute;
  onApply?: () => void;
}) {
  const hasContribs = item.contributors.length > 0;
  const contribTooltip = hasContribs
    ? item.contributors
        .map(
          (c) =>
            `${c.name} — ${c.quotes.toLocaleString('pt-BR')} orç · ${c.orders.toLocaleString('pt-BR')} ped (score ${c.score})`,
        )
        .join('\n')
    : undefined;

  return (
    <li
      className="flex flex-col gap-1.5 rounded-md border border-amber-500/25 bg-background/60 px-2.5 py-1.5"
      data-testid={`zero-substitute-${axis}-${item.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="truncate text-sm font-medium text-foreground"
            title={item.name}
          >
            {item.name}
          </span>
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[11px] font-medium text-amber-900 dark:text-amber-100"
          >
            <FileText className="h-3 w-3" aria-hidden="true" />
            {item.quotes.toLocaleString('pt-BR')}
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[11px] font-medium text-amber-900 dark:text-amber-100"
          >
            <ShoppingCart className="h-3 w-3" aria-hidden="true" />
            {item.orders.toLocaleString('pt-BR')}
          </Badge>
        </div>
        {onApply && (
          <Button
            size="sm"
            variant="outline"
            onClick={onApply}
            className="h-7 gap-1 px-2 text-xs"
            data-testid={`zero-substitute-apply-${axis}-${item.id}`}
            aria-label={`Aplicar ${item.name}`}
          >
            Aplicar
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Button>
        )}
      </div>
      {hasContribs && (
        <div
          className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground"
          data-testid={`zero-substitute-contributors-${axis}-${item.id}`}
          title={contribTooltip}
        >
          <span className="font-medium text-amber-900/70 dark:text-amber-200/70">
            Contribui:
          </span>
          {item.contributors.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/[0.06] px-1.5 py-0.5"
              data-testid={`zero-substitute-contributor-${axis}-${item.id}-${c.id}`}
            >
              <span className="max-w-[180px] truncate" title={c.name}>
                {c.name}
              </span>
              <span className="tabular-nums text-amber-900/70 dark:text-amber-200/70">
                · {c.quotes.toLocaleString('pt-BR')} orç · {c.orders.toLocaleString('pt-BR')} ped
              </span>
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function AxisSection({
  axis,
  items,
  onApplySubstitute,
}: {
  axis: FilterKey;
  items: Substitute[];
  onApplySubstitute?: Props['onApplySubstitute'];
}) {
  if (items.length === 0) return null;
  const Icon = AXIS_ICON[axis];
  return (
    <div className="space-y-1.5" data-testid={`zero-substitute-axis-${axis}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900/70 dark:text-amber-200/70">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        Top {AXIS_LABEL_PLURAL[axis]} com atividade
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <SubstituteRow
            key={item.id}
            axis={axis}
            item={item}
            onApply={
              onApplySubstitute
                ? () => onApplySubstitute(axis, { id: item.id, name: item.name })
                : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * Bloco de recomendações ranqueadas exibido dentro do callout de diagnóstico
 * quando o culpado é um filtro (categoria/fornecedor/produto ou intersecção).
 * Cada substituto vem com contagem real de orçamentos e pedidos que voltariam.
 */
export function ZeroResultSubstitutes({
  enabled,
  days,
  categoryId,
  supplierId,
  productId,
  culprit,
  onApplySubstitute,
}: Props) {
  const { data, isLoading } = useZeroResultSubstitutes({
    enabled,
    days,
    categoryId,
    supplierId,
    productId,
    culprit,
  });

  if (!enabled || !culprit || culprit === 'window') return null;
  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 text-xs text-amber-900/70 dark:text-amber-200/70"
        data-testid="zero-substitutes"
        data-state="loading"
      >
        <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
        Ranqueando substitutos com maior atividade…
      </div>
    );
  }
  if (!data) return null;

  const hasAny =
    data.categories.length > 0 || data.suppliers.length > 0 || data.products.length > 0;
  if (!hasAny) return null;

  return (
    <div
      className="space-y-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3"
      data-testid="zero-substitutes"
      data-state="ready"
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-100">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Substitutos recomendados
      </div>
      <AxisSection axis="category" items={data.categories} onApplySubstitute={onApplySubstitute} />
      <AxisSection axis="supplier" items={data.suppliers} onApplySubstitute={onApplySubstitute} />
      <AxisSection axis="product" items={data.products} onApplySubstitute={onApplySubstitute} />
    </div>
  );
}
