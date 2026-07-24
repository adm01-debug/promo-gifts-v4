/**
 * QuotesConfigurableList - Lista de orçamentos com colunas fixas, paginação e seleção em massa.
 */

import { useState, useMemo, useCallback, useEffect, useRef, type HTMLAttributes } from 'react';
import { renderQuoteCell } from './QuoteListCellRenderer';
import { useQuoteClientLogos } from '@/hooks/quotes/useQuoteClientLogos';
import { useQuoteItemCounts } from '@/hooks/quotes/useQuoteItemCounts';
import { useNavigate } from 'react-router-dom';
import { usePrefetchOnHover } from '@/hooks/common/usePrefetchOnHover';
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
  Inbox,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import type { Quote } from '@/hooks/quotes';

import { useBulkSelection } from '@/hooks/common';

import { cn } from '@/lib/utils';
import {
  QUOTES_ROW_H,
  QUOTES_MIN_VISIBLE_ROWS,
  QUOTES_MAX_VISIBLE_ROWS,
  QUOTES_CHROME_BY_BREAKPOINT,
} from '@/lib/quotes/quotesLayout';

// ── Prefetch do bundle do QuoteBuilder/QuoteView ──
// Dispara em hover/focus/touch de uma linha para eliminar o "flash" do lazy
// chunk quando o usuário clicar. Idempotente — dynamic import resolve uma vez
// e o resultado fica cacheado pelo browser + Vite.
function prefetchQuoteRoutes(): void {
  void import('@/pages/quotes/QuoteViewPage');
  void import('@/pages/quotes/QuoteBuilderPage');
}

/** Wrapper que aplica `usePrefetchOnHover` no <div> da linha do orçamento. */
interface PrefetchRowProps extends HTMLAttributes<HTMLDivElement> {
  prefetch: () => void;
}
function PrefetchRow({ prefetch, children, ...rest }: PrefetchRowProps) {
  const handlers = usePrefetchOnHover(prefetch);
  return (
    <div {...rest} {...handlers}>
      {children}
    </div>
  );
}

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
  { id: 'delivery', label: 'Entrega', width: '90px' },
  { id: 'items', label: 'Itens', width: '80px', align: 'center' },
  { id: 'value', label: 'Valor', width: '140px' },
  { id: 'status', label: 'Status', width: '150px' },
  { id: 'expiration', label: 'Expiração', width: '110px', align: 'center' },
  { id: 'quote_number', label: 'Nº Orçamento', width: '120px' },
];

// ── Props ──
interface QuotesConfigurableListProps {
  quotes: Quote[];
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkStatusChange?: (ids: string[], status: string) => void;
  onBulkExport?: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  /** Background refetch em andamento — usado para "Carregando mais..." */
  isFetching?: boolean;
  /** Mensagem de erro vinda do hook pai; renderiza banner com retry */
  loadError?: string | null;
  /** Callback do botão "Tentar novamente" */
  onRetry?: () => void;
}

const PAGE_SIZE = 25;

