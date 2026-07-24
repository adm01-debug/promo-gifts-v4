import { m as motion } from 'framer-motion';
import { Loader2, MessageSquare, Trash2, Search, CalendarDays } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type ExpertConversation } from '@/hooks/intelligence';
import { formatDistanceToNow, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatHistoryPanelProps {
  conversations: ExpertConversation[];
  isLoading: boolean;
  historySearch: string;
  onSearchChange: (s: string) => void;
  historyDateFilter: 'all' | 'month' | 'today' | 'week';
  onDateFilterChange: (f: 'all' | 'month' | 'today' | 'week') => void;
  currentConversationId: string | null;
  onLoadConversation: (c: ExpertConversation) => void;
  onDeleteConversation: (e: React.MouseEvent, id: string) => void;
}

export function ChatHistoryPanel({
  conversations,
  isLoading,
  historySearch,
  onSearchChange,
  historyDateFilter,
  onDateFilterChange,
  currentConversationId,
  onLoadConversation,
  onDeleteConversation,
}: ChatHistoryPanelProps) {
  const filtered = conversations.filter((c) => {
    if (historySearch && !c.title.toLowerCase().includes(historySearch.toLowerCase())) return false;
    if (historyDateFilter !== 'all') {
      const date = new Date(c.updated_at);
      if (historyDateFilter === 'today' && !isToday(date)) return false;
      if (historyDateFilter === 'week' && !isThisWeek(date, { locale: ptBR })) return false;
      if (historyDateFilter === 'month' && !isThisMonth(date)) return false;
    }
    return true;
  });

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-1.5">
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
          <input
            value={historySearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar conversas…"
            className="h-8 w-full rounded-xl border border-border/30 bg-muted/20 pl-8 pr-3 text-xs transition-all placeholder:text-muted-foreground/40 focus-visible:border-primary/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
          />
        </div>
        <div className="mb-3 flex items-center gap-1.5 px-0.5">
          <CalendarDays className="h-3 w-3 shrink-0 text-muted-foreground/40" />
          {(
            [
              { key: 'all', label: 'Todas' },
              { key: 'today', label: 'Hoje' },
              { key: 'week', label: 'Semana' },
              { key: 'month', label: 'Mês' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onDateFilterChange(key)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all',
                historyDateFilter === key
                  ? 'border-primary/30 bg-primary/15 text-primary'
                  : 'border-transparent bg-muted/20 text-muted-foreground/60 hover:bg-muted/40',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
          Conversas anteriores
        </p>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50">
              <MessageSquare className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground/60">
              {historySearch ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
            </p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
          >
            {filtered.map((conv) => (
              <motion.div
                key={conv.id}
                variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                onClick={() => onLoadConversation(conv)}
                className={cn(
                  'group cursor-pointer rounded-xl px-3 py-2.5 transition-all duration-150',
                  currentConversationId === conv.id
                    ? 'bg-primary/8 border border-primary/15'
                    : 'border border-transparent hover:bg-muted/50',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{conv.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                      {formatDistanceToNow(new Date(conv.updated_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir"
                    className="h-7 w-7 rounded-lg text-muted-foreground/40 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    onClick={(e) => onDeleteConversation(e, conv.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </ScrollArea>
  );
}
