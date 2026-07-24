/**
 * QuoteApprovalCard — card de visualização pública do orçamento para o cliente aprovar/recusar.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { getQuoteStatusLabel, QUOTE_STATUS_CONFIG } from '@/lib/quote-status-config';

interface QuoteApprovalCardProps {
  quoteNumber: string;
  clientName?: string | null;
  total: number;
  validUntil?: string | null;
  status: string;
  onApprove?: () => void;
  onReject?: () => void;
  isResponded?: boolean;
}

export function QuoteApprovalCard({
  quoteNumber,
  clientName,
  total,
  validUntil,
  status,
  onApprove,
  onReject,
  isResponded,
}: QuoteApprovalCardProps) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Orçamento {quoteNumber}</CardTitle>
            {clientName && <p className="mt-1 text-sm text-muted-foreground">Para: {clientName}</p>}
          </div>
          <Badge variant={QUOTE_STATUS_CONFIG[status]?.badgeVariant ?? 'secondary'}>
            {getQuoteStatusLabel(status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">Valor total</p>
          <p className="text-3xl font-semibold tabular-nums text-primary">
            {formatCurrency(total)}
          </p>
        </div>
        {validUntil && (
          <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> Válido até{' '}
            {new Date(validUntil).toLocaleDateString('pt-BR')}
          </p>
        )}
        {!isResponded && (onApprove || onReject) && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onReject}
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              <XCircle className="mr-2 h-4 w-4" /> Recusar
            </Button>
            <Button onClick={onApprove}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
