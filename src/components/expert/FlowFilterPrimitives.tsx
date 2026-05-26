/**
 * FlowFilterPrimitives — Shared UI components for FlowFilterPanel.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function GroupSeparator({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-1.5 pt-5">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/30 to-transparent" />
      <div className="flex select-none items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/35">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/30 to-transparent" />
    </div>
  );
}

export function SectionRow({
  icon: Icon,
  label,
  isOpen,
  onToggle,
  count,
  totalOptions,
}: {
  icon: React.ElementType;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  count?: number;
  totalOptions?: number;
}) {
  return (
    <button
      onClick={onToggle}
      className="group/sec flex w-full items-center justify-between px-1 py-2"
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-lg transition-all duration-200',
            isOpen
              ? 'bg-primary/15 text-primary shadow-sm shadow-primary/10'
              : count && count > 0
                ? 'bg-primary/10 text-primary'
                : 'bg-muted/20 text-muted-foreground/40 group-hover/sec:bg-muted/40',
          )}
        >
          <Icon className="h-3 w-3" />
        </div>
        <span
          className={cn(
            'text-xs font-medium transition-colors',
            count && count > 0
              ? 'text-foreground'
              : 'text-foreground/70 group-hover/sec:text-foreground',
          )}
        >
          {label}
        </span>
        {count !== undefined && count > 0 && (
          <Badge
            variant="secondary"
            className="h-4 rounded-md border-primary/20 bg-primary/10 px-1.5 py-0 text-[9px] font-bold text-primary"
          >
            {count}
          </Badge>
        )}
        {totalOptions !== undefined && totalOptions > 0 && count === 0 && (
          <span className="text-[9px] font-medium text-muted-foreground/30">{totalOptions}</span>
        )}
      </div>
      <motion.div animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.15 }}>
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-colors',
            isOpen ? 'text-primary/50' : 'text-muted-foreground/25',
          )}
        />
      </motion.div>
    </button>
  );
}

export function CollapsibleContent({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="pb-2 pl-1">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MultiChipGrid({
  items,
  selected,
  onToggle,
  maxVisible = 24,
  searchable = false,
  placeholder = 'Buscar…',
}: {
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  maxVisible?: number;
  searchable?: boolean;
  placeholder?: string;
}) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.toLowerCase().includes(q));
  }, [items, search]);

  const visible = showAll ? filtered : filtered.slice(0, maxVisible);
  const hasMore = filtered.length > maxVisible && !showAll;

  if (items.length === 0)
    return (
      <p className="px-1 py-1 text-[10px] italic text-muted-foreground/30">
        Nenhuma opção disponível
      </p>
    );

  return (
    <div className="space-y-1.5">
      {searchable && items.length > 8 && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="h-6 w-full rounded-md border border-border/15 bg-background/30 pl-7 pr-2 text-[10px] transition-all placeholder:text-muted-foreground/25 focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
        </div>
      )}
      <div className="scrollbar-thin scrollbar-thumb-border/20 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
        {visible.map((item) => {
          const isSelected = selected.includes(item);
          return (
            <button
              key={item}
              onClick={() => onToggle(item)}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-all duration-150',
                isSelected
                  ? 'border-primary/30 bg-primary/15 text-primary shadow-sm shadow-primary/5'
                  : 'border-border/15 bg-muted/5 text-muted-foreground/55 hover:border-primary/20 hover:bg-accent/20 hover:text-foreground',
              )}
            >
              {isSelected && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
              <span className="max-w-[120px] truncate">{item}</span>
            </button>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="px-1 text-[9px] font-medium text-primary/60 transition-colors hover:text-primary"
        >
          +{filtered.length - maxVisible} mais…
        </button>
      )}
      {search && filtered.length === 0 && (
        <p className="px-1 text-[9px] italic text-muted-foreground/30">Nenhum resultado</p>
      )}
    </div>
  );
}
