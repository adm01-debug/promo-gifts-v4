/**
 * Cell renderer and helpers extracted from QuotesConfigurableList
 */
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDeliveryTime } from '@/components/pdf/ProposalHtmlTemplate';
import { getQuoteRowBadge } from '@/components/quotes/QuotesStatusChips';
import { CompanyListAvatar } from '@/components/shared/CompanyListAvatar';
import { normalizeCnpj, type LogoByCnpj } from '@/hooks/quotes/useQuoteClientLogos';
import { maskCnpj } from '@/utils/masks';
import type { Quote } from '@/hooks/quotes';
import { computeExpiration } from '@/lib/quotes/expiration';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function renderQuoteCell(
  quote: Quote,
  columnId: string,
  navigate: (path: string) => void,
  logoByCnpj?: LogoByCnpj,
  isLogosLoading?: boolean,
  itemCountById?: Record<string, number>,
  _isItemCountsLoading?: boolean,
) {
  const hasClient = !!quote.client_name || !!quote.client_company;
  const clientDisplay = quote.client_company || quote.client_name || '';
  const cnpjKey = normalizeCnpj(quote.client_cnpj);
  const logoUrl = cnpjKey && logoByCnpj ? logoByCnpj[cnpjKey] ?? null : null;
  const logoLoading = !!isLogosLoading && !!cnpjKey && !logoByCnpj;

  switch (columnId) {
    case 'quote_number':
      return (
        <span className="block truncate pl-8 text-left font-mono text-[13px] tabular-nums text-muted-foreground/70">
          {quote.quote_number}
        </span>
      );

    case 'client':
      return hasClient ? (
        <div data-testid="quote-client-cell" className="flex min-w-0 items-center gap-3">
          <CompanyListAvatar
            name={clientDisplay}
            logoUrl={logoUrl}
            isLoading={logoLoading}
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium tracking-tight text-foreground">
              {clientDisplay}
            </span>
            {quote.client_cnpj && (
              <span className="truncate font-mono text-[10px] tabular-nums text-muted-foreground/60">
                {maskCnpj(quote.client_cnpj)}
              </span>
            )}
          </div>
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
        <span className="truncate text-[13px] text-foreground/80">{quote.client_name}</span>
      ) : (
        <span className="text-xs text-muted-foreground/50">—</span>
      );

    case 'status': {
      const { key, label, className, description } = getQuoteRowBadge(quote);
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              data-testid={`quote-status-badge-${key}`}
              data-status-key={key}
              className={`inline-flex h-5 max-w-full items-center gap-1 truncate whitespace-nowrap px-1.5 py-0 text-[10px] leading-none ${className}`}
            >
              {label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            data-testid={`quote-status-badge-tooltip-${key}`}
            className="max-w-[260px] text-xs"
          >
            {description}
          </TooltipContent>
        </Tooltip>
      );
    }

    case 'items': {
      const count = (quote.id && itemCountById?.[quote.id]) ?? 0;
      return (
        <div className="flex items-center justify-center">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted/60 px-2 text-[11px] font-medium tabular-nums text-foreground/80 ring-1 ring-border/50">
            {count}
          </span>
        </div>
      );
    }

    case 'value':
      return (
        <span className="block text-left text-[13px] font-semibold tabular-nums text-foreground">
          {formatCurrency(quote.total || 0)}
        </span>
      );

    case 'date':
      return (
        <div className="space-y-0.5">
          <span className="block text-[12px] tabular-nums text-foreground/90">
            {quote.created_at
              ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: ptBR })
              : '—'}
          </span>
          <span className="block text-[10.5px] tabular-nums text-muted-foreground/70">
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
            <span className="block cursor-default truncate pl-4 text-[11.5px] text-muted-foreground/80">
              {compact}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{full}</TooltipContent>
        </Tooltip>
      );
    }

    case 'expiration': {
      const { diffDays, label, tone, formattedDate } = computeExpiration(quote.valid_until);
      if (diffDays === null || !tone || !formattedDate) {
        return <span className="block text-center text-[11.5px] text-muted-foreground/50">—</span>;
      }
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              data-testid="quote-expiration-cell"
              data-expiration-days={diffDays}
              tabIndex={0}
              role="status"
              aria-label={`${label}. Válido até ${formattedDate}`}
              className={`block cursor-default text-center text-[11.5px] font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-sm ${tone}`}
            >
              {label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Válido até {formattedDate}
          </TooltipContent>
        </Tooltip>
      );
    }

    default:
      return null;
  }
}
