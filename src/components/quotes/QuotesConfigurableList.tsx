/**
 * QuotesConfigurableList - Lista de orçamentos com colunas reordenáveis, paginação e seleção em massa
 */

import { useState, useMemo, useCallback } from 'react';
import { renderQuoteCell } from './QuoteListCellRenderer';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MoreVertical,
  Eye,
  Trash2,
  Copy,
  Edit,
  Settings2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  RefreshCw,
} from 'lucide-react';
import type { Quote } from '@/hooks/quotes';
import { BulkActionsBar } from '@/components/common/BulkActionsBar';
import { useBulkSelection } from '@/hooks/common';
import { QuoteRowQuickActions } from './QuoteRowQuickActions';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

// ── Column definitions ──
export interface ColumnDef {
  id: string;
  label: string;
  width: string;
  align?: 'left' | 'right' | 'center';
  required?: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'status', label: 'Status', width: '110px' },
  { id: 'client', label: 'Empresa', width: 'minmax(120px, 0.7fr)', required: true },
  { id: 'contact', label: 'Contato', width: '120px' },
  { id: 'date', label: 'Data', width: '110px' },
  { id: 'value', label: 'Valor', width: '140px', align: 'right' },
  { id: 'delivery', label: 'Entrega', width: '150px' },
  { id: 'quote_number', label: 'Nº Orçamento', width: '200px' },
];

