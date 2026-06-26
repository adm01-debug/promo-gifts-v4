/**
 * QuoteBadgeLegend — Legenda visual explicando cada cor/texto do badge de status
 * exibido na tabela de orçamentos. Colapsável via <details> nativo.
 */
import { Badge } from '@/components/ui/badge';
import { QUOTE_BADGE_LEGEND } from './QuotesStatusChips';

export function QuoteBadgeLegend() {
  return (
    <details
      data-testid="quote-badge-legend"
      className="group rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-xs"
    >
      <summary
        data-testid="quote-badge-legend-summary"
        className="cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground"
      >
        Legenda dos status
      </summary>
      <ul
        data-testid="quote-badge-legend-list"
        className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {QUOTE_BADGE_LEGEND.map((item) => (
          <li
            key={item.key}
            data-testid={`quote-badge-legend-item-${item.key}`}
            className="flex items-start gap-2"
          >
            <Badge
              variant="outline"
              className={`h-5 shrink-0 px-1.5 py-0 text-[10px] ${item.className}`}
            >
              {item.label}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{item.description}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
