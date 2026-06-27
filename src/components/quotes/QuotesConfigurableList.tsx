/**
 * QuotesConfigurableList - Lista de orçamentos com colunas fixas, paginação e seleção em massa.
 */


import { useState, useMemo, useCallback, useEffect } from 'react';
import { renderQuoteCell } from './QuoteListCellRenderer';
import { useQuoteClientLogos } from '@/hooks/quotes/useQuoteClientLogos';
import { useQuoteItemCounts } from '@/hooks/quotes/useQuoteItemCounts';
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

import {
  MoreVertical,
  Eye,
  Trash2,
  Copy,
  Edit,
} from 'lucide-react';

import type { Quote } from '@/hooks/quotes';

import { useBulkSelection } from '@/hooks/common';

import { cn } from '@/lib/utils';

// ── Column definitions ──
export interface ColumnDef {
  id: string;
  label: string;
  width: string;
  align?: 'center' | 'left' | 'right';
  required?: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'client', label: 'Empresa', width: 'minmax(220px, 1.4fr)', required: true },
  { id: 'contact', label: 'Contato', width: 'minmax(140px, 0.9fr)' },
  { id: 'date', label: 'Data', width: '120px' },
  { id: 'items', label: 'Itens', width: '80px', align: 'center' },
  { id: 'value', label: 'Valor', width: '140px', align: 'right' },
  { id: 'delivery', label: 'Entrega', width: '90px' },
  { id: 'status', label: 'Status', width: '150px' },
  { id: 'quote_number', label: 'Nº Orçamento', width: '120px', align: 'right' },
];


