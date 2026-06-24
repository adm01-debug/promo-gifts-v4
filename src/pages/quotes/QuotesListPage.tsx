import { format } from 'date-fns';
import {
  FileText,
  Plus,
  Search,
  BookTemplate,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { EmptyState } from '@/components/common/EmptyState';
import { QuotesSkeleton } from '@/components/layout/SkeletonLoaders';
import { FadeInView, AnimatedCounter } from '@/components/common/MicroInteractions';
import { QuotesConfigurableList } from '@/components/quotes/QuotesConfigurableList';
import { QuotesStatusChips } from '@/components/quotes/QuotesStatusChips';
import { QuotesFunnelChart } from '@/components/quotes/QuotesFunnelChart';
import { useQuotesListPage, sortOptions, type SortOption } from '@/pages/quotes/useQuotesListPage';
import type { QuoteStatus } from '@/types/quote';

export default function QuotesListPage() {
  const {
    navigate,
    quotes,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    deleteConfirmId,
    setDeleteConfirmId,
    bulkDeleteIds,
    setBulkDeleteIds,
    kpis,
    funnelData,
    filteredQuotes,
    handleDelete,
    handleBulkDelete,
    handleClearFilters,
    handleMarkApproved,
    duplicateQuote,
    updateQuoteStatus,
  } = useQuotesListPage();

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
        <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <FadeInView>
              <div>
                <h1
                  data-testid="page-title-orcamentos"
                  className="flex items-center gap-2 font-display text-2xl font-bold text-foreground lg:text-3xl"
                >
                  <FileText className="h-7 w-7" />
                  Orçamentos
                </h1>
                <p className="mt-1 text-muted-foreground">
                  <AnimatedCounter value={filteredQuotes.length} /> orçamento(s) encontrado(s)
                </p>
              </div>
            </FadeInView>
            <div className="flex gap-2">
              <Button data-testid="quote-new-button" onClick={() => navigate('/orcamentos/novo')}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Orçamento
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-md sm:col-span-2 md:col-span-1">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/30">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total em Aberto</p>
                  <p className="truncate font-display text-lg font-extrabold text-foreground">
                    {formatCurrency(kpis.totalValue)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/15">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Aprovados</p>
                  <p className="text-sm font-bold text-foreground">
                    {kpis.approved}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({formatCurrency(kpis.approvedValue)})
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/15">
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="text-sm font-bold text-foreground">{kpis.pending}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info/15">
                  <TrendingUp className="h-4 w-4 text-info" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Conversão</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-foreground">{kpis.conversionRate}%</p>
                    {Number(kpis.conversionRate) >= 20 ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-success">
                        <TrendingUp className="h-3 w-3" /> Bom
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-warning">
                        <TrendingDown className="h-3 w-3" /> Baixa
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Funil de vendas */}
          {quotes.length > 0 && <QuotesFunnelChart data={funnelData} />}

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

          {/* Filters + Sort */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, cliente ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status chips */}
          <QuotesStatusChips quotes={quotes} value={statusFilter} onChange={setStatusFilter} />

          {/* Quotes List */}
          <ScrollArea className="h-[calc(100vh-360px)] min-h-[400px]">
            {filteredQuotes.length === 0 ? (
              <EmptyState
                variant="quotes"
                title={
                  hasActiveFilters
                    ? 'Nenhum resultado para esses filtros'
                    : 'Nenhum orçamento encontrado'
                }
                description={
                  hasActiveFilters
                    ? 'Ajuste a busca ou os chips de status, ou limpe todos os filtros.'
                    : 'Crie seu primeiro orçamento e comece a vender.'
                }
                action={
                  hasActiveFilters
                    ? { label: 'Limpar filtros', onClick: handleClearFilters }
                    : { label: 'Criar Orçamento', onClick: () => navigate('/orcamentos/novo') }
                }
              />
            ) : (
              <QuotesConfigurableList
                quotes={filteredQuotes}
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
                onDuplicate={(id) => duplicateQuote(id)}
                onMarkApproved={(id) => handleMarkApproved(id)}
              />
            )}
          </ScrollArea>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O orçamento será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmar Exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Dialog */}
        <AlertDialog open={bulkDeleteIds.length > 0} onOpenChange={() => setBulkDeleteIds([])}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {bulkDeleteIds.length} orçamentos?</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a excluir vários orçamentos de uma vez. Esta ação é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir Todos
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </>
  );
}
