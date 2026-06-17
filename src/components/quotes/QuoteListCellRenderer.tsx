/**
 * Cell renderer and helpers extracted from QuotesConfigurableList
 */
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDeliveryTime } from '@/components/pdf/ProposalHtmlTemplate';
import { QUOTE_STATUS_CONFIG } from '@/lib/quote-status-config';
import type { Quote } from '@/hooks/quotes';
import { cn } from '@/lib/utils';

const statusConfig = Object.fromEntries(
  Object.entries(QUOTE_STATUS_CONFIG).map(([k, v]) => [
    k,
    { label: v.label, className: v.badgeClassName },
  ]),
) as Record<Quote['status'], { label: string; className?: string }>;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function renderQuoteCell(quote: Quote, columnId: string, navigate: (path: string) => void) {
  const hasClient = !!quote.client_name || !!quote.client_company;

  switch (columnId) {
    case 'quote_number':
      return (
        <span className="truncate font-mono text-xs text-muted-foreground">
          {quote.quote_number}
        </span>
      );

    case 'client':
      return hasClient ? (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-foreground">
            {quote.client_company || quote.client_name}
          </span>
          {quote.client_cnpj && (
            <span className="truncate font-mono text-[10px] text-muted-foreground/70">
              {quote.client_cnpj}
            </span>
          )}
        </div>
      ) : (
        <button
          className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/orcamentos/${quote.id}/editar`);
          }}
        >
          <UserPlus className="h-3 w-3" /> Vincular cliente
        </button>
      );

    case 'contact':
      return quote.client_name && quote.client_company ? (
        <span className="truncate text-[0.975rem] text-muted-foreground">{quote.client_name}</span>
      ) : (
        <span className="text-xs text-muted-foreground/50">—</span>
      );

    case 'status':
      return (
        <Badge
          variant="outline"
          className={cn(
            'h-5 gap-1 px-1.5 py-0 text-[10px]',
            statusConfig[quote.status]?.className || '',
          )}
        >
          {quote.status === 'pending' && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
            </span>
          )}
          {statusConfig[quote.status]?.label}
        </Badge>
      );

    case 'value':
      return (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm font-bold text-foreground">
            {formatCurrency(quote.total || 0)}
          </span>
        </div>
      );

    case 'date':
      return (
        <div className="space-y-0.5">
          <span className="block text-sm text-foreground">
            {quote.created_at
              ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: ptBR })
              : '—'}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {quote.created_at ? format(new Date(quote.created_at), 'HH:mm', { locale: ptBR }) : ''}
          </span>
        </div>
      );

    case 'delivery': {
      const full = quote.delivery_time ? formatDeliveryTime(quote.delivery_time) : '—';
      const compact = quote.delivery_time
        ? quote.delivery_time.startsWith('date:')
          ? full
          : full.replace(/\s*dias?\s*após\s*aprovação/i, 'd').replace(/\s*dias?\s*úteis/i, 'd')
        : '—';
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block cursor-default truncate text-xs text-muted-foreground">
              {compact}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{full}</TooltipContent>
        </Tooltip>
      );
    }

    default:
      return null;
  }
}
