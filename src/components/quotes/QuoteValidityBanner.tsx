import { differenceInDays, parseISO, isValid } from 'date-fns';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

interface QuoteValidityBannerProps {
  validUntil?: string;
  status: string;
}

export function QuoteValidityBanner({ validUntil, status }: QuoteValidityBannerProps) {
  if (!validUntil || ['approved', 'rejected', 'cancelled', 'converted'].includes(status))
    return null;

  const expiryDate = parseISO(validUntil);
  if (!isValid(expiryDate)) return null;

  const daysLeft = differenceInDays(expiryDate, new Date());

  if (status === 'expired' || daysLeft < 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">
          Expirado há {Math.abs(daysLeft)} dia{Math.abs(daysLeft) !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  if (daysLeft <= 3) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-2.5 text-warning">
        <Clock className="h-4 w-4 shrink-0 animate-pulse" />
        <span className="text-sm font-medium">
          Expira em {daysLeft} dia{daysLeft !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2.5 text-primary dark:text-primary">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">
        Válido por mais {daysLeft} dia{daysLeft !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
