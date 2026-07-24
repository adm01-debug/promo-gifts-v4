/**
 * EmptySearchState — empty state inteligente do GlobalSearchPalette.
 * Mostrado quando há query (>= 3 chars) mas zero resultados.
 *
 * FIX BUG-GS-05: Unified localStorage store with useSearchHistory.
 * Previously used key 'recent_global_searches' (format: string[]), which was
 * completely disconnected from the 'global-search-history-v2' key used by
 * useSearchHistory (format: HistoryItem[]). The user would see different history
 * in different places in the UI.
 * Fix: reads/writes 'global-search-history-v2' using the HistoryItem format.
 */
import { memo } from 'react';
import { Search, Plus, ExternalLink, RotateCcw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Must stay in sync with STORAGE_KEY in useSearchHistory.ts */
const UNIFIED_HISTORY_KEY = 'global-search-history-v2';

interface HistoryItem {
  id: string;
  label: string;
  type: string;
  timestamp: number;
}

interface EmptySearchStateProps {
  query: string;
  onAction: (href: string) => void;
  onRefine: () => void;
  onPickRecent: (term: string) => void;
}

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(UNIFIED_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.label === 'string' && x.type === 'general')
      .map((x) => x.label)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export const EmptySearchState = memo(
  ({ query, onAction, onRefine, onPickRecent }: EmptySearchStateProps) => {
    const recent = getRecentSearches();
    const encoded = encodeURIComponent(query);

    const actions = [
      {
        key: 'catalog',
        label: 'Buscar no catálogo',
        sublabel: 'Pesquisar produtos no catálogo completo',
        icon: <ExternalLink className="h-4 w-4" />,
        onClick: () => onAction(`/?q=${encoded}`),
      },
      {
        key: 'new-quote',
        label: `Criar orçamento para "${query}"`,
        sublabel: 'Iniciar um novo orçamento com este nome',
        icon: <Plus className="h-4 w-4" />,
        onClick: () => onAction(`/orcamentos/novo?client=${encoded}`),
      },
      {
        key: 'refine',
        label: 'Refinar busca',
        sublabel: 'Limpar e tentar termos diferentes',
        icon: <RotateCcw className="h-4 w-4" />,
        onClick: onRefine,
      },
    ];

    return (
      <div className="flex flex-col gap-4 px-4 py-6 duration-300 animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border [background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))]">
            <Search className="h-5 w-5 [color:hsl(var(--command-text-subtle))]" />
          </div>
          <div>
            <p className="text-sm [color:hsl(var(--command-text-muted))]">
              Nenhum resultado para <span className="font-semibold text-foreground">"{query}"</span>
            </p>
            <p className="mt-0.5 text-[11px] [color:hsl(var(--command-text-subtle))]">
              Tente uma destas ações:
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {actions.map((a) => (
            <button
              key={a.key}
              onClick={a.onClick}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                'border [border-color:hsl(var(--command-border))]',
                'hover:[background-color:hsl(var(--command-accent))] hover:[border-color:hsl(var(--command-border-strong))]',
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {a.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{a.label}</p>
                <p className="truncate text-[11px] [color:hsl(var(--command-text-subtle))]">
                  {a.sublabel}
                </p>
              </div>
            </button>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t pt-2 [border-color:hsl(var(--command-border))]">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide [color:hsl(var(--command-text-subtle))]">
              Buscas recentes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((term) => (
                <button
                  key={term}
                  onClick={() => onPickRecent(term)}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-colors [background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))] hover:[background-color:hsl(var(--command-accent))]"
                >
                  <Clock className="h-3 w-3 [color:hsl(var(--command-text-subtle))]" />
                  <span className="max-w-[160px] truncate">{term}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
);

/**
 * Persist a query in recent searches (max 5, dedupe, most-recent first).
 * FIX BUG-GS-05: Now writes to 'global-search-history-v2' (HistoryItem format)
 * instead of the old disconnected 'recent_global_searches' key (string[] format).
 */
export function pushRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return;
  try {
    const raw = localStorage.getItem(UNIFIED_HISTORY_KEY);
    const allItems: HistoryItem[] = raw
      ? (JSON.parse(raw) as HistoryItem[]).filter((x) => x && typeof x.label === 'string')
      : [];
    const newItem: HistoryItem = {
      id: `history-${trimmed}`,
      label: trimmed,
      type: 'general',
      timestamp: Date.now(),
    };
    // Dedupe by label (case-insensitive) and id
    const filtered = allItems.filter(
      (i) =>
        !(i.id === newItem.id && i.type === 'general') &&
        !(i.label.toLowerCase() === trimmed.toLowerCase() && i.type === 'general'),
    );
    filtered.unshift(newItem);
    localStorage.setItem(UNIFIED_HISTORY_KEY, JSON.stringify(filtered.slice(0, 50)));
    // Notify same-tab listeners (useSearchHistory uses this event)
    window.dispatchEvent(new Event('search-history-update'));
  } catch {
    /* silent */
  }
}