// ── Sortable Header Cell ──
function SortableHeaderCell({ column }: { column: ColumnDef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex cursor-grab select-none items-center gap-1 active:cursor-grabbing ${
        column.align === 'right' ? 'justify-end' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3 w-3 shrink-0 opacity-50" />
      <span>{column.label}</span>
    </div>
  );
}

// ── Props ──
interface QuotesConfigurableListProps {
  quotes: Quote[];
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkStatusChange?: (ids: string[], status: string) => void;
  onBulkExport?: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  onMarkApproved?: (id: string) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function QuotesConfigurableList({
  quotes,
  onDelete,
  onBulkDelete,
  onBulkStatusChange,
  onBulkExport,
  onDuplicate,
  onMarkApproved,
}: QuotesConfigurableListProps) {
  const navigate = useNavigate();

  // ── Pagination ──
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.max(1, Math.ceil(quotes.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedQuotes = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return quotes.slice(start, start + pageSize);
  }, [quotes, safePage, pageSize]);

  // ── Visualizações pelo cliente (apenas página atual, performance) ──
  const selectablePaginatedQuotes = useMemo(
    () => paginatedQuotes.filter((q): q is Quote & { id: string } => Boolean(q.id)),
    [paginatedQuotes],
  );

  // ── Bulk selection (operates on paginated items) ──
  const {
    selectedIds,
    selectedCount,
    toggleItem,
    toggleAll,
    clearSelection,
    isSelected,
    isAllSelected,
  } = useBulkSelection(selectablePaginatedQuotes);

  // "Select ALL across all pages" state
  const [allPagesSelected, setAllPagesSelected] = useState(false);
  const showSelectAllBanner = isAllSelected && quotes.length > 0 && !allPagesSelected;

  const handleSelectAllPages = () => {
    setAllPagesSelected(true);
  };

  const handleClearSelection = () => {
    clearSelection();
    setAllPagesSelected(false);
  };

  const effectiveSelectedCount = allPagesSelected ? quotes.length : selectedCount;
  const effectiveSelectedIds = allPagesSelected
    ? quotes.map((q) => q.id).filter((id): id is string => Boolean(id))
    : selectedIds;

  // Reset allPagesSelected when page/selection changes
  const handleToggleAll = () => {
    setAllPagesSelected(false);
    toggleAll();
  };

  // ── Column state ──
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMNS.map((c) => c.id));
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const visibleColumns = useMemo(
    () =>
      columnOrder
        .filter((id) => !hiddenColumns.has(id))
        .map((id) => ALL_COLUMNS.find((c) => c.id === id))
        .filter((column): column is ColumnDef => Boolean(column)),
    [columnOrder, hiddenColumns],
  );

  const gridTemplate = useMemo(
    () => ['40px', ...visibleColumns.map((c) => c.width), '180px'].join(' '),
    [visibleColumns],
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const toggleColumn = useCallback((colId: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  }, []);

  // Reset page when pageSize changes
  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
    handleClearSelection();
  };

  const renderCell = (quote: Quote, columnId: string) => renderQuoteCell(quote, columnId, navigate);

  return (
    <div className="space-y-2">
      {/* Bulk action bar */}
      <BulkActionsBar
        selectedCount={effectiveSelectedCount}
        selectedIds={effectiveSelectedIds}
        entityLabel="orçamento"
        onClear={handleClearSelection}
        showSelectAllBanner={showSelectAllBanner}
        totalCount={quotes.length}
        onSelectAll={handleSelectAllPages}
        actions={[
          ...(onBulkStatusChange
            ? [
                {
                  id: 'mark-pending',
                  label: 'Marcar Pendente',
                  icon: <RefreshCw className="h-3.5 w-3.5" />,
                  variant: 'outline' as const,
                  onClick: (ids: string[]) => {
                    onBulkStatusChange(ids, 'pending');
                    handleClearSelection();
                  },
                },
              ]
            : []),
          ...(onBulkExport
            ? [
                {
                  id: 'export',
                  label: 'Exportar',
                  icon: <Download className="h-3.5 w-3.5" />,
                  variant: 'outline' as const,
                  onClick: (ids: string[]) => {
                    onBulkExport(ids);
                  },
                },
              ]
            : []),
          {
            id: 'delete',
            label: 'Excluir',
            icon: <Trash2 className="h-3.5 w-3.5" />,
            variant: 'destructive' as const,
            onClick: (ids: string[]) => {
              onBulkDelete([...ids]);
              handleClearSelection();
            },
          },
        ]}
      />

      {/* Column settings button */}
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
              <Settings2 className="h-3.5 w-3.5" />
              Colunas
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Exibir colunas</p>
            <div className="space-y-2">
              {ALL_COLUMNS.map((col) => (
                <label key={col.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={!hiddenColumns.has(col.id)}
                    onCheckedChange={() => toggleColumn(col.id)}
                    disabled={col.required}
                  />
                  <span className={col.required ? 'text-muted-foreground' : ''}>{col.label}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Arraste os cabeçalhos para reordenar
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <div className="max-h-[calc(100vh-420px)] overflow-y-auto overflow-x-hidden rounded-lg border border-border pb-16">
        {/* Header */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div
            className="sticky top-0 z-10 grid gap-4 border-b border-primary/80 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="flex items-center justify-center">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleToggleAll}
                className="border-primary-foreground/50 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
              />
            </div>
            <SortableContext
              items={visibleColumns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {visibleColumns.map((col) => (
                <SortableHeaderCell key={col.id} column={col} />
              ))}
            </SortableContext>
            <span />
          </div>
        </DndContext>

        {/* Rows */}
        {paginatedQuotes.map((quote) => {
          const quoteId = quote.id;
          const selected = Boolean(quoteId && isSelected(quoteId)) || allPagesSelected;

          return (
            <div
              key={quoteId ?? quote.quote_number}
              className={`group grid cursor-pointer items-center gap-4 border-b border-border/40 px-4 py-3 transition-all duration-150 hover:border-l-2 hover:border-l-primary/60 hover:bg-muted/40 ${
                selected ? 'border-l-2 border-l-primary bg-primary/5' : ''
              }`}
              style={{ gridTemplateColumns: gridTemplate }}
              onClick={() => navigate(`/orcamentos/${quote.id}`)}
            >
              <div
                className="flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selected}
                  disabled={!quoteId}
                  onCheckedChange={() => {
                    if (!quoteId) return;
                    if (allPagesSelected) {
                      setAllPagesSelected(false);
                      toggleAll();
                      toggleItem(quoteId);
                    } else {
                      toggleItem(quoteId);
                    }
                  }}
                />
              </div>
              {visibleColumns.map((col) => (
                <div key={col.id} className={cn('min-w-0', col.align === 'right' && 'text-right')}>
                  {col.id === 'client' ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="min-w-0 flex-1">{renderCell(quote, col.id)}</div>
                    </div>
                  ) : (
                    renderCell(quote, col.id)
                  )}
                </div>
              ))}
              <div className="flex items-center justify-end gap-0.5">
                <QuoteRowQuickActions
                  quote={quote}
                  onDuplicate={onDuplicate}
                  onMarkApproved={(id) => onMarkApproved?.(id)}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Mais opções"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => navigate(`/orcamentos/${quote.id}`)}>
                      <Eye className="mr-2 h-4 w-4" /> Visualizar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/orcamentos/${quote.id}/editar`)}>
                      <Edit className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!quoteId}
                      onClick={() => quoteId && onDuplicate(quoteId)}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      disabled={!quoteId}
                      onClick={() => quoteId && onDelete(quoteId)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Exibindo</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>de {quotes.length} resultado(s)</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-2 text-sm text-muted-foreground">
            Página {safePage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="ChevronsLeft"
            className="h-8 w-8"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage(1)}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Voltar"
            className="h-8 w-8"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Avançar"
            className="h-8 w-8"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="ChevronsRight"
            className="h-8 w-8"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
