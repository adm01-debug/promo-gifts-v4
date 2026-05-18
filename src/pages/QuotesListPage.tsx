import { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageSEO } from '@/components/seo/PageSEO';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Loader2,
} from 'lucide-react';
import { useQuotes } from '@/hooks/useQuotes';
import Fuse from 'fuse.js';
import { format } from 'date-fns';
// DynamicBreadcrumbs removido: o MainLayout já renderiza PersistentBreadcrumbs sticky.
import { EmptyState } from '@/components/common/EmptyState';
import { QuoteCardSkeleton } from '@/components/common/ContextualSkeleton';
import { FadeInView, AnimatedCounter } from '@/components/common/MicroInteractions';
import { QuotesConfigurableList } from '@/components/quotes/QuotesConfigurableList';
import { QuotesStatusChips } from '@/components/quotes/QuotesStatusChips';
import { QuotesFunnelChart } from '@/components/quotes/QuotesFunnelChart';
import { useQuoteFunnel } from '@/hooks/useQuoteFunnel';

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest' | 'expiring';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'highest', label: 'Maior valor' },
  { value: 'lowest', label: 'Menor valor' },
  { value: 'expiring', label: 'Vencimento próximo' },
];

export default function QuotesListPage() {
  const navigate = useNavigate();
  const { quotes, isLoading, error, deleteQuote, duplicateQuote, updateQuoteStatus } = useQuotes();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const total = quotes.length;
    const approved = quotes.filter((q) => q.status === 'approved').length;
    const pending = quotes.filter((q) => ['pending', 'sent'].includes(q.status)).length;
    const totalValue = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
    const approvedValue = quotes
      .filter((q) => q.status === 'approved')
      .reduce((sum, q) => sum + (q.total || 0), 0);
    const conversionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, approved, pending, totalValue, approvedValue, conversionRate };
  }, [quotes]);

  // ── Funil + ciclo médio ──
  const _allQuoteIds = useMemo(() => quotes.map((q) => q.id!).filter(Boolean), [quotes]);
  const funnelData = useQuoteFunnel(quotes, {});

  // ── Fuse.js fuzzy search ──
  const quoteFuse = useMemo(() => {
    return new Fuse(quotes, {
      keys: [
        { name: 'quote_number', weight: 0.4 },
        { name: 'client_name', weight: 0.3 },
        { name: 'client_company', weight: 0.2 },
        { name: 'notes', weight: 0.1 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    let results = quotes;

    if (searchTerm && searchTerm.length >= 2) {
      const fuseResults = quoteFuse.search(searchTerm);
      results = fuseResults.map((r) => r.item);
    }

    if (statusFilter !== 'all') {
      results = results.filter((quote) => quote.status === statusFilter);
    }

    // Sort
    results = [...results].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'oldest':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        case 'highest':
          return (b.total || 0) - (a.total || 0);
        case 'lowest':
          return (a.total || 0) - (b.total || 0);
        case 'expiring': {
          const aDate = a.valid_until ? new Date(a.valid_until).getTime() : Infinity;
          const bDate = b.valid_until ? new Date(b.valid_until).getTime() : Infinity;
          return aDate - bDate;
        }
        default:
          return 0;
      }
    });

    return results;
  }, [quotes, searchTerm, statusFilter, quoteFuse, sortBy]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteQuote(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleBulkDelete = async () => {
    for (const id of bulkDeleteIds) {
      await deleteQuote(id);
    }
    setBulkDeleteIds([]);
  };

  if (isLoading) {
    return (
        <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-3 py-3 pb-24 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
          {/* Breadcrumb global vem do MainLayout (sticky) — não duplicar aqui. */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground lg:text-3xl">
                <FileText className="h-7 w-7" />
                Orçamentos
              </h1>
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando orçamentos…
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <QuoteCardSkeleton key={i} />
            ))}
          </div>
        </div>
    );
  }

  const hasActiveFilters = !!searchTerm || statusFilter !== 'all';
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('newest');
  };

  return (
      <>
        <PageSEO
          title="Orçamentos"
          description="Gerencie seus orçamentos. Crie, edite e acompanhe propostas comerciais."
          path="/orcamentos"
        />
        <TooltipProvider>
          <div className="space-y-5">
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => navigate('/orcamentos/templates')}>
                      <BookTemplate className="mr-2 h-4 w-4" />
                      Templates
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Modelos pré-configurados para agilizar orçamentos</p>
                  </TooltipContent>
                </Tooltip>
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
                      const ok = await updateQuoteStatus(id, status as string);
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
                    const selected = filteredQuotes.filter((q) => ids.includes(q.id!));
                    import('@/utils/excelExport').then(({ exportToExcel }) => {
                      exportToExcel(
                        selected.map((q) => ({
                          Número: q.quote_number,
                          Empresa: q.client_company || '',
                          Contato: q.client_name || '',
                          Status: q.status,
                          Valor: q.total || 0,
                          Data: q.created_at ? format(new Date(q.created_at), 'dd/MM/yyyy') : '',
                        })),
                        'orcamentos_selecionados',
                      );
                      toast.success(`${ids.length} orçamento(s) exportado(s)`);
                    });
                  }}
                  onDuplicate={(id) => duplicateQuote(id)}
                  onMarkApproved={async (id) => {
                    const ok = await updateQuoteStatus(id, 'approved');
                    if (ok) {
                      confetti({
                        particleCount: 80,
                        spread: 60,
                        origin: { y: 0.7 },
                        colors: ['hsl(25,100%,50%)', 'hsl(142,71%,45%)', 'hsl(217,91%,60%)'],
                      });
                    }
                  }}
                />
              )}
            </ScrollArea>
          </div>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Bulk Delete Confirmation Dialog */}
          <AlertDialog open={bulkDeleteIds.length > 0} onOpenChange={() => setBulkDeleteIds([])}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão em Massa</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{bulkDeleteIds.length}</strong> orçamento(s)?
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDelete}
                  className="bg-destructive text-destructive-foreground"
                >
                  Excluir {bulkDeleteIds.length} orçamento(s)
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TooltipProvider>
      </>
  );
}
