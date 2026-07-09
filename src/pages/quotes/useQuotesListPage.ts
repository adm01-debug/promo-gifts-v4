import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { showUndoToast } from '@/utils/undoToast';
import confetti from 'canvas-confetti';
import Fuse from 'fuse.js';
import { useQuotes, type Quote, type QuoteItem } from '@/hooks/quotes';
import { QUOTE_CHIP_MATCHERS } from '@/components/quotes/QuotesStatusChips';
import { useDebounce } from '@/hooks/common/useDebounce';

export type SortOption = 'expiring' | 'highest' | 'lowest' | 'newest' | 'oldest';

export const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'highest', label: 'Maior valor' },
  { value: 'lowest', label: 'Menor valor' },
  { value: 'expiring', label: 'Vencimento próximo' },
];

export function useQuotesListPage() {
  const navigate = useNavigate();
  const {
    quotes,
    isLoading,
    isFetching,
    error,
    deleteQuote,
    duplicateQuote,
    updateQuoteStatus,
    createQuote,
    fetchQuote,
    fetchQuotes,
  } = useQuotes();

  // Persistência de filtros/ordenação/busca na URL (query string).
  // A URL é a fonte da verdade — permite compartilhar deep-links, sobrevive a
  // reload e mantém histórico do navegador consistente. A busca (`q`) mantém
  // estado local para digitação fluida e sincroniza para a URL via debounce.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') ?? 'all';
  const urlSort = (searchParams.get('sort') as SortOption) ?? 'newest';
  const urlQuery = searchParams.get('q') ?? '';

  const [searchTerm, setSearchTerm] = useState(urlQuery);
  const debouncedSearch = useDebounce(searchTerm, 250);
  const statusFilter = urlStatus;
  const sortBy = urlSort;

  const updateSearchParam = useCallback(
    (key: string, value: string, defaultValue: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === defaultValue) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setStatusFilter = useCallback(
    (v: string) => updateSearchParam('status', v, 'all'),
    [updateSearchParam],
  );
  const setSortBy = useCallback(
    (v: SortOption) => updateSearchParam('sort', v, 'newest'),
    [updateSearchParam],
  );

  // Sincroniza busca (debounced) → URL.
  useEffect(() => {
    updateSearchParam('q', debouncedSearch, '');
  }, [debouncedSearch, updateSearchParam]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ done: number; total: number }>(
    { done: 0, total: 0 },
  );

  // Search
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
    });
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    let results = quotes;

    if (debouncedSearch && debouncedSearch.length >= 2) {
      const fuseResults = quoteFuse.search(debouncedSearch);
      results = fuseResults.map((r) => r.item);
    }

    if (statusFilter !== 'all') {
      const matcher = QUOTE_CHIP_MATCHERS[statusFilter];
      if (matcher) {
        results = results.filter(matcher);
      } else {
        // Fallback defensivo p/ filtros legados salvos em localStorage.
        results = results.filter((quote) => quote.status === statusFilter);
      }
    }

    // Sort "Vencimento próximo" implica filtrar fora os já expirados:
    // só faz sentido listar orçamentos que ainda PODEM vencer em breve.
    if (sortBy === 'expiring') {
      const now = Date.now();
      results = results.filter((q) => {
        if (q.status === 'expired') return false;
        if (!q.valid_until) return false; // sem data não há "vencimento próximo"
        const t = new Date(q.valid_until).getTime();
        return Number.isFinite(t) && t >= now;
      });
    }

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

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteQuote(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  /**
   * Exclusão em lote com:
   *  - snapshot pré-delete (para suportar "Desfazer" via toast por 8s);
   *  - progresso done/total (UI mostra feedback enquanto roda);
   *  - tolerância a falhas parciais (cada delete é independente);
   *  - se TUDO falhar, mantém `bulkDeleteIds` e seleção visual (não emite
   *    `quotes:bulk-delete-confirmed`) para o usuário tentar de novo;
   *  - se ≥1 sucesso, emite `quotes:bulk-delete-confirmed` que limpa a
   *    seleção visual no QuotesConfigurableList.
   */
  const handleBulkDelete = useCallback(async () => {
    const ids = [...bulkDeleteIds];
    if (ids.length === 0) return;

    setIsBulkDeleting(true);
    setBulkDeleteProgress({ done: 0, total: ids.length });

    // 1) snapshot completo (quote + items) ANTES do delete — necessário p/ Desfazer.
    const snapshots: Quote[] = [];
    for (const id of ids) {
      try {
        const full = await fetchQuote(id);
        if (full) snapshots.push(full);
      } catch {
        /* segue mesmo sem snapshot daquele id — undo só vai conseguir restaurar o que pegou */
      }
    }

    // 2) delete sequencial com contagem.
    const failed: string[] = [];
    let done = 0;
    for (const id of ids) {
      const ok = await deleteQuote(id);
      done += 1;
      setBulkDeleteProgress({ done, total: ids.length });
      if (!ok) failed.push(id);
    }

    setIsBulkDeleting(false);
    const successCount = ids.length - failed.length;

    if (successCount === 0) {
      // Tudo falhou: preserva bulkDeleteIds e seleção visual para retry.
      toast.error(
        `Não foi possível excluir os ${ids.length} orçamentos. Tente novamente.`,
      );
      setBulkDeleteProgress({ done: 0, total: 0 });
      return;
    }

    // Limpa estado de confirmação + libera seleção visual.
    setBulkDeleteIds([]);
    setBulkDeleteProgress({ done: 0, total: 0 });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('quotes:bulk-delete-confirmed'));
    }

    if (failed.length > 0) {
      toast.warning(
        `${successCount} excluído(s), ${failed.length} falhou(aram). Tente novamente para os pendentes.`,
      );
    }

    // 3) toast com "Desfazer" — restaura via createQuote.
    const restorable = snapshots.filter((s) => !failed.includes(s.id ?? ''));
    if (restorable.length === 0) return;

    showUndoToast({
      title: `${successCount} orçamento(s) excluído(s)`,
      description: 'Você pode desfazer esta ação.',
      duration: 8000,
      onUndo: async () => {
        let restored = 0;
        for (const snap of restorable) {
          try {
            const items: QuoteItem[] = (snap.items ?? []).map((it) => ({
              ...it,
            })) as QuoteItem[];
            // remove campos gerados para evitar conflito de PK/timestamps no INSERT
            const { id: _omitId, created_at: _c, updated_at: _u, quote_number: _qn, ...rest } =
              snap as Quote & { id?: string };
            void _omitId; void _c; void _u; void _qn;
            const created = await createQuote(rest as Partial<Quote>, items);
            if (created) restored += 1;
          } catch {
            /* segue restaurando os demais */
          }
        }
        if (restored === restorable.length) {
          toast.success(`${restored} orçamento(s) restaurado(s).`);
        } else if (restored > 0) {
          toast.warning(
            `${restored}/${restorable.length} orçamentos restaurados. Alguns não puderam ser recriados.`,
          );
        } else {
          toast.error('Não foi possível restaurar os orçamentos.');
        }
      },
    });
  }, [bulkDeleteIds, deleteQuote, fetchQuote, createQuote]);

  /** Fecha o dialog SEM limpar a seleção visual — atende ao requisito do PO. */
  const cancelBulkDelete = useCallback(() => {
    setBulkDeleteIds([]);
  }, []);


  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('newest');
  };

  const handleMarkApproved = async (id: string) => {
    const ok = await updateQuoteStatus(id, 'approved');
    if (ok) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['hsl(25,100%,50%)', 'hsl(142,71%,45%)', 'hsl(217,91%,60%)'],
      });
    }
  };

  /**
   * True quando todos os orçamentos visíveis estão em `pending` — usado pela
   * página para exibir banner orientando o usuário a avançar o fluxo (evita
   * ilusão de "funil vazio" quando o banco só tem status inicial).
   */
  const onlyPendingStatuses = useMemo(
    () => quotes.length > 0 && quotes.every((q) => q.status === 'pending'),
    [quotes],
  );

  return {
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
    handleMarkApproved,
    duplicateQuote,
    updateQuoteStatus,
  };
}
