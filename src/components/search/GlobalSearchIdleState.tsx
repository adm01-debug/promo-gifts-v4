import React from 'react';
import { CommandItem } from '@/components/ui/command';
import { Clock, Flame, X, Sparkles, Eye, ChevronRight, Zap, Compass } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  paletteItemStateClass,
  staggerStyle,
  SectionHeader,
  RankBadge,
  NavCard,
  type QuickAction,
} from './GlobalSearchHelpers';

/* ── Main Idle State Component ── */
interface GlobalSearchIdleStateProps {
  history: string[];
  popularProducts: Array<{
    id: string;
    name: string;
    sku: string;
    view_count: number;
    image_url?: string | null;
    category_name?: string | null;
  }>;
  contextualSuggestions: Array<{ id: string; text: string; icon?: string; type: string }>;
  quickSuggestions: Array<{ label: string; icon: string }>;
  routeContext: { section: string };
  quickActionsData: Array<QuickAction>;
  onSuggestionClick: (text: string) => void;
  onSelect: (href: string, addToHistory?: boolean) => void;
  onRemoveFromHistory: (e: React.MouseEvent, term: string) => void;
}

export function GlobalSearchIdleState({
  history,
  popularProducts,
  contextualSuggestions,
  quickSuggestions,
  routeContext,
  quickActionsData,
  onSuggestionClick,
  onSelect,
  onRemoveFromHistory,
}: GlobalSearchIdleStateProps) {
  return (
    <>
      {/* Recent */}
      {history.length > 0 && (
        <div className="duration-200 animate-in fade-in-0">
          <SectionHeader icon={<Clock />} label="Recentes" count={history.length} />

          <div className="space-y-0.5 px-2">
            {history.slice(0, 4).map((term, i) => (
              <CommandItem
                key={`h-${i}`}
                value={`history-${term}`}
                onSelect={() => onSuggestionClick(term)}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 duration-200 animate-in fade-in-0 slide-in-from-left-2',
                  paletteItemStateClass,
                )}
                style={staggerStyle(i)}
              >
                <Clock className="h-4 w-4 shrink-0 transition-colors [color:hsl(var(--command-text-subtle))] group-data-[selected=true]:[color:hsl(var(--command-text-muted))]" />
                <span className="flex-1 truncate text-[13px] uppercase tracking-wide [color:hsl(var(--command-text-muted))] group-data-[selected=true]:font-medium group-data-[selected=true]:text-foreground">
                  {term}
                </span>
                <button
                  onClick={(e) => onRemoveFromHistory(e, term)}
                  aria-label={`Remover "${term}" do histórico`}
                  className="flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-all hover:bg-destructive/10 group-hover:opacity-100 group-data-[selected=true]:opacity-100"
                >
                  <X
                    className="h-3 w-3 [color:hsl(var(--command-text-subtle))] hover:text-destructive"
                    aria-hidden="true"
                  />
                </button>
              </CommandItem>
            ))}
          </div>
        </div>
      )}

      {/* Popular Products */}
      {popularProducts.length > 0 && (
        <div className="duration-300 animate-in fade-in-0" style={{ animationDelay: '80ms' }}>
          <SectionHeader
            icon={<Flame />}
            label="Mais Populares"
            count={popularProducts.length}
            gradient="bg-gradient-to-br from-orange-500/15 to-orange-500/5"
            iconColor="text-orange-500"
          />

          <div className="space-y-1 px-2">
            {popularProducts.map((product, idx) => (
              <CommandItem
                key={`pop-${product.id}`}
                value={`popular-${product.id}-${product.name}`}
                onSelect={() => onSelect(`/produto/${product.id}`, false)}
                className={cn(
                  'flex items-center gap-3.5 rounded-xl px-3 py-3 duration-200 animate-in fade-in-0 slide-in-from-bottom-1',
                  paletteItemStateClass,
                  idx === 0 &&
                    'border border-brand-primary/10 bg-gradient-to-r from-brand-primary/[0.06] to-transparent',
                )}
                style={staggerStyle(idx, 100)}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/10">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  ) : (
                    <RankBadge index={idx} />
                  )}
                  {idx === 0 ? (
                    <div className="absolute inset-x-0 bottom-0 bg-orange-500 py-0.5 text-center shadow-lg">
                      <span className="text-[8px] font-black uppercase tracking-tighter text-white">
                        TOP 1
                      </span>
                    </div>
                  ) : (
                    product.image_url && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-[10px] font-bold text-white">{idx + 1}º</span>
                      </div>
                    )
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn('truncate text-[13px]', idx === 0 ? 'font-bold' : 'font-medium')}
                  >
                    {product.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 font-mono text-[10px] [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-subtle))]">
                      {product.sku}
                    </span>
                    {product.category_name && (
                      <span className="truncate text-[10px] [color:hsl(var(--command-text-muted))]">
                        • {product.category_name}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-[10px] [color:hsl(var(--command-text-subtle))]">
                      <Eye className="h-3 w-3" />
                      <span>{product.view_count}</span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="h-3.5 w-3.5 shrink-0 [color:hsl(var(--command-text-subtle))]" />
              </CommandItem>
            ))}
          </div>
        </div>
      )}

      {/* Contextual Suggestions */}
      {contextualSuggestions.length > 0 && (
        <div className="duration-300 animate-in fade-in-0" style={{ animationDelay: '160ms' }}>
          <SectionHeader
            icon={<Sparkles />}
            label={
              routeContext.section === 'products'
                ? 'Para o Catálogo'
                : routeContext.section === 'quotes'
                  ? 'Para Orçamentos'
                  : 'Sugestões'
            }
            gradient="bg-gradient-to-br from-primary/12 to-primary/4"
          />
          <div
            className="flex flex-wrap gap-2 px-4 pb-2"
            role="group"
            aria-label="Sugestões contextuais"
          >
            {contextualSuggestions.slice(0, 6).map((sug, i) => (
              <motion.button
                key={sug.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15, delay: 0.2 + i * 0.04 }}
                onClick={() => onSuggestionClick(sug.text)}
                aria-label={`Buscar ${sug.text}`}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm transition-all duration-150',
                  sug.type === 'filter' &&
                    'from-primary/8 to-primary/4 hover:to-primary/8 border border-primary/15 bg-gradient-to-r text-primary/80 hover:border-primary/30 hover:from-primary/15 hover:text-primary',
                  sug.type === 'navigation' &&
                    'border text-foreground [background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))] hover:[background-color:hsl(var(--command-surface-soft))] hover:[border-color:hsl(var(--command-border-strong))]',
                  sug.type === 'action' &&
                    'from-brand-primary/8 to-brand-primary/4 hover:to-brand-primary/8 border border-brand-primary/15 bg-gradient-to-r text-brand-primary/80 hover:border-brand-primary/30 hover:from-brand-primary/15 hover:text-brand-primary',
                  sug.type === 'search' &&
                    'border [background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))] [color:hsl(var(--command-text-muted))] hover:text-foreground hover:[background-color:hsl(var(--command-surface-soft))] hover:[border-color:hsl(var(--command-border-strong))]',
                )}
              >
                <span className="text-sm leading-none">{sug.icon}</span>
                <span>{sug.text}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Shortcuts — only rendered when there are items */}
      {quickSuggestions.length > 0 && (
        <div className="duration-300 animate-in fade-in-0" style={{ animationDelay: '240ms' }}>
          <SectionHeader
            icon={<Zap />}
            label="Atalhos"
            gradient="bg-gradient-to-br from-brand-primary/12 to-brand-primary/4"
          />
          <div className="flex flex-wrap gap-2 px-4 pb-2" role="group" aria-label="Atalhos rápidos">
            {quickSuggestions.map((qs, i) => (
              <motion.button
                key={`q-${i}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15, delay: 0.28 + i * 0.03 }}
                onClick={() => onSuggestionClick(qs.label)}
                aria-label={`Buscar ${qs.label}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-150 [background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))] [color:hsl(var(--command-text-muted))] hover:text-foreground hover:shadow-sm hover:[background-color:hsl(var(--command-surface-soft))] hover:[border-color:hsl(var(--command-border-strong))]"
              >
                <span className="text-sm leading-none opacity-70">{qs.icon}</span>
                <span>{qs.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Go To — Navigation Grid */}
      <div className="pb-2 duration-300 animate-in fade-in-0" style={{ animationDelay: '320ms' }}>
        <SectionHeader
          icon={<Compass />}
          label="Ir Para"
          count={quickActionsData.length}
          gradient="bg-gradient-to-br from-primary/10 to-primary/4"
        />
        <div className="grid grid-cols-1 gap-1.5 px-2 sm:grid-cols-2">
          {quickActionsData.map((action, i) => (
            <NavCard
              key={action.id}
              action={action}
              index={i}
              onSelect={(href) => onSelect(href, false)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
