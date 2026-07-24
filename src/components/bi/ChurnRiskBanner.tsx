/**
 * ChurnRiskBanner — alerta de risco de churn no topo do BI.
 * Só aparece quando severity === "high" ou "medium".
 * Inclui linha de "última categoria comprada" para dar gancho de reativação.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Phone, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChurnRisk } from '@/hooks/bi/useChurnRisk';
import { useClientCategoryAffinity } from '@/hooks/bi/useClientCategoryAffinity';

interface Props {
  clientId: string;
  clientName: string;
  clientPhone?: string | null;
}

export function ChurnRiskBanner({ clientId, clientName, clientPhone }: Props) {
  const risk = useChurnRisk(clientId);
  const cats = useClientCategoryAffinity(clientId);
  if (!risk.atRisk) return null;

  const isHigh = risk.severity === 'high';
  const favorite = cats.favorite;
  const reactivationHook =
    favorite && risk.daysSinceLastOrder !== null
      ? `Última categoria forte: "${favorite.label}" (${favorite.revenueSharePct.toFixed(0)}% do histórico) — gancho natural de reativação.`
      : null;

  return (
    <Card
      className={cn(
        'overflow-hidden border-[1.5px]',
        isHigh
          ? 'border-red-500/40 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent'
          : 'border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent',
      )}
    >
      <CardContent className="flex flex-wrap items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            isHigh
              ? 'bg-red-500/20 text-red-600 dark:text-red-400'
              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm font-semibold">
              {isHigh ? '⚠ Risco alto de churn' : 'Atenção: cadência caindo'}
            </h3>
            <Badge
              variant="outline"
              className={cn(
                'border-0 text-[10px]',
                isHigh
                  ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
              )}
            >
              {isHigh ? 'ALTA' : 'MÉDIA'}
            </Badge>
          </div>
          {risk.reason && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{risk.reason}</p>
          )}
          {reactivationHook && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs leading-relaxed text-foreground/70">
              <Layers className="h-3 w-3 text-violet-500" />
              {reactivationHook}
            </p>
          )}
          <p className="mt-1.5 text-xs font-medium text-foreground/80">➜ {risk.suggestedAction}</p>
        </div>
        {clientPhone && (
          <Button
            size="sm"
            variant={isHigh ? 'default' : 'outline'}
            className={cn('shrink-0 gap-2', isHigh && 'bg-red-600 text-white hover:bg-red-700')}
            asChild
          >
            <a
              href={`https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                favorite
                  ? `Olá ${clientName}! Tudo bem? Faz um tempo que não conversamos — preparei novidades em ${favorite.label} para você.`
                  : `Olá ${clientName}! Tudo bem? Faz um tempo que não conversamos — preparei algumas novidades para você.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Phone className="h-4 w-4" />
              Ligar / WhatsApp
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
