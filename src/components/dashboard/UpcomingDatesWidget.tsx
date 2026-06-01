import { useUpcomingCommemorativeDates, type CommemorativeDate } from '@/hooks/intelligence';
import { Calendar, Gift, ChevronRight, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';

interface UpcomingDatesWidgetProps {
  daysAhead?: number;
  maxItems?: number;
  className?: string;
  variant?: 'compact' | 'full';
}

/**
 * Widget de próximas datas comemorativas para o Dashboard
 * Mostra countdown e permite navegar para o catálogo filtrado
 */
export function UpcomingDatesWidget({
  daysAhead = 60,
  maxItems = 5,
  className,
  variant = 'compact',
}: UpcomingDatesWidgetProps) {
  const navigate = useNavigate();
  const { data: upcomingDates, isLoading, error } = useUpcomingCommemorativeDates(daysAhead);

  const handleNavigateToDate = (slug: string) => {
    // Navega para o catálogo com o filtro de data aplicado
    navigate(`/filtros?data=${slug}`);
  };

  if (error) {
    console.error('Erro ao carregar próximas datas:', error);
    return null;
  }

  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-3/4 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!upcomingDates?.length) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            Próximas Datas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma data comemorativa nos próximos {daysAhead} dias
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayDates = upcomingDates.slice(0, maxItems);
  const hasMore = upcomingDates.length > maxItems;

  if (variant === 'compact') {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className="border-b bg-muted/30 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Gift className="h-4 w-4 text-primary" />
              Próximas Datas
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {upcomingDates.length} em {daysAhead}d
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="flex gap-2 p-3">
              {displayDates.map((date) => (
                <CompactDateCard
                  key={date.id}
                  date={date}
                  onClick={() => handleNavigateToDate(date.slug)}
                />
              ))}
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto flex-shrink-0 px-4 py-3"
                  onClick={() => navigate('/filtros')}
                >
                  <span className="text-xs">+{upcomingDates.length - maxItems}</span>
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  // Variant "full"
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4 text-primary" />
            Próximas Datas Comemorativas
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => navigate('/filtros')}
          >
            Ver todas
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayDates.map((date, index) => (
          <FullDateCard
            key={date.id}
            date={date}
            isFirst={index === 0}
            onClick={() => handleNavigateToDate(date.slug)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface DateCardProps {
  date: CommemorativeDate;
  onClick: () => void;
  isFirst?: boolean;
}

function CompactDateCard({ date, onClick }: DateCardProps) {
  const isToday = date.days_until === 0;
  const isThisWeek = date.days_until !== null && date.days_until <= 7;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-shrink-0 flex-col items-center gap-1.5 rounded-lg border p-3 transition-all',
        'hover:border-primary hover:bg-primary/5',
        isToday && 'border-success bg-success/10',
        isThisWeek && !isToday && 'bg-warning/5/50 border-warning/50 dark:bg-warning/10',
      )}
    >
      {/* Cor indicadora */}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-2 ring-white dark:ring-gray-800"
        style={{ backgroundColor: date.color_hex || 'hsl(var(--primary))' }}
      >
        {date.is_featured && <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />}
      </div>

      {/* Nome */}
      <span className="max-w-[80px] truncate text-center text-[11px] font-medium leading-tight">
        {date.name}
      </span>

      {/* Countdown */}
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-bold',
          isToday
            ? 'bg-success text-success-foreground'
            : isThisWeek
              ? 'bg-warning text-primary-foreground'
              : 'bg-muted text-muted-foreground',
        )}
      >
        {getDaysUntilText(date.days_until)}
      </span>
    </button>
  );
}

function FullDateCard({ date, onClick, isFirst }: DateCardProps) {
  const isToday = date.days_until === 0;
  const isThisWeek = date.days_until !== null && date.days_until <= 7;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
        'hover:border-primary hover:bg-primary/5',
        isFirst && 'border-primary/50 bg-primary/5',
        isToday && 'border-success bg-success/10',
        isThisWeek && !isToday && !isFirst && 'border-warning/30',
      )}
    >
      {/* Cor indicadora */}
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: date.color_hex || 'hsl(var(--muted))' }}
      >
        {date.is_featured ? (
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Gift className="h-4 w-4 text-primary-foreground/80" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{date.name}</span>
          {date.is_featured && (
            <Badge variant="secondary" className="px-1 py-0 text-[9px]">
              Destaque
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {date.formatted_date && (
            <span className="text-xs text-muted-foreground">{date.formatted_date}</span>
          )}
          {date.product_count !== undefined && (
            <span className="text-xs text-primary">{date.product_count} produtos</span>
          )}
        </div>
      </div>

      {/* Countdown */}
      <div className="flex flex-col items-end gap-1">
        <span
          className={cn(
            'rounded px-2 py-1 text-xs font-bold',
            isToday
              ? 'bg-success text-success-foreground'
              : isThisWeek
                ? 'bg-warning text-primary-foreground'
                : 'bg-muted text-foreground',
          )}
        >
          {getDaysUntilText(date.days_until)}
        </span>
        <Clock className="h-3 w-3 text-muted-foreground" />
      </div>
    </button>
  );
}

function getDaysUntilText(daysUntil: number | null): string {
  if (daysUntil === null) return '—';
  if (daysUntil === 0) return 'HOJE!';
  if (daysUntil === 1) return 'Amanhã';
  if (daysUntil <= 7) return `${daysUntil} dias`;
  if (daysUntil <= 30) return `${Math.ceil(daysUntil / 7)} sem`;
  return `${Math.ceil(daysUntil / 30)} mês`;
}

export default UpcomingDatesWidget;
