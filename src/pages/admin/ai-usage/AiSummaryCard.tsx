import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  loading: boolean;
  color: string;
}

export function AiSummaryCard({ icon, label, value, sub, loading, color }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex items-start gap-3">
            <div className={cn('rounded-lg bg-primary/10 p-2', color)}>{icon}</div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
