/**
 * Kit Card — Cartão visual rico para "Meus Kits" e "Sugeridos".
 */
import * as Lucide from 'lucide-react';
import { Star, Pencil, Copy, Trash2, Wand2, Tag as TagIcon, Layers, Pin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/kit-builder';
import { cn } from '@/lib/utils';

export interface KitCardData {
  id: string;
  name: string;
  description?: string | null;
  tag?: string | null;
  color: string;
  icon: string;
  totalPrice: number;
  itemsCount: number;
  isFavorite?: boolean;
  isPinned?: boolean;
  badge?: string;
  usageBadge?: string;
}

interface Props {
  data: KitCardData;
  variant: 'mine' | 'template';
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onTogglePin?: () => void;
  onUseTemplate?: () => void;
  isBusy?: boolean;
}

export function KitCard({
  data,
  variant,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onUseTemplate,
  isBusy,
}: Props) {
  const Icon =
    (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[data.icon] ||
    Lucide.Package;

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all hover:shadow-lg',
        data.isPinned && 'ring-2 ring-primary/50',
      )}
    >
      <div className="h-1.5 w-full" style={{ background: data.color }} aria-hidden />

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
            style={{
              background: `${data.color}1A`,
              borderColor: `${data.color}40`,
              color: data.color,
            }}
            aria-hidden
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display font-semibold">{data.name}</h3>
              {data.badge && (
                <Badge
                  variant={data.badge === 'Popular' ? 'default' : 'outline'}
                  className={cn(
                    'text-[10px]',
                    data.badge === 'Popular' && 'border-warning/30 bg-warning/15 text-warning',
                  )}
                >
                  {data.badge}
                </Badge>
              )}
              {data.usageBadge && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  {data.usageBadge}
                </Badge>
              )}
            </div>
            {data.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {data.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {variant === 'mine' && onTogglePin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={onTogglePin}
                      aria-label={data.isPinned ? 'Desafixar' : 'Fixar em destaque'}
                    >
                      <Pin
                        className={cn(
                          'h-4 w-4 transition-colors',
                          data.isPinned ? 'fill-primary text-primary' : 'text-muted-foreground',
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {data.isPinned ? 'Desafixar' : 'Fixar em destaque'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {variant === 'mine' && onToggleFavorite && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggleFavorite}
                aria-label={data.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
              >
                <Star
                  className={cn(
                    'h-4 w-4 transition-colors',
                    data.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground',
                  )}
                />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {data.tag && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <TagIcon className="h-3 w-3" />
              {data.tag}
            </Badge>
          )}
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {data.itemsCount} ite{data.itemsCount === 1 ? 'm' : 'ns'}
          </span>
        </div>

        <div className="flex items-end justify-between border-t border-border/40 pt-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(data.totalPrice)}</p>
          </div>

          <div className="flex items-center gap-1">
            {variant === 'mine' ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onEdit}
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onDuplicate}
                  aria-label="Duplicar"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={onDelete}
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={onUseTemplate} disabled={isBusy} className="gap-1">
                <Wand2 className="h-3.5 w-3.5" />
                Usar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
