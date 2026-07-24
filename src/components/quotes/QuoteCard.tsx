/**
 * QuoteCard — card resumido de orçamento para listagens e Kanban.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, User, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

export interface QuoteCardData {
  id: string;
  quote_number: string;
  client_name?: string | null;
  client_company?: string | null;
  total: number;
  status: string;
  created_at: string;
  valid_until?: string | null;
}

const STATUS_VARIANTS: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  draft: 'outline',
  pending_approval: 'secondary',
  sent: 'default',
  approved: 'default',
  rejected: 'destructive',
  expired: 'destructive',
};

interface QuoteCardProps {
  quote: QuoteCardData;
  onClick?: () => void;
  className?: string;
}

export function QuoteCard({ quote, onClick, className }: QuoteCardProps) {
  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn('transition hover:border-primary/50', onClick && 'cursor-pointer', className)}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="truncate font-semibold">{quote.quote_number}</span>
          </div>
          <Badge variant={STATUS_VARIANTS[quote.status] ?? 'outline'}>{quote.status}</Badge>
        </div>
        {(quote.client_name || quote.client_company) && (
          <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="truncate">{quote.client_name || quote.client_company}</span>
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(quote.created_at).toLocaleDateString('pt-BR')}
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatCurrency(Number(quote.total ?? 0))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
