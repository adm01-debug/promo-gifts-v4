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
    <ScrollArea className="h-[400px] pr-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute bottom-0 left-4 top-0 w-px bg-border" />

        <div className="space-y-4">
          {history.map((entry, index) => (
            <HistoryEntry key={entry.id} entry={entry} isFirst={index === 0} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function HistoryEntry({ entry, isFirst }: { entry: QuoteHistoryEntry; isFirst: boolean }) {
  const icon = actionIcons[entry.action] || <Clock className="h-4 w-4" />;
  const colorClass = actionColors[entry.action] || 'bg-muted text-muted-foreground';

  return (
    <div className="relative pl-10">
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border',
          colorClass,
          isFirst && 'ring-2 ring-primary/20',
        )}
      >
        {icon}
      </div>

      <div className="pt-1">
        <p className="text-sm font-medium text-foreground">{entry.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {format(new Date(entry.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}