// ── Props ──
interface QuotesConfigurableListProps {
  quotes: Quote[];
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkStatusChange?: (ids: string[], status: string) => void;
  onBulkExport?: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function QuotesConfigurableList({
  quotes,
  onDelete,
  onBulkDelete,
  onBulkStatusChange,
  onBulkExport,
  onDuplicate,
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

  // ── Persistência (sessionStorage) ──
  // Mantém modo de seleção + IDs marcados ao trocar de página/rota dentro
  // do app. Limpa-se ao fechar a aba (sessionStorage por design).
  const STORAGE_KEY = 'quotes:selection-state:v1';
  const persisted = useMemo(() => {
    if (typeof window === 'undefined') return { mode: false, ids: [] as string[] };
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return { mode: false, ids: [] as string[] };
      const parsed = JSON.parse(raw) as { mode?: boolean; ids?: string[] };
      return { mode: Boolean(parsed.mode), ids: Array.isArray(parsed.ids) ? parsed.ids : [] };
    } catch {
      return { mode: false, ids: [] as string[] };
    }
  }, []);

  // ── Bulk selection (operates on paginated items) ──
  const {
    selectedIds,
    selectedCount,
    toggleItem,
    toggleAll,
    clearSelection,
    isSelected,
    isAllSelected,
  } = useBulkSelection(selectablePaginatedQuotes, persisted.ids);

  // Modo de seleção: quando OFF, checkboxes ficam ocultos e nada está marcado.
  // Ligado pelo botão "Selecionar" da barra de chips (evento global).
  const [selectionMode, setSelectionMode] = useState(persisted.mode);

  // "Select ALL across all pages" state
  const [allPagesSelected, setAllPagesSelected] = useState(false);
  const showSelectAllBanner =
    selectionMode && isAllSelected && quotes.length > 0 && !allPagesSelected;

  const handleSelectAllPages = () => {
    setAllPagesSelected(true);
  };

  const handleClearSelection = useCallback(() => {
    clearSelection();
    setAllPagesSelected(false);
  }, [clearSelection]);

  const effectiveSelectedCount = allPagesSelected ? quotes.length : selectedCount;
  const effectiveSelectedIds = allPagesSelected
    ? quotes.map((q) => q.id).filter((id): id is string => Boolean(id))
    : selectedIds;

  // Toggle do header (select-all visível) — não confundir com o botão da barra de chips.
  const handleToggleAll = () => {
    setAllPagesSelected(false);
    toggleAll();
  };

  // Botão "Selecionar" da barra de chips: alterna o MODO de seleção.
  // Liga = mostra os checkboxes (nenhum marcado). Desliga = limpa e oculta.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled?: boolean }>).detail;
      const next = typeof detail?.enabled === 'boolean' ? detail.enabled : !selectionMode;
      setSelectionMode(next);
      if (!next) handleClearSelection();
    };
    window.addEventListener('quotes:toggle-select-all', handler);
    return () => window.removeEventListener('quotes:toggle-select-all', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionMode, handleClearSelection]);

  // Notifica a página (botão "Selecionar"/"Cancelar seleção") quando o modo
  // ou a contagem efetiva muda — mantém o label/estado visual em sincronia.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('quotes:selection-changed', {
        detail: { count: effectiveSelectedCount, mode: selectionMode },
      }),
    );
  }, [effectiveSelectedCount, selectionMode]);

  // Persiste modo + IDs ao mudarem.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: selectionMode, ids: selectedIds }),
      );
    } catch {
      /* quota/SSR — ignora */
    }
  }, [selectionMode, selectedIds]);

  // Listener: botão "Excluir" no topo (rightSlot dos chips) dispara este evento.
  // ATENÇÃO: NÃO limpa a seleção aqui — o dialog de confirmação pode ser
  // cancelado pelo usuário e ele espera reencontrar os itens marcados.
  // A limpeza acontece apenas após `quotes:bulk-delete-confirmed`.
  useEffect(() => {
    const handler = () => {
      if (effectiveSelectedCount === 0) return;
      onBulkDelete([...effectiveSelectedIds]);
    };
    window.addEventListener('quotes:bulk-delete-request', handler);
    return () => window.removeEventListener('quotes:bulk-delete-request', handler);
  }, [effectiveSelectedCount, effectiveSelectedIds, onBulkDelete]);

  // Limpa a seleção visual apenas DEPOIS que a página confirma a exclusão.
  useEffect(() => {
    const handler = () => handleClearSelection();
    window.addEventListener('quotes:bulk-delete-confirmed', handler);
    return () => window.removeEventListener('quotes:bulk-delete-confirmed', handler);
  }, [handleClearSelection]);




  // ── Column state ──
  // Ordem das colunas é FIXA (sem DnD): definida em ALL_COLUMNS.
  const visibleColumns = ALL_COLUMNS;

  // Migração defensiva: limpa chaves legadas de visibilidade/ordem de colunas.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('quotes-hidden-columns');
      localStorage.removeItem('quotes-column-visibility');
      localStorage.removeItem('quotes:hidden-columns');
      localStorage.removeItem('quotes:column-order');
      sessionStorage.removeItem('quotes-hidden-columns');
    } catch {
      /* ignora */
    }
  }, []);

  const gridTemplate = useMemo(
    () =>
      [
        ...(selectionMode ? ['40px'] : []),
        ...visibleColumns.map((c) => c.width),
        '56px',
      ].join(' '),
    [visibleColumns, selectionMode],
  );


  // Reset page when pageSize changes
  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
    handleClearSelection();
  };

  const { data: logoByCnpj, isLoading: isLogosLoading } = useQuoteClientLogos(
    paginatedQuotes.map((q) => q.client_cnpj),
  );
  const { data: itemCountById, isLoading: isItemCountsLoading } = useQuoteItemCounts(
    paginatedQuotes.map((q) => q.id),
  );

  const renderCell = (quote: Quote, columnId: string) =>
    renderQuoteCell(
      quote,
      columnId,
      navigate,
      logoByCnpj,
      isLogosLoading,
      itemCountById,
      isItemCountsLoading,
    );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-2">

      {/* Dica visível apenas no modo Selecionar quando nenhum item está marcado */}

      {/* Banner "Selecionar todos das próximas páginas" — ações em massa ficam no topo (rightSlot dos chips) */}
      {showSelectAllBanner && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
          <span>Todos desta página estão selecionados.</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleSelectAllPages}>
            Selecionar todos os {quotes.length}
          </Button>
        </div>
      )}


      {/* Table */}
      <div className="min-h-0 max-h-[calc(8*64px+44px)] flex-1 overflow-x-auto overflow-y-auto rounded-lg border border-border">
        <div className="min-w-[1100px]">

        {/* Header */}
        <div
          className="sticky top-0 z-10 grid gap-5 border-b border-primary/80 bg-primary px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-primary-foreground/90"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {selectionMode && (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleToggleAll}
                aria-label="Selecionar todos da página"
                className="border-primary-foreground/50 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
              />
            </div>
          )}
          {visibleColumns.map((col) => (
            <div
              key={col.id}
              data-testid={`quotes-col-header-${col.id}`}
              className={cn(
                'select-none truncate',
                col.align === 'right' && 'text-right',
                col.align === 'center' && 'text-center',
              )}
            >
              {col.label}
            </div>
          ))}
          <span />
        </div>


        {/* Rows */}
        {paginatedQuotes.map((quote) => {
          const quoteId = quote.id;
          const selected = Boolean(quoteId && isSelected(quoteId)) || allPagesSelected;

          return (
            <div
              key={quoteId ?? quote.quote_number}
              className={cn(
                'group grid cursor-pointer items-center gap-5 border-b border-border/30 px-5 py-3.5 transition-colors duration-150 hover:bg-muted/30',
                selected && 'bg-primary/5',
              )}
              style={{ gridTemplateColumns: gridTemplate }}
              onClick={() => navigate(`/orcamentos/${quote.id}`)}
            >
              {selectionMode && (
                <div
                  className="flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selected}
                    disabled={!quoteId}
                    aria-label="Selecionar orçamento"
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
              )}
              {visibleColumns.map((col) => (
                <div
                  key={col.id}
                  className={cn(
                    'min-w-0',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                >
                  {col.id === 'client' ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="min-w-0 flex-1">{renderCell(quote, col.id)}</div>
                    </div>
                  ) : (
                    renderCell(quote, col.id)
                  )}
                </div>
              ))}
              <div className="flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                      aria-label={`Mais opções para o orçamento ${quote.quote_number ?? ''}`.trim()}
                      data-testid={`quote-row-more-${quote.id}`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>

                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} data-testid={`quote-row-menu-${quote.id}`}>
                    <DropdownMenuItem data-testid={`quote-row-menu-view-${quote.id}`} onClick={() => navigate(`/orcamentos/${quote.id}`)}>
                      <Eye className="mr-2 h-4 w-4" /> Visualizar
                    </DropdownMenuItem>
                    <DropdownMenuItem data-testid={`quote-row-menu-edit-${quote.id}`} onClick={() => navigate(`/orcamentos/${quote.id}/editar`)}>
                      <Edit className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid={`quote-row-menu-duplicate-${quote.id}`}
                      disabled={!quoteId}
                      onClick={() => quoteId && onDuplicate(quoteId)}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      data-testid={`quote-row-menu-delete-${quote.id}`}
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
      </div>


      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-2 py-2">
        <div className="text-sm text-muted-foreground">
          {quotes.length} resultado(s)
        </div>


      </div>
    </div>
  );
}
