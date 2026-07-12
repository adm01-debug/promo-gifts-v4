import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { showUndoToast } from '@/utils/undoToast';
import confetti from 'canvas-confetti';
import Fuse from 'fuse.js';
import { useQuotes, type Quote, type QuoteItem } from '@/hooks/quotes';
import { QUOTE_CHIP_MATCHERS } from '@/components/quotes/QuotesStatusChips';
import { useListUrlState } from '@/hooks/common/useListUrlState';

export type SortOption = 'expiring' | 'highest' | 'lowest' | 'newest' | 'oldest';

export const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'highest', label: 'Maior valor' },
  { value: 'lowest', label: 'Menor valor' },
  { value: 'expiring', label: 'Vencimento próximo' },
];

// Chaves e defaults sincronizados com a URL. SSOT: `useListUrlState`.
const URL_KEYS = { status: 'all', sort: 'newest', q: '' } as const;

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

  // Persistência de filtros/ordenação/busca na URL — deep-link + share + reload.
  const { values, setValue, searchInput, setSearchInput, clearAll } = useListUrlState({
    keys: URL_KEYS,
    searchKey: 'q',
    debounceMs: 250,
  });

  const statusFilter = values.status;
  const sortBy = values.sort as SortOption;
  const debouncedSearch = values.q;
  const searchTerm = searchInput;
  const setSearchTerm = setSearchInput;

  const setStatusFilter = useCallback((v: string) => setValue('status', v), [setValue]);
  const setSortBy = useCallback((v: SortOption) => setValue('sort', v), [setValue]);


  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletingRef = useRef(false);
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
  }, [quotes, debouncedSearch, statusFilter, quoteFuse, sortBy]);

  /**
   * Exclusão individual com toast "Desfazer" (mesmo padrão do bulk):
   *  - snapshot pré-delete via fetchQuote (necessário p/ restaurar quote+items);
   *  - deleteQuote sequencial;
   *  - fecha o dialog imediatamente;
   *  - onUndo recria via createQuote (descarta campos gerados).
   */
  const handleDelete = async () => {
    const id = deleteConfirmId;
    if (!id) return;
    // Guarda de reentrada síncrona (ref) — cliques duplicados no botão de
    // confirmar são ignorados antes mesmo do rerender que flusha `isDeleting`.
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;

    setIsDeleting(true);
    try {
      // 1) snapshot ANTES do delete
      let snapshot: Quote | null = null;
      try {
        snapshot = await fetchQuote(id);
      } catch {
        /* segue sem snapshot — undo ficará indisponível */
      }

      // 2) delete
      const ok = await deleteQuote(id);
      setDeleteConfirmId(null);

      if (!ok) {
        toast.error('Não foi possível excluir o orçamento. Tente novamente.');
        return;
      }

      // 3) sem snapshot → sucesso simples, sem desfazer
      if (!snapshot) {
        toast.success('Orçamento excluído.');
        return;
      }

      // 4) toast com "Desfazer"
      showUndoToast({
        title: 'Orçamento excluído',
        description: 'Você pode desfazer esta ação.',
        duration: 8000,
        onUndo: async () => {
          try {
            const items: QuoteItem[] = (snapshot!.items ?? []).map((it) => ({
              ...it,
            })) as QuoteItem[];
            const {
              id: _omitId,
              created_at: _c,
              updated_at: _u,
              quote_number: _qn,
              ...rest
            } = snapshot as Quote & { id?: string };
            void _omitId; void _c; void _u; void _qn;
            const created = await createQuote(rest as Partial<Quote>, items);
            if (created) {
              toast.success('Orçamento restaurado.');
            } else {
              toast.error('Não foi possível restaurar o orçamento.');
            }
          } catch {
            toast.error('Não foi possível restaurar o orçamento.');
          }
        },
      });
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
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


  const handleClearFilters = useCallback(() => {
    clearAll();
  }, [clearAll]);


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

  /**
   * Duplicação com "Desfazer".
   *
   * Padrão espelhado do `handleDelete`: após duplicar, exibe UM único
   * `showUndoToast` com contador de 8s. O onUndo remove o orçamento
   * recém-criado via `deleteQuote(newId)`. Retorna a nova `Quote` (ou
   * `null` em falha) para permitir navegação opcional pelo caller.
   *
   * Invariantes:
   *  - Nenhum outro toast de sucesso é emitido no caminho feliz (o
   *    `useQuotes.duplicateMutation` também não dispara — mesmo padrão do
   *    fix de exclusão que removeu o `toast.success` duplicado).
   *  - Se a duplicação falhar, mostra `toast.error` e não abre undo.
   */
  const handleDuplicateWithUndo = useCallback(
    async (quoteId: string): Promise<Quote | null> => {
      try {
        const created = await duplicateQuote(quoteId);
        if (!created?.id) {
          toast.error('Não foi possível duplicar o orçamento.');
          return null;
        }
        const newId = created.id;
        showUndoToast({
          title: 'Orçamento duplicado',
          description: 'Você pode desfazer esta ação.',
          duration: 8000,
          onUndo: async () => {
            const ok = await deleteQuote(newId);
            if (ok) {
              toast.success('Duplicação desfeita.');
            } else {
              toast.error('Não foi possível desfazer a duplicação.');
            }
          },
        });
        return created;
      } catch {
        toast.error('Não foi possível duplicar o orçamento.');
        return null;
      }
    },
    [duplicateQuote, deleteQuote],
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
    handleMarkApproved,
    duplicateQuote,
    handleDuplicateWithUndo,
    updateQuoteStatus,
  };
}