export function QuotesConfigurableList({
  quotes,
  onDelete,
  onBulkDelete,
  onBulkStatusChange: _onBulkStatusChange,
  onBulkExport: _onBulkExport,
  onDuplicate,
  isFetching = false,
  loadError = null,
  onRetry,
}: QuotesConfigurableListProps) {
  const navigate = useNavigate();

  // ── Infinite scroll via IntersectionObserver ──
  // Sentinel logo após a última linha; quando entra no viewport do container,
  // incrementamos `visibleCount`. Substitui o handler de scroll (mais eficiente
  // pois o browser despacha apenas em mudanças de intersecção).
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Identidade da lista (referência) — usada para resetar quando o array
  // mudar (filtro/busca/ordenação produzem novo array do hook pai).
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [quotes]);

  // Dedup defensivo por id — garante que combinar páginas nunca cause
  // chaves duplicadas no React mesmo se o backend devolver repetidos.
  const uniqueQuotes = useMemo(() => {
    const seen = new Set<string>();
    const out: Quote[] = [];
    for (const q of quotes) {
      const key = q.id ?? q.quote_number ?? '';
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
    return out;
  }, [quotes]);

  const paginatedQuotes = useMemo(
    () => uniqueQuotes.slice(0, visibleCount),
    [uniqueQuotes, visibleCount],
  );

  const hasMore = paginatedQuotes.length < uniqueQuotes.length;

  // IntersectionObserver: dispara quando o sentinel encosta no viewport
  // do container scrollável. `rootMargin` antecipa em 200px o gatilho.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisibleCount((c) =>
            c < uniqueQuotes.length ? Math.min(c + PAGE_SIZE, uniqueQuotes.length) : c,
          );
        }
      },
      { root, rootMargin: '200px 0px', threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [uniqueQuotes.length, hasMore]);

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
      [...(selectionMode ? ['40px'] : []), ...visibleColumns.map((c) => c.width), '56px'].join(' '),
    [visibleColumns, selectionMode],
  );

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
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={handleSelectAllPages}
          >
            Selecionar todos os {quotes.length}
          </Button>
        </div>
      )}

      {/* Table */}
      <div
        data-testid="quotes-table-shell"
        className="overflow-hidden rounded-lg border border-border"
      >
        <div data-testid="quotes-table-hscroll" className="overflow-x-auto overflow-y-hidden">
          <div className="w-max min-w-[1100px]" style={{ minWidth: 'max(100%, 1100px)' }}>
            {/* Header — fica fora do scroll vertical (sticky efetivo) */}
            <div
              data-testid="quotes-table-banner"
              className="grid gap-5 overflow-hidden border-b border-primary/80 bg-primary px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-primary-foreground/90"
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
                  data-col-id={col.id}
                  role="columnheader"
                  aria-label={`Coluna ${col.label}`}
                  className={cn(
                    'select-none truncate',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.id === 'items' && 'pr-4',
                  )}
                >
                  {col.label}
                </div>
              ))}
              <span />
            </div>

            <div
              ref={scrollRef}
              data-testid="quotes-scroll-container"
              style={{
                // SSOT: src/lib/quotes/quotesLayout.ts
                ['--quotes-row-h' as string]: `${QUOTES_ROW_H}px`,
                maxHeight: `min(calc(100dvh - var(--quotes-chrome-h, ${QUOTES_CHROME_BY_BREAKPOINT.desktop}px)), calc(${QUOTES_MAX_VISIBLE_ROWS} * var(--quotes-row-h)))`,
                minHeight: `calc(${QUOTES_MIN_VISIBLE_ROWS} * var(--quotes-row-h))`,
              }}
              // Classes literais (Tailwind JIT só detecta strings estáticas) —
              // valores em sync com QUOTES_CHROME_BY_BREAKPOINT na SSOT.
              className="overflow-y-auto [--quotes-chrome-h:420px] sm:[--quotes-chrome-h:360px] lg:[--quotes-chrome-h:320px]"
            >
              {/* Empty state */}

              {uniqueQuotes.length === 0 ? (
                <div
                  data-testid="quotes-empty-state"
                  className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
                >
                  <Inbox className="h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Nenhum orçamento por aqui</p>
                    <p className="text-xs text-muted-foreground">
                      Ajuste os filtros ou atualize a lista para sincronizar com o servidor.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="quotes-empty-refresh"
                    onClick={() => window.dispatchEvent(new CustomEvent('quotes:refresh-request'))}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    Atualizar lista
                  </Button>
                </div>
              ) : (
                paginatedQuotes.map((quote) => {
                  const quoteId = quote.id;
                  const selected = Boolean(quoteId && isSelected(quoteId)) || allPagesSelected;

                  return (
                    <PrefetchRow
                      key={quoteId ?? quote.quote_number}
                      prefetch={prefetchQuoteRoutes}
                      data-testid={quoteId ? `quote-row-${quoteId}` : undefined}
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
                          data-testid={`quotes-col-cell-${col.id}`}
                          data-col-id={col.id}
                          role="cell"
                          aria-label={col.label}
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

                          {/* Largura 6.8rem: minimo a prova de corte de "Visualizar" sob focus:font-bold incl. fallback system-ui/FOUT. NAO reduzir p/ 6.4rem (reforcado em src/index.css). */}

                          <DropdownMenuContent
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`quote-row-menu-${quote.id}`}
                            className="w-[6.8rem] !min-w-0 max-w-[calc(100vw-1rem)] p-1 [&_[role=menuitem]]:whitespace-nowrap [&_[role=menuitem]]:px-1.5 [&_[role=menuitem]]:text-[0.8rem] [&_[role=menuitem]_svg]:mr-1.5 [&_[role=menuitem]_svg]:h-3.5 [&_[role=menuitem]_svg]:w-3.5"
                          >
                            <DropdownMenuItem
                              data-testid={`quote-row-menu-view-${quote.id}`}
                              onClick={() => navigate(`/orcamentos/${quote.id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" /> Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              data-testid={`quote-row-menu-edit-${quote.id}`}
                              onClick={() => navigate(`/orcamentos/${quote.id}/editar`)}
                            >
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
                    </PrefetchRow>
                  );
                })
              )}

              {/* Sentinel para IntersectionObserver — invisível, mas observável */}
              {hasMore && (
                <div
                  ref={sentinelRef}
                  data-testid="quotes-infinite-sentinel"
                  aria-hidden="true"
                  className="h-4 w-full"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer: contagem, loading mais, erro com retry */}
      <div className="flex items-center justify-between gap-3 px-2 py-2">
        <div className="text-sm text-muted-foreground" data-testid="quotes-footer-count">
          {uniqueQuotes.length === 0
            ? 'Nenhum resultado'
            : hasMore
              ? `Exibindo ${paginatedQuotes.length} de ${uniqueQuotes.length} — role para carregar mais`
              : null}
        </div>

        {/* Indicador de "carregando mais" durante refetch em background */}
        {isFetching && uniqueQuotes.length > 0 && !loadError && (
          <div
            data-testid="quotes-footer-loading-more"
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Carregando mais…
          </div>
        )}

        {/* Erro de carregamento com botão de retry */}
        {loadError && (
          <div
            data-testid="quotes-footer-load-error"
            className="flex items-center gap-2 text-xs text-destructive"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Falha ao carregar.</span>
            {onRetry && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                data-testid="quotes-footer-retry"
                onClick={onRetry}
              >
                Tentar novamente
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
