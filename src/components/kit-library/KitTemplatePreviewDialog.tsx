/**
 * Preview rico do template antes de clonar — com seção "Quem usou também usou".
 */
import * as Lucide from 'lucide-react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/kit-builder';
import { RelatedTemplates } from '@/components/kit-library/RelatedTemplates';
import type { KitTemplateRow } from '@/hooks/kit-builder';

interface Props {
  template: KitTemplateRow | null;
  allTemplates?: KitTemplateRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClone: () => void;
  onSelectRelated?: (t: KitTemplateRow) => void;
  isCloning: boolean;
}

export function KitTemplatePreviewDialog({
  template,
  allTemplates = [],
  open,
  onOpenChange,
  onClone,
  onSelectRelated,
  isCloning,
}: Props) {
  if (!template) return null;

  const Icon =
    (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      template.icon
    ] || Lucide.Package;

  const items = Array.isArray(template.items_data) ? template.items_data : [];
  const box = template.box_data as { name?: string; sku?: string } | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
              style={{
                background: `${template.color}1A`,
                borderColor: `${template.color}40`,
                color: template.color,
              }}
              aria-hidden
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 font-display">
                {template.name}
                <Badge variant="outline" className="text-[10px]">
                  {template.category}
                </Badge>
                {template.usage_count >= 5 && (
                  <Badge className="gap-1 border-warning/30 bg-warning/15 text-[10px] text-warning">
                    <Sparkles className="h-3 w-3" /> Popular
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {template.description || 'Template curado pelo sistema.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {box && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Embalagem
              </p>
              <p className="text-sm font-medium">{box.name || 'Caixa selecionada'}</p>
              {box.sku && <p className="text-xs text-muted-foreground">SKU: {box.sku}</p>}
            </div>
          )}

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Itens ({items.length})
            </p>
            <ScrollArea className="max-h-64 rounded-lg border">
              <ul className="divide-y">
                {items.length === 0 ? (
                  <li className="p-3 text-xs text-muted-foreground">Sem itens cadastrados.</li>
                ) : (
                  items.map((it, i) => {
                    const item = it as {
                      name?: string;
                      sku?: string;
                      quantity?: number;
                      price?: number;
                    };
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 p-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.name || `Item ${i + 1}`}</p>
                          {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted-foreground">x{item.quantity ?? 1}</p>
                          {typeof item.price === 'number' && (
                            <p className="text-xs font-medium">{formatCurrency(item.price)}</p>
                          )}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </ScrollArea>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-primary/5 p-3">
            <span className="text-sm text-muted-foreground">Total estimado</span>
            <span className="text-xl font-bold text-primary">
              {formatCurrency(Number(template.total_price))}
            </span>
          </div>

          {onSelectRelated && allTemplates.length > 0 && (
            <RelatedTemplates current={template} all={allTemplates} onSelect={onSelectRelated} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={onClone} disabled={isCloning} className="gap-2">
            {isCloning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Usar este template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
