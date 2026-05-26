/**
 * GlobalCommandBar — Barra de comandos global (Cmd+K)
 * Refatorado: ações em commandActions.tsx, grupos em CommandActionGroup.tsx
 */
import { useCallback, useEffect, useState, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command';
import { Search, Sparkles, Clock } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { filterByRoutePermission } from '@/lib/navigation/filter-restricted-items';
import { CommandActionGroup } from './CommandActionGroup';
import {
  buildActions,
  RECENT_ITEMS_KEY,
  type CommandAction,
  type RecentItem,
} from './commandActions';

interface GlobalCommandBarProps {
  children?: ReactNode;
  showTrigger?: boolean;
}

export function GlobalCommandBar({ children, showTrigger = false }: GlobalCommandBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const navigate = useNavigate();
  const { actualTheme, setTheme } = useTheme();
  const { isDev, isAdmin } = useAuth();

  // Load recent items
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_ITEMS_KEY);
      if (stored) setRecentItems(JSON.parse(stored).slice(0, 5));
    } catch (e) {
      console.error('Error loading recent items:', e);
    }
  }, [open]);

  const addToRecent = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
    const newItem = { ...item, timestamp: Date.now() };
    setRecentItems((prev) => {
      const filtered = prev.filter((i) => i.id !== item.id);
      const updated = [newItem, ...filtered].slice(0, 5);
      localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  const goTo = useCallback(
    (path: string, label: string, type: RecentItem['type'] = 'page') => {
      addToRecent({ id: path, type, label, path });
      navigate(path);
      setOpen(false);
      setSearch('');
    },
    [navigate, addToRecent],
  );

  const actions = useMemo(() => {
    // buildActions types setTheme as (t: string) => void; only "light"/"dark" are passed,
    // which are valid Theme members, so narrow before calling the real setter.
    const setThemeFromString = (t: string) => {
      if (t === 'light' || t === 'dark' || t === 'auto') setTheme(t);
    };
    const all = buildActions({ goTo, actualTheme, setTheme: setThemeFromString, setOpen });
    // Filtra ações que apontam para rotas restritas (admin/dev) sem papel.
    return filterByRoutePermission(all, (a) => a.path, { isDev, isAdmin });
  }, [goTo, actualTheme, setTheme, isDev, isAdmin]);

  // Filter
  const filteredActions = useMemo(() => {
    if (!search) return actions;
    const s = search.toLowerCase();
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(s) ||
        a.description?.toLowerCase().includes(s) ||
        a.keywords?.some((k) => k.toLowerCase().includes(s)),
    );
  }, [actions, search]);

  // Group
  const grouped = useMemo(() => {
    const g: Record<string, CommandAction[]> = {
      quick: [],
      navigation: [],
      action: [],
      settings: [],
      help: [],
    };
    filteredActions.forEach((a) => g[a.category]?.push(a));
    return g;
  }, [filteredActions]);

  // Recents — também filtrados por permissão (recente pode ter sido
  // salvo quando o usuário tinha role mais alta).
  const recentActions: CommandAction[] = useMemo(() => {
    if (search) return [];
    const visible = filterByRoutePermission(recentItems, (i) => i.path, { isDev, isAdmin });
    return visible.map((item) => ({
      id: `recent-${item.id}`,
      label: item.label,
      description: 'Acessado recentemente',
      icon: <Clock className="h-4 w-4" />,
      action: () => goTo(item.path, item.label, item.type),
      category: 'recent' as const,
      keywords: [],
      path: item.path,
    }));
  }, [recentItems, search, goTo, isDev, isAdmin]);

  return (
    <>
      {children}

      {showTrigger && (
        <button
          onClick={() => setOpen(true)}
          className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground md:flex"
        >
          <Search className="h-4 w-4" />
          <span>Buscar...</span>
          <kbd className="hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command className="rounded-lg border-0 shadow-2xl">
          <div className="flex items-center border-b bg-gradient-to-r from-primary/5 to-transparent px-3">
            <Sparkles className="mr-2 h-4 w-4 animate-pulse text-primary" />
            <CommandInput
              placeholder="O que você quer fazer? Digite para buscar..."
              value={search}
              onValueChange={setSearch}
              className="border-0"
            />
          </div>
          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                <Search className="mb-2 h-10 w-10 opacity-50" />
                <p>Nenhum resultado encontrado.</p>
                <p className="mt-1 text-xs">Tente termos diferentes ou navegue pelas categorias.</p>
              </div>
            </CommandEmpty>

            <CommandActionGroup heading="Recentes" actions={recentActions} showSeparator={false} />
            <CommandActionGroup
              heading="Ações Rápidas"
              actions={grouped.quick}
              iconColor="text-primary"
              showSeparator={recentActions.length > 0}
            />
            <CommandActionGroup heading="Navegação" actions={grouped.navigation} />
            <CommandActionGroup heading="Ações" actions={grouped.action} />
            <CommandActionGroup heading="Configurações" actions={grouped.settings} />
            <CommandActionGroup heading="Ajuda" actions={grouped.help} />
          </CommandList>

          <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">↑</kbd>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">↓</kbd>
                <span>navegar</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">↵</kbd>
                <span>selecionar</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">esc</kbd>
                <span>fechar</span>
              </span>
            </div>
            <span className="text-primary">Promo Brindes</span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}

// Hook to use the command bar programmatically
export function useCommandBar() {
  const openCommandBar = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  }, []);
  return { openCommandBar };
}
