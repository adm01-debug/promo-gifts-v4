import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  FileText,
  Plus,
  Search,
  ArrowUpDown,
  AlertTriangle,
  Info,
  CheckSquare,
  Trash2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageSEO } from '@/components/seo/PageSEO';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { EmptyState } from '@/components/common/EmptyState';
import { QuotesSkeleton } from '@/components/layout/SkeletonLoaders';
import { FadeInView, AnimatedCounter } from '@/components/common/MicroInteractions';
import { QuotesConfigurableList } from '@/components/quotes/QuotesConfigurableList';
import { QuotesStatusChips } from '@/components/quotes/QuotesStatusChips';

import { useQuotesListPage, sortOptions, type SortOption } from '@/pages/quotes/useQuotesListPage';
import type { QuoteStatus } from '@/types/quote';

export default function QuotesListPage() {
  const {
    navigate,
    quotes,
    isLoading,
    isFetching,
    error,
    fetchQuotes,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    deleteConfirmId,
    setDeleteConfirmId,
    isDeleting,
    bulkDeleteIds,
    setBulkDeleteIds,
    isBulkDeleting,
    bulkDeleteProgress,
    cancelBulkDelete,
    filteredQuotes,
    onlyPendingStatuses,
    handleDelete,
    handleBulkDelete,
    handleClearFilters,
    handleMarkApproved: _handleMarkApproved,
    handleDuplicateWithUndo,
    updateQuoteStatus,
  } = useQuotesListPage();

  // Listener: botão "Atualizar lista" no estado vazio do QuotesConfigurableList
  // dispara este evento — refetch silencioso + feedback discreto.
  useEffect(() => {
    const handler = async () => {
      const result = await fetchQuotes();
      if (result.isError) {
        toast.error('Não foi possível recarregar os orçamentos. Tente novamente.');
      } else {
        toast.success('Lista atualizada.');
      }
    };
    window.addEventListener('quotes:refresh-request', handler);
    return () => window.removeEventListener('quotes:refresh-request', handler);
  }, [fetchQuotes]);

  // Espelha modo de seleção + contagem emitidos por QuotesConfigurableList
  // para alternar o label/feedback visual do botão "Selecionar".
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ count?: number; mode?: boolean }>).detail;
      setSelectedCount(detail?.count ?? 0);
      if (typeof detail?.mode === 'boolean') setSelectionMode(detail.mode);
    };
    window.addEventListener('quotes:selection-changed', handler);
    return () => window.removeEventListener('quotes:selection-changed', handler);
  }, []);
  const hasSelection = selectionMode;

  if (isLoading) {
    return <QuotesSkeleton />;
  }

  const hasActiveFilters = !!searchTerm || statusFilter !== 'all';

  return (
    <>
      <PageSEO
        title="Orçamentos"
        description="Gerencie seus orçamentos. Crie, edite e acompanhe propostas comerciais."
        path="/orcamentos"
      />
      <TooltipProvider>
        <div className="mx-auto flex w-full max-w-[1920px] animate-fade-in flex-col gap-3 px-3 py-3 pb-6 sm:gap-4 sm:px-4 sm:py-4 lg:px-6 xl:px-8">
          {/* Header: título + filtros + ação no mesmo eixo */}
          <div className="flex flex-wrap items-center gap-3">
            <FadeInView>
              <div className="min-w-0 flex-shrink-0">
                <h1
                  data-testid="page-title-orcamentos"
                  className="flex items-center gap-2 whitespace-nowrap font-display text-xl font-bold text-foreground sm:text-2xl lg:text-3xl"
                >
                  <FileText className="h-7 w-7" />
                  Orçamentos
                </h1>
                <p className="mt-1 text-muted-foreground">
                  <AnimatedCounter value={filteredQuotes.length} /> orçamento(s) encontrado(s)
                </p>
              </div>
            </FadeInView>

            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-none sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[260px] lg:w-[320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  data-testid="quotes-search-input"
                  aria-label="Buscar orçamentos"
                  placeholder="Buscar por número, cliente ou empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger data-testid="quotes-sort-trigger" className="w-full sm:w-[170px]">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      data-testid={`quotes-sort-item-${opt.value}`}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="quote-new-button"
                    onClick={() => navigate('/orcamentos/novo')}
                    size="icon"
                    aria-label="Novo orçamento"
                    className="group relative h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-110 hover:shadow-xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-primary/40"
                    />
                    <Plus className="relative h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Criar novo orçamento em segundos</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Banner: somente status pending no dataset */}
          {onlyPendingStatuses && (
            <Alert
              data-testid="quotes-only-pending-banner"
              className="border-info/30 bg-info/10 text-info"
            >
              <Info className="h-4 w-4" />
              <AlertTitle>Todos os orçamentos estão em status Pendente</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                Avance o fluxo enviando ou aprovando orçamentos para popular o funil de vendas.
              </AlertDescription>
            </Alert>
          )}

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-destructive">
                  Módulo de orçamentos indisponível
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {/* Status chips */}
          <QuotesStatusChips
            quotes={quotes}
            value={statusFilter}
            onChange={setStatusFilter}
            rightSlot={
              <div className="flex items-center gap-2">
                {hasSelection && selectedCount > 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    data-testid="quotes-bulk-delete-top"
                    className="h-7 gap-1.5 rounded-full px-3 text-xs"
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent('quotes:bulk-delete-request'))
                    }
                    aria-label={`Excluir ${selectedCount} ${selectedCount === 1 ? 'orçamento selecionado' : 'orçamentos selecionados'}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Excluir ({selectedCount})
                  </Button>
                )}
                <Button
                  type="button"
                  variant={hasSelection ? 'default' : 'outline'}
                  size="sm"
                  data-testid="quotes-select-toggle"
                  data-selected={hasSelection ? 'true' : 'false'}
                  aria-pressed={hasSelection}
                  className="h-7 gap-1.5 rounded-full px-3 text-xs"
                  onClick={() => window.dispatchEvent(new CustomEvent('quotes:toggle-select-all'))}
                  aria-label={
                    hasSelection
                      ? `Cancelar seleção (${selectedCount} ${selectedCount === 1 ? 'orçamento' : 'orçamentos'})`
                      : 'Selecionar orçamentos visíveis'
                  }
                >
                  <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  {hasSelection
                    ? selectedCount > 0
                      ? `Cancelar seleção (${selectedCount})`
                      : 'Cancelar seleção'
                    : 'Selecionar'}
                </Button>
              </div>
            }
          />

          {/* Quotes List */}
          <div className="flex min-h-0 flex-1 flex-col">
            {filteredQuotes.length === 0 ? (
              <EmptyState
                variant="quotes"
                title={
                  sortBy === 'expiring'
                    ? 'Nenhum orçamento próximo do vencimento'
                    : hasActiveFilters
                      ? 'Nenhum resultado para esses filtros'
                      : 'Nenhum orçamento encontrado'
                }
                description={
                  sortBy === 'expiring'
                    ? 'Orçamentos já expirados ou sem data de validade não aparecem neste filtro. Troque o ordenamento para ver todos.'
                    : hasActiveFilters
                      ? 'Ajuste a busca ou os chips de status, ou limpe todos os filtros.'
                      : 'Crie seu primeiro orçamento e comece a vender.'
                }
                action={
                  sortBy === 'expiring'
                    ? { label: 'Ver todos (mais recentes)', onClick: () => setSortBy('newest') }
                    : hasActiveFilters
                      ? { label: 'Limpar filtros', onClick: handleClearFilters }
                      : { label: 'Criar Orçamento', onClick: () => navigate('/orcamentos/novo') }
                }
              />
            ) : (
              <QuotesConfigurableList
                quotes={filteredQuotes}
                isFetching={isFetching}
                loadError={error}
                onRetry={() => {
                  void fetchQuotes();
                }}
                onDelete={(id) => setDeleteConfirmId(id)}
                onBulkDelete={(ids) => setBulkDeleteIds(ids)}
                onBulkStatusChange={async (ids, status) => {
                  let successCount = 0;
                  for (const id of ids) {
                    const ok = await updateQuoteStatus(id, status as QuoteStatus);
                    if (ok) successCount++;
                  }
                  toast.success(`${successCount} orçamento(s) atualizado(s)`);
                  if (status === 'approved' && successCount > 0) {
                    confetti({
                      particleCount: 80,
                      spread: 60,
                      origin: { y: 0.7 },
                      colors: ['hsl(25,100%,50%)', 'hsl(142,71%,45%)', 'hsl(217,91%,60%)'],
                    });
                  }
                }}
                onBulkExport={(ids) => {
                  const selected = filteredQuotes.filter((q) => q.id && ids.includes(q.id));
                  import('@/utils/excelExport').then(({ exportToExcel }) => {
                    exportToExcel({
                      filename: 'orcamentos_selecionados',
                      columns: [
                        { key: 'Número', header: 'Número' },
                        { key: 'Empresa', header: 'Empresa' },
                        { key: 'Contato', header: 'Contato' },
                        { key: 'Status', header: 'Status' },
                        { key: 'Valor', header: 'Valor' },
                        { key: 'Data', header: 'Data' },
                      ],
                      data: selected.map((q) => ({
                        Número: q.quote_number,
                        Empresa: q.client_company || '',
                        Contato: q.client_name || '',
                        Status: q.status,
                        Valor: q.total || 0,
                        Data: q.created_at ? format(new Date(q.created_at), 'dd/MM/yyyy') : '',
                      })),
                    });
                    toast.success(`${ids.length} orçamento(s) exportado(s)`);
                  });
                }}
                onDuplicate={(id) => handleDuplicateWithUndo(id)}
              />
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={!!deleteConfirmId}
          onOpenChange={(o) => {
            // Bloqueia fechamento durante exclusão para evitar perda de feedback.
            if (isDeleting) return;
            if (!o) setDeleteConfirmId(null);
          }}
          variant="destructive"
          title="Excluir orçamento?"
          description="Esta ação não pode ser desfeita. O orçamento será removido permanentemente."
          confirmLabel="Confirmar exclusão"
          confirmLabelShort="Excluir"
          cancelLabel="Cancelar"
          onConfirm={handleDelete}
          loading={isDeleting}
          testId="quote-list-delete-dialog"
        />

        {/* Bulk Delete Dialog — preview de IDs, loading com progresso, cancelar preserva seleção */}
        <AlertDialog
          open={bulkDeleteIds.length > 0}
          onOpenChange={(open) => {
            // Bloqueia fechamento durante exclusão para evitar perda de feedback.
            if (isBulkDeleting) return;
            // "Fechar" no overlay/ESC é tratado como cancelar (preserva seleção).
            if (!open) cancelBulkDelete();
          }}
        >
          <AlertDialogContent
            className="w-[92vw] !max-w-[345px] gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl backdrop-blur-xl"
            data-testid="quotes-bulk-delete-dialog"
          >
            <div
              aria-hidden="true"
              className="h-[3px] w-full bg-gradient-to-r from-transparent via-destructive to-transparent"
            />
            <div className="px-4 pb-1.5 pt-4">
              <AlertDialogHeader>
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-xl bg-destructive/30 opacity-60 blur-lg"
                    />
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-inset ring-destructive/20">
                      <Trash2 className="h-[18px] w-[18px] text-destructive" strokeWidth={2.2} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                    <AlertDialogTitle className="text-sm font-semibold leading-tight tracking-tight text-foreground">
                      {isBulkDeleting
                        ? `Excluindo ${bulkDeleteProgress.done}/${bulkDeleteProgress.total}…`
                        : `Excluir ${bulkDeleteIds.length} orçamento${bulkDeleteIds.length === 1 ? '' : 's'}?`}
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                        {isBulkDeleting ? (
                          <>
                            <p>Aguarde — não feche esta janela.</p>
                            <div
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={bulkDeleteProgress.total}
                              aria-valuenow={bulkDeleteProgress.done}
                              data-testid="quotes-bulk-delete-progress"
                              className="h-2 w-full overflow-hidden rounded-full bg-muted"
                            >
                              <div
                                className="h-full bg-destructive transition-all"
                                style={{
                                  width: `${
                                    bulkDeleteProgress.total > 0
                                      ? Math.round(
                                          (bulkDeleteProgress.done / bulkDeleteProgress.total) *
                                            100,
                                        )
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <p>
                              {bulkDeleteIds.length === 1
                                ? 'O orçamento será removido — você pode desfazer por até 8 segundos após a confirmação.'
                                : 'Os orçamentos serão removidos — você pode desfazer por até 8 segundos após a confirmação.'}
                            </p>
                            {(() => {
                              const preview = filteredQuotes
                                .filter((q) => q.id && bulkDeleteIds.includes(q.id))
                                .map((q) => q.quote_number)
                                .filter(Boolean);
                              if (preview.length === 0) return null;
                              const shown = preview.slice(0, 5);
                              const extra = preview.length - shown.length;
                              return (
                                <div
                                  data-testid="quotes-bulk-delete-preview"
                                  className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px]"
                                >
                                  <p className="mb-1 font-medium text-foreground">
                                    Identificadores:
                                  </p>
                                  <p className="text-muted-foreground">
                                    {shown.join(', ')}
                                    {extra > 0 ? ` e mais ${extra}` : ''}
                                  </p>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </div>
                </div>
              </AlertDialogHeader>
            </div>
            <div className="mt-3 border-t border-border/50 bg-muted/20 px-4 py-2.5">
              <AlertDialogFooter className="gap-1.5 sm:gap-1.5">
                <AlertDialogCancel
                  disabled={isBulkDeleting}
                  onClick={cancelBulkDelete}
                  className="mt-0 h-[26px] min-h-[26px] rounded-md border-border/70 bg-transparent px-3 py-0 text-xs"
                >
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  data-testid="quotes-bulk-delete-confirm"
                  disabled={isBulkDeleting}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleBulkDelete();
                  }}
                  className="inline-flex h-[26px] min-h-[26px] items-center rounded-md bg-destructive px-3.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                >
                  {isBulkDeleting
                    ? `Excluindo… (${bulkDeleteProgress.done}/${bulkDeleteProgress.total})`
                    : `Excluir ${bulkDeleteIds.length}`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </>
  );
}
