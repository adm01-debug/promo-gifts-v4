import { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Clock,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  DollarSign,
  Calendar,
  Building2,
  GripVertical,
} from 'lucide-react';
import { type Quote, useQuotes } from '@/hooks/quotes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatBRL, formatBRLShort } from '@/utils/currency';

type QuoteStatus = Quote['status'];

interface Column {
  id: QuoteStatus;
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const QUOTE_VALID_TRANSITIONS: Record<string, QuoteStatus[]> = {
  draft: ['pending', 'sent'],
  pending_approval: ['draft'],
  pending: ['draft', 'sent', 'expired'],
  sent: ['approved', 'rejected', 'pending', 'expired'],
  approved: ['sent'],
  rejected: ['sent'],
  expired: ['pending', 'sent'],
} as const;

const columns: Column[] = [
  {
    id: 'draft',
    title: 'Rascunho',
    icon: FileText,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
  },
  {
    id: 'pending_approval',
    title: 'Aguardando Aprovação',
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-gradient-to-b from-amber-500/15 to-amber-500/5',
  },
  {
    id: 'pending',
    title: 'Pendente',
    icon: Clock,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    id: 'sent',
    title: 'Enviado',
    icon: Send,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  {
    id: 'approved',
    title: 'Aprovado',
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    id: 'rejected',
    title: 'Rejeitado',
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  {
    id: 'expired',
    title: 'Expirado',
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/20',
  },
];

interface QuoteCardProps {
  quote: Quote;
  isDragging?: boolean;
  /** Quando true, o card pulsa indicando que uma mutação está em andamento. */
  isSaving?: boolean;
}

function QuoteCard({ quote, isDragging, isSaving }: QuoteCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className={cn(
        'cursor-grab transition-all duration-200 active:cursor-grabbing',
        'border-border/50 bg-card hover:bg-accent/50',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary',
        isSaving && 'animate-pulse cursor-wait opacity-70 ring-2 ring-primary/50',
        quote.status === 'pending_approval' && 'border-amber-500/40 ring-1 ring-amber-500/10',
      )}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-xs font-medium text-primary">{quote.quote_number}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Visualizar"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/orcamentos/${quote.id}`);
            }}
          >
            <Eye className="h-3 w-3" />
          </Button>
        </div>

        {quote.client_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{quote.client_name}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
            <DollarSign className="h-3.5 w-3.5 text-success" />
            {formatBRL(quote.total ?? 0)}
          </div>
          {quote.created_at && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(quote.created_at), 'dd/MM', { locale: ptBR })}
            </div>
          )}
        </div>

        {quote.valid_until && (
          <div className="text-xs text-muted-foreground">
            Válido até: {format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: ptBR })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SortableQuoteCardProps {
  quote: Quote;
  isSaving?: boolean;
}

function getSortableQuoteId(quote: Quote) {
  return quote.id ?? `quote-${quote.quote_number}`;
}

function SortableQuoteCard({ quote, isSaving }: SortableQuoteCardProps) {
  const sortableId = getSortableQuoteId(quote);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <QuoteCard quote={quote} isDragging={isDragging} isSaving={isSaving} />
    </div>
  );
}

interface KanbanColumnProps {
  column: Column;
  quotes: Quote[];
  totalValue: number;
  /** Set de IDs dos cards em processo de salvamento (mostra pulse). */
  savingIds: Set<string>;
}

function KanbanColumn({ column, quotes, totalValue, savingIds }: KanbanColumnProps) {
  const Icon = column.icon;
  const sortableQuoteIds = quotes.map(getSortableQuoteId);

  return (
    <div className="flex min-w-[280px] max-w-[320px] flex-col">
      <Card className={cn('mb-3', column.bgColor, 'border-border/30')}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={cn('h-4 w-4', column.color)} />
              <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              {quotes.length}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{formatBRLShort(totalValue)}</div>
        </CardHeader>
      </Card>

      <ScrollArea className="max-h-[calc(100vh-320px)] min-h-[400px] flex-1">
        <SortableContext items={sortableQuoteIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 p-1">
            {quotes.map((quote) => (
              <SortableQuoteCard
                key={getSortableQuoteId(quote)}
                quote={quote}
                isSaving={savingIds.has(quote.id ?? '')}
              />
            ))}
            {quotes.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/50 py-8 text-center text-sm text-muted-foreground">
                Nenhum orçamento
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

interface QuoteKanbanBoardProps {
  quotes: Quote[];
}

export function QuoteKanbanBoard({ quotes }: QuoteKanbanBoardProps) {
  const { updateQuoteStatus } = useQuotes();
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  /** IDs dos cards que estão sendo salvos — exibe animate-pulse enquanto a mutação está pendente. */
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    // Mouse / stylus: ativa após arrastar 8px (evita cliques acidentais)
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    // Touch (mobile): ativa após 250ms pressionado + tolerância de 5px de movimento
    // O delay diferencia scroll vertical de drag intencional no iOS/Android
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    // Teclado: acessibilidade — move cards com setas + Enter/Espaço
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const quotesByStatus = useMemo(() => {
    const grouped: Record<string, Quote[]> = {
      draft: [],
      pending_approval: [],
      pending: [],
      sent: [],
      approved: [],
      rejected: [],
      expired: [],
    };

    quotes.forEach((quote) => {
      if (grouped[quote.status]) {
        grouped[quote.status].push(quote);
      }
    });

    return grouped;
  }, [quotes]);

  const totalsByStatus = useMemo(() => {
    const totals: Record<string, number> = {
      draft: 0,
      pending_approval: 0,
      pending: 0,
      sent: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
    };

    quotes.forEach((quote) => {
      if (totals[quote.status] !== undefined) {
        totals[quote.status] += quote.total ?? 0;
      }
    });

    return totals;
  }, [quotes]);

  const handleDragStart = (event: DragStartEvent) => {
    const quote = quotes.find((q) => q.id === event.active.id);
    setActiveQuote(quote || null);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Handled on drag end for simplicity
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveQuote(null);

    const { active, over } = event;
    if (!over) return;

    const draggedQuote = quotes.find((q) => q.id === active.id);
    if (!draggedQuote) return;

    // Find target column - check if dropped on column or another card
    let targetStatus: QuoteStatus | null = null;

    // Check if dropped on a column directly
    const targetColumn = columns.find((col) => col.id === over.id);
    if (targetColumn) {
      targetStatus = targetColumn.id;
    } else {
      // Dropped on another card - find which column that card belongs to
      const targetQuote = quotes.find((q) => q.id === over.id);
      if (targetQuote) {
        targetStatus = targetQuote.status;
      }
    }

    if (targetStatus && targetStatus !== draggedQuote.status) {
      if (!QUOTE_VALID_TRANSITIONS[draggedQuote.status]?.includes(targetStatus)) {
        toast.error('Transição inválida', {
          description: `Não é possível mover de "${columns.find((c) => c.id === draggedQuote.status)?.title}" para "${columns.find((c) => c.id === targetStatus)?.title}"`,
        });
        return;
      }

      if (!draggedQuote.id) return;

      // Marca o card como "salvando" para feedback visual imediato (animate-pulse)
      const cardId = draggedQuote.id;
      setSavingIds((prev) => new Set([...prev, cardId]));

      try {
        const success = await updateQuoteStatus(cardId, targetStatus);
        if (success) {
          toast.success('Status atualizado!', {
            description: `Orçamento movido para "${columns.find((c) => c.id === targetStatus)?.title}"`,
          });
          // 🎉 Celebration when quote is approved
          if (targetStatus === 'approved') {
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.7 },
              colors: ['hsl(25, 100%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(217, 91%, 60%)'],
            });
          }
        } else {
          // Falha silenciosa do updateQuoteStatus — mostra rollback visual
          toast.error('Erro ao atualizar status', {
            description: 'O card foi revertido para a posição original. Tente novamente.',
          });
        }
      } catch {
        toast.error('Falha ao salvar', {
          description: 'Verifique sua conexão e tente novamente.',
        });
      } finally {
        // Remove o indicador de salvamento independente do resultado
        setSavingIds((prev) => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            quotes={quotesByStatus[column.id]}
            totalValue={totalsByStatus[column.id]}
            savingIds={savingIds}
          />
        ))}
      </div>

      <DragOverlay>{activeQuote && <QuoteCard quote={activeQuote} isDragging />}</DragOverlay>
    </DndContext>
  );
}
