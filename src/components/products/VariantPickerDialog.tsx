/**
 * VariantPickerDialog — Dialog reutilizável que exige seleção de cor/variante
 * antes de executar ações como Favoritar, Comparar e Coleção.
 * Mesmo fluxo usado para Carrinho e Orçamento.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Heart, GitCompare, FolderPlus, MessageCircle, FileText } from 'lucide-react';
import { SingleVariantPicker } from '@/components/products/SingleVariantPicker';
import type { ExternalVariantStock } from '@/hooks/products/useExternalVariantStock';
import { VisuallyHidden } from '@/components/a11y/VisuallyHidden';

export type VariantActionMode = 'collection' | 'compare' | 'favorite' | 'quote' | 'share';

const MODE_CONFIG: Record<
  VariantActionMode,
  { icon: typeof Heart; title: string; colorClass: string; bgClass: string }
> = {
  favorite: {
    icon: Heart,
    title: 'Favoritar com Cor',
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/15',
  },
  compare: {
    icon: GitCompare,
    title: 'Comparar com Cor',
    colorClass: 'text-primary',
    bgClass: 'bg-primary/15',
  },
  collection: {
    icon: FolderPlus,
    title: 'Coleção com Cor',
    colorClass: 'text-info',
    bgClass: 'bg-info/15',
  },
  share: {
    icon: MessageCircle,
    title: 'Compartilhar com Cor',
    colorClass: 'text-success',
    bgClass: 'bg-success/15',
  },
  quote: {
    icon: FileText,
    title: 'Orçamento com Cor',
    colorClass: 'text-primary',
    bgClass: 'bg-primary/15',
  },
};

interface VariantPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  mode: VariantActionMode;
  onComplete: (variant: ExternalVariantStock | null) => void;
}

export function VariantPickerDialog({
  open,
  onOpenChange,
  productId,
  productName,
  mode,
  onComplete,
}: VariantPickerDialogProps) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  const handleSelect = (variant: ExternalVariantStock | null) => {
    onComplete(variant);
    // Delay close to let parent state update propagate first (avoids race condition)
    setTimeout(() => onOpenChange(false), 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <VisuallyHidden>
          <DialogTitle>
            {config.title}: {productName}
          </DialogTitle>
          <DialogDescription>Seletor de variantes para o produto {productName}</DialogDescription>
        </VisuallyHidden>

        <div className="space-y-2 px-5 pb-3 pt-5">
          <DialogHeader className="p-0">
            <div className="flex items-center gap-2.5 font-display text-base font-semibold">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  config.bgClass,
                )}
              >
                <Icon className={cn('h-4 w-4', config.colorClass)} />
              </div>
              {config.title}
            </div>
          </DialogHeader>
          <p className="truncate text-xs text-muted-foreground">{productName}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Escolha a cor/variação do produto. Clique em "Sem cor específica" para prosseguir sem
            selecionar.
          </p>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-5">
          <SingleVariantPicker productId={productId} onSelect={handleSelect} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
