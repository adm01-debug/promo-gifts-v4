/**
 * KitStockForecastCard — sugere data ideal de fechamento do kit
 * com base nas previsões de reposição dos itens em deficit.
 */
import { CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useKitStockForecast } from '@/hooks/kit-builder';
import type { KitItem } from '@/lib/kit-builder';

interface Props {
  items: KitItem[];
  kitQuantity: number;
}

export function KitStockForecastCard({ items, kitQuantity }: Props) {
  const { data, isLoading } = useKitStockForecast(items, kitQuantity);

  if (isLoading || !data) return null;

  if (data.ready) {
    return (
      <Card className="border-success/50 bg-success/5">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div className="text-sm">
            <p className="font-medium text-success">Estoque suficiente para fechamento imediato</p>
            <p className="text-xs text-muted-foreground">Todos os itens disponíveis na quantidade necessária.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <Card className="border-warning/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-warning" />
          Previsão de Fechamento
          {data.idealClosingDate && (
            <Badge variant="outline" className="ml-auto">{formatDate(data.idealClosingDate)}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.idealClosingDate ? (
          <p className="text-xs text-muted-foreground">
            Data ideal de fechamento considera reposição prevista + buffer de {data.bufferDays} dias.
          </p>
        ) : (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Sem previsão de reposição para itens em deficit.
          </p>
        )}
        <ul className="space-y-1">
          {data.itemsAtRisk.map((it) => (
            <li key={it.itemId} className="text-xs flex items-center justify-between bg-muted/40 rounded px-2 py-1">
              <span className="truncate flex-1">{it.itemName}</span>
              <span className="text-destructive font-medium ml-2">−{it.deficit}</span>
              <span className="text-muted-foreground ml-2">→ {formatDate(it.nextEntryDate)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
