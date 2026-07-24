import { useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  History,
  Plus,
  Edit2,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  FileText,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { TimelineDot, TimelineLine } from '@/components/ui/timeline';
import { useQuoteHistory, type QuoteHistoryEntry } from '@/hooks/quotes';
import { cn } from '@/lib/utils';

interface QuoteHistoryPanelProps {
  quoteId: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  created: <Plus className="h-4 w-4" />,
  updated: <Edit2 className="h-4 w-4" />,
  status_changed: <RefreshCw className="h-4 w-4" />,
  item_added: <Package className="h-4 w-4" />,
  item_removed: <Trash2 className="h-4 w-4" />,
  item_updated: <Edit2 className="h-4 w-4" />,
  // Sync events
  sync_started: <Zap className="h-4 w-4" />,
  sync_pdf_ok: <FileText className="h-4 w-4" />,
  sync_pdf_error: <AlertTriangle className="h-4 w-4" />,
  sync_success: <CheckCircle className="h-4 w-4" />,
  sync_error: <XCircle className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  created: 'bg-primary/10 text-primary border-primary/20',
  updated: 'bg-primary/10 text-primary border-primary/20',
  status_changed: 'bg-warning/10 text-warning border-warning/20',
  item_added: 'bg-primary/10 text-primary border-primary/20',
  item_removed: 'bg-destructive/10 text-destructive border-destructive/20',
  item_updated: 'bg-primary/15 text-primary/80 border-primary/25',
  // Sync events
  sync_started: 'bg-primary/10 text-primary/70 border-primary/20',
  sync_pdf_ok: 'bg-primary/10 text-primary/60 border-primary/15',
  sync_pdf_error: 'bg-warning/10 text-warning border-warning/20',
  sync_success: 'bg-primary/10 text-primary border-primary/30',
  sync_error: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function QuoteHistoryPanel({ quoteId }: QuoteHistoryPanelProps) {
  const { history, isLoading, fetchHistory } = useQuoteHistory();

  useEffect(() => {
    if (quoteId) {
      fetchHistory(quoteId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <History className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Nenhum histórico disponível</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-9rem)] pr-3">
      <div className="relative">
        <TimelineLine leftClassName="left-[15px]" />



        <ol className="space-y-1.5">
          {history.map((entry, index) => (
            <HistoryEntry key={entry.id} entry={entry} isFirst={index === 0} />
          ))}
        </ol>
      </div>
    </ScrollArea>
  );
}

function HistoryEntry({ entry, isFirst }: { entry: QuoteHistoryEntry; isFirst: boolean }) {
  const icon = actionIcons[entry.action] || <Clock className="h-3.5 w-3.5" />;
  const colorClass =
    actionColors[entry.action] || 'bg-muted/40 text-muted-foreground border-border/50';

  return (
    <li className="group relative pl-11">
      <TimelineDot
        highlighted={isFirst}
        toneClassName={colorClass}
        className="absolute left-0 top-2 h-8 w-8"
      >
        {icon}
      </TimelineDot>

      <div
        className={cn(
          'rounded-lg border border-transparent px-3 py-2 transition-all duration-200',
          'group-hover:border-border/40 group-hover:bg-card/40',
        )}
      >
        <p className="text-[13px] font-medium leading-snug text-foreground">
          {entry.description}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
          <Clock className="h-3 w-3" aria-hidden="true" />
          <time dateTime={entry.created_at}>
            {format(new Date(entry.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
          </time>
        </p>
      </div>
    </li>
  );
}
