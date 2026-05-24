/**
 * ClientComparator — comparação lado-a-lado de até 3 clientes.
 * Tabela: Health Score, LTV, ticket, frequência, top categoria, próxima janela.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, X, Trophy, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSingleClientComparisonRow, type ClientComparisonRow } from "@/hooks/bi/useClientsComparison";

interface Props {
  clientIds: string[]; // 1-3
  onRemove: (id: string) => void;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function tierBadge(tier: ClientComparisonRow["tier"]) {
  switch (tier) {
    case "healthy":
      return { color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10", icon: CheckCircle2, label: "Saudável" };
    case "attention":
      return { color: "text-amber-600 dark:text-amber-400 bg-amber-500/10", icon: AlertTriangle, label: "Atenção" };
    case "risk":
      return { color: "text-red-600 dark:text-red-400 bg-red-500/10", icon: AlertTriangle, label: "Risco" };
    default:
      return { color: "text-muted-foreground bg-muted", icon: Minus, label: "—" };
  }
}

function ClientColumn({ clientId, onRemove }: { clientId: string; onRemove: () => void }) {
  const row = useSingleClientComparisonRow(clientId);
  const tier = tierBadge(row.tier);
  const TierIcon = tier.icon;

  if (row.isLoading) {
    return (
      <div className="flex-1 min-w-[240px] space-y-3 p-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-[240px] border-l first:border-l-0 p-4 space-y-3 relative">
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
        aria-label="Remover"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div>
        <h4 className="font-display font-semibold text-sm pr-6">{row.clientName}</h4>
        {row.ramoAtividade && (
          <Badge variant="secondary" className="text-[10px] mt-1">{row.ramoAtividade}</Badge>
        )}
      </div>
      <div className={cn("rounded-xl p-3 flex items-center gap-3", tier.color.split(" ").slice(-1)[0])}>
        <div className="h-14 w-14 rounded-xl bg-background/80 border-[1.5px] flex flex-col items-center justify-center">
          <span className={cn("font-display font-bold text-2xl leading-none", tier.color.split(" ")[0], tier.color.split(" ")[1])}>
            {row.score}
          </span>
          <span className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">Score</span>
        </div>
        <Badge variant="outline" className={cn("border-0 gap-1", tier.color)}>
          <TierIcon className="h-3 w-3" />
          {tier.label}
        </Badge>
      </div>
      <dl className="space-y-2 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">LTV</dt>
          <dd className="font-medium tabular-nums">{fmtBRL(row.ltv)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Ticket médio</dt>
          <dd className="font-medium tabular-nums">{fmtBRL(row.avgTicket)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Pedidos</dt>
          <dd className="font-medium tabular-nums">{row.ordersCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Última compra</dt>
          <dd className="font-medium tabular-nums">
            {row.daysSinceLastOrder !== null ? `${row.daysSinceLastOrder}d` : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Top categoria</dt>
          <dd className="font-medium truncate max-w-[120px]" title={row.topCategory ?? "—"}>
            {row.topCategory ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2 items-center">
          <dt className="text-muted-foreground">Categoria favorita</dt>
          <dd className="font-medium truncate max-w-[140px] flex items-center gap-1.5" title={row.favoriteCategoryLabel ?? "—"}>
            {row.favoriteCategoryLabel ? (
              <>
                <span className="truncate">{row.favoriteCategoryLabel}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shrink-0 tabular-nums">
                  {row.favoriteCategorySharePct}%
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-2 items-center">
          <dt className="text-muted-foreground">Categoria oportunidade</dt>
          <dd className="font-medium truncate max-w-[140px] flex items-center gap-1.5" title={row.opportunityCategoryLabel ?? "—"}>
            {row.opportunityCategoryLabel ? (
              <>
                <span className="truncate">{row.opportunityCategoryLabel}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1 border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 shrink-0 tabular-nums">
                  setor {row.opportunityCategorySharePct}%
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Próximo pico</dt>
          <dd className="font-medium">{row.nextPeakLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Share-of-wallet</dt>
          <dd className="font-medium tabular-nums">{row.shareOfWalletPct}%</dd>
        </div>
      </dl>
    </div>
  );
}

export function ClientComparator({ clientIds, onRemove }: Props) {
  if (clientIds.length === 0) {
    return (
      <Card className="border-[1.5px] border-dashed">
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          Adicione clientes para começar a comparação.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[1.5px]">
      <CardContent className="p-0">
        <div className="p-4 border-b flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-sm">
            Comparação · {clientIds.length} {clientIds.length === 1 ? "cliente" : "clientes"}
          </h3>
        </div>
        <div className="flex flex-col md:flex-row overflow-x-auto">
          {clientIds.map((id) => (
            <ClientColumn key={id} clientId={id} onRemove={() => onRemove(id)} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
