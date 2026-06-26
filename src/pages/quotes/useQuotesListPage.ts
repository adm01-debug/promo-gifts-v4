import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import Fuse from 'fuse.js';
import { useQuotes, type Quote, type QuoteItem } from '@/hooks/quotes';
import { isSyncedToBitrix } from '@/components/quotes/QuotesStatusChips';

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
    error,
    deleteQuote,
    duplicateQuote,
    updateQuoteStatus,
    createQuote,
    fetchQuote,
  } = useQuotes();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
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

    if (searchTerm && searchTerm.length >= 2) {
      const fuseResults = quoteFuse.search(searchTerm);
      results = fuseResults.map((r) => r.item);
    }

    if (statusFilter === 'unsynced') {
      results = results.filter((q) => q.status === 'pending' && !isSyncedToBitrix(q));
    } else if (statusFilter === 'created_synced') {
      results = results.filter((q) => q.status === 'pending' && isSyncedToBitrix(q));
    } else if (statusFilter === 'synced') {
      results = results.filter((q) => isSyncedToBitrix(q));
    } else if (statusFilter !== 'all') {
      results = results.filter((quote) => quote.status === statusFilter);
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

  const handleBulkDelete = async () => {
    for (const id of bulkDeleteIds) {
      await deleteQuote(id);
    }
    setBulkDeleteIds([]);
  };

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
