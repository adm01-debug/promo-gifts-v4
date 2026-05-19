/**
 * RelatedTemplates — Mostra 2-3 templates da mesma categoria sob o template atual.
 */
import * as Lucide from 'lucide-react';
import { formatCurrency } from '@/lib/kit-builder';
import { cn } from '@/lib/utils';
import type { KitTemplateRow } from '@/hooks/kit-builder';

interface Props {
  current: KitTemplateRow;
  all: KitTemplateRow[];
  onSelect: (t: KitTemplateRow) => void;
}

export function RelatedTemplates({ current, all, onSelect }: Props) {
  const related = all
    .filter((t) => t.id !== current.id && t.category === current.category && t.is_active)
    .slice(0, 3);

  if (related.length === 0) return null;

  return (
    <div className="space-y-2 pt-3 border-t border-border/40">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        Quem usou também usou
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {related.map((t) => {
          const Icon =
            (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[t.icon] ||
            Lucide.Package;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border text-left',
                'hover:bg-muted/60 hover:border-primary/40 transition-colors',
              )}
            >
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 border"
                style={{ background: `${t.color}1A`, borderColor: `${t.color}40`, color: t.color }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{t.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatCurrency(Number(t.total_price))}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
