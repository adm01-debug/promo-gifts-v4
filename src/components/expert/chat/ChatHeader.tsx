import { Bot, X, Sparkles, History, Plus, Filter } from 'lucide-react';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type FlowFilterState, getActiveFilterLabels } from '../FlowFilterPanel';

interface ChatHeaderProps {
  clientName?: string;
  activeFiltersCount: number;
  flowFilters: FlowFilterState;
  setFlowFilters: (fn: (prev: FlowFilterState) => FlowFilterState) => void;
  showHistory: boolean;
  onToggleHistory: () => void;
  onNewConversation: () => void;
  onOpenFilters: () => void;
  onClose: () => void;
}

export function ChatHeader({
  clientName,
  activeFiltersCount,
  flowFilters,
  setFlowFilters,
  showHistory,
  onToggleHistory,
  onNewConversation,
  onOpenFilters,
  onClose,
}: ChatHeaderProps) {
  return (
    <DialogHeader className="flex-shrink-0 border-b border-border/30 bg-gradient-to-b from-primary/[0.03] to-transparent px-5 pb-3 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-background bg-success" />
          </div>
          <div>
            <DialogTitle className="flex items-center gap-1.5 font-display text-base font-semibold tracking-tight">
              Flow
              <Sparkles className="h-3.5 w-3.5 text-primary/60" />
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[11px] leading-none text-muted-foreground/70">
              Assistente pessoal de vendas
            </DialogDescription>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'relative h-8 w-8 rounded-xl p-0',
              activeFiltersCount > 0 && 'bg-primary/10 text-primary',
            )}
            onClick={onOpenFilters}
            title="Filtros"
          >
            <Filter className="h-4 w-4" />
            {activeFiltersCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleHistory}
            className="h-8 w-8 rounded-xl p-0"
            title={showHistory ? 'Voltar ao chat' : 'Histórico'}
            aria-label="Histórico"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewConversation}
            className="h-8 w-8 rounded-xl p-0"
            title="Nova conversa"
            aria-label="Nova conversa"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 rounded-xl p-0"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {activeFiltersCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {getActiveFilterLabels(flowFilters).map(({ label, key, value }) => (
            <Badge
              key={`${key}-${value || label}`}
              variant="secondary"
              className="cursor-pointer gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (key === 'price') {
                  setFlowFilters((prev) => ({ ...prev, priceMin: '', priceMax: '' }));
                } else if (value && Array.isArray(flowFilters[key as keyof FlowFilterState])) {
                  setFlowFilters((prev) => ({
                    ...prev,
                    [key]: (prev[key as keyof FlowFilterState] as string[]).filter(
                      (v) => v !== value,
                    ),
                  }));
                } else {
                  setFlowFilters((prev) => ({ ...prev, [key]: false }));
                }
              }}
            >
              {label}
              <X className="h-2 w-2" />
            </Badge>
          ))}
        </div>
      )}

      {clientName && (
        <div className="mt-2">
          <Badge
            variant="outline"
            className="rounded-lg text-[10px] font-normal text-muted-foreground"
          >
            Cliente: {clientName}
          </Badge>
        </div>
      )}
    </DialogHeader>
  );
}
