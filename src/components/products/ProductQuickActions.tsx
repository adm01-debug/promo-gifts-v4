/**
 * ProductQuickActions — 5 quick-access modal buttons for product detail page.
 * Tabela de Preços | Personalização | Indicação | Nicho | WhatsApp
 */
import { useState } from 'react';
import { TableProperties, Palette, Target, Layers } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { InlinePriceCalculator } from '@/components/products/InlinePriceCalculator';
import { ProductCustomizationOptions } from '@/components/products/ProductCustomizationOptions';
import { ProductPersonalizationRules } from '@/components/products/ProductPersonalizationRules';
import { ShareActions } from '@/components/products/ShareActions';
import type { Product } from '@/hooks/products';

interface ProductQuickActionsProps {
  productId: string;
  productName: string;
  productSku?: string;
  basePrice: number;
  minQuantity: number;
  tags?: Record<string, string[]>;
  niches?: string[];
  product?: Product;
  isLoadingTags?: boolean;
  hasErrorTags?: boolean;
  isLoadingNiches?: boolean;
  hasErrorNiches?: boolean;
  onRetryTags?: () => void;
  onRetryNiches?: () => void;
  selectedVariant?: {
    variantName?: string | null;
    colorHex?: string | null;
    thumbnailUrl?: string | null;
    variantImages?: string[] | null;
  } | null;
  onConfirmPrice?: () => void;
  priceConfirmedAt?: string | Date | null;
}

type ModalType = 'precos' | 'personalizacao' | 'indicacao' | 'nicho' | null;
type ActionKey = Exclude<ModalType, null>;

const actions = [
  {
    key: 'precos' as const,
    label: 'Preços',
    icon: TableProperties,
    iconColor: 'text-primary',
    description: 'Veja a tabela completa de preços por quantidade e variações',
  },
  {
    key: 'personalizacao' as const,
    label: 'Gravação',
    icon: Palette,
    iconColor: 'text-accent-foreground',
    description: 'Confira técnicas de gravação, áreas e cores disponíveis',
  },
  {
    key: 'indicacao' as const,
    label: 'Indicação',
    icon: Target,
    iconColor: 'text-primary',
    description: 'Veja para qual público, datas e ocasiões este produto é indicado',
  },
  {
    key: 'nicho' as const,
    label: 'Nicho',
    icon: Layers,
    iconColor: 'text-accent-foreground',
    description: 'Descubra os nichos e segmentos onde este produto se encaixa',
  },
];

const categoryIcons: Record<string, string> = {
  'Público-Alvo': '👥',
  'Datas Comemorativas': '📅',
  Endomarketing: '🎯',
};

export function ProductQuickActions({
  productId,
  productName,
  productSku,
  basePrice,
  minQuantity,
  tags,
  niches,
  product,
  isLoadingTags,
  hasErrorTags,
  isLoadingNiches,
  hasErrorNiches,
  onRetryTags,
  onRetryNiches,
  selectedVariant,
  onConfirmPrice,
}: ProductQuickActionsProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const displayTagSections = Object.entries(tags && !Array.isArray(tags) ? tags : {})
    .map(
      ([category, items]) =>
        [category, (items || []).filter((item) => item?.trim().length > 0)] as const,
    )
    .filter(([, items]) => items.length > 0);

  const displayNiches = Array.from(
    new Set(
      (niches ?? [])
        .map((niche) => niche?.trim())
        .filter((niche): niche is string => Boolean(niche)),
    ),
  );

  const isActionDisabled = (key: ActionKey) => {
    if (key === 'indicacao') {
      // Permitir abrir se estiver carregando ou se houver erro (para mostrar feedback no modal)
      if (isLoadingTags || hasErrorTags) return false;
      return displayTagSections.length === 0;
    }
    if (key === 'nicho') {
      if (isLoadingNiches || hasErrorNiches) return false;
      return displayNiches.length === 0;
    }
    return false;
  };

  const handleClick = (key: ActionKey) => {
    if (isActionDisabled(key)) return;
    setActiveModal(key);
  };

  return (
    <>
      <div className="flex w-full flex-col gap-3 pt-2">
        {onConfirmPrice && (
          <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <TableProperties className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Validar preço com fornecedor?</span>
            </div>
            <button
              onClick={onConfirmPrice}
              className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90"
            >
              Confirmar agora
            </button>
          </div>
        )}
        <div className="flex w-full items-center gap-2">
          {actions.map(({ key, label, icon: Icon, iconColor, description }) => {
            const disabled = isActionDisabled(key);

            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    title={
                      disabled ? `Sem dados de ${label.toLowerCase()} para este produto` : undefined
                    }
                    onClick={() => handleClick(key)}
                    className={cn(
                      'group relative inline-flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-lg border px-4 py-3 text-xs font-bold',
                      'transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      disabled
                        ? 'cursor-not-allowed border-border/20 bg-muted/30 text-muted-foreground/50'
                        : 'border-border/40 bg-card text-foreground shadow-sm hover:-translate-y-1 hover:scale-[1.02] hover:border-primary/50 hover:shadow-lg hover:shadow-primary/15 active:translate-y-0 active:scale-100 active:shadow-sm',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-all duration-300',
                        disabled
                          ? 'opacity-40'
                          : cn(
                              iconColor,
                              'group-hover:rotate-6 group-hover:scale-125 group-hover:drop-shadow-sm',
                            ),
                      )}
                    />
                    {label}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[240px] border-border/40 bg-popover/95 backdrop-blur-sm"
                >
                  <div className="flex flex-col gap-1.5 p-1">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Icon className={cn('h-3.5 w-3.5', !disabled && iconColor)} />
                      <span>{label}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {disabled
                        ? `Sem dados de ${label.toLowerCase()} para este produto`
                        : description}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {product && <ShareActions product={product} selectedVariant={selectedVariant} />}
      </div>

      <Dialog open={activeModal === 'precos'} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TableProperties className="h-5 w-5 text-primary" />
              Tabela de Preços
            </DialogTitle>
            <DialogDescription>Veja os descontos por quantidade</DialogDescription>
          </DialogHeader>
          <InlinePriceCalculator
            productId={productId}
            productName={productName}
            basePrice={basePrice}
            minQuantity={minQuantity}
            defaultOpen
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeModal === 'personalizacao'}
        onOpenChange={(o) => !o && setActiveModal(null)}
      >
        <DialogContent className="max-h-[85vh] w-[min(96vw,540px)] max-w-lg overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Personalização
            </DialogTitle>
            <DialogDescription>Técnicas e locais de gravação disponíveis</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ProductCustomizationOptions productId={productId} productSku={productSku} />
            <ProductPersonalizationRules
              productId={productId}
              productSku={productSku ?? ''}
              productName={productName}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === 'indicacao'} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <div className="border-b border-border/40 px-5 pb-3 pt-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-primary" />
                Indicado para
              </DialogTitle>
              <DialogDescription className="text-xs">
                Público-alvo e ocasiões recomendadas
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-5 py-5">
            {isLoadingTags ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : hasErrorTags ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
                <div className="mb-3 rounded-full bg-destructive/10 p-3">
                  <Target className="h-6 w-6 text-destructive" />
                </div>
                <p className="mb-4 text-sm font-medium text-destructive">
                  Não foi possível carregar as indicações.
                </p>
                <button
                  onClick={() => (onRetryTags ? onRetryTags() : window.location.reload())}
                  className="rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground transition-all hover:bg-destructive/90"
                >
                  Tentar novamente
                </button>
              </div>
            ) : displayTagSections.length > 0 ? (
              displayTagSections.map(([category, items]) => (
                <div key={category} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{categoryIcons[category] ?? '•'}</span>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
                      {category}
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <span
                        key={item}
                        className="rounded-lg border border-border/40 bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma indicação cadastrada para este produto.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === 'nicho'} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <div className="border-b border-border/40 px-5 pb-3 pt-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5 text-primary" />
                Nichos / Segmentos
              </DialogTitle>
              <DialogDescription className="text-xs">
                Segmentos de mercado compatíveis
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-3 px-5 py-5">
            {isLoadingNiches ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-11 w-full animate-pulse rounded-xl bg-muted/50" />
                ))}
              </div>
            ) : hasErrorNiches ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
                <div className="mb-3 rounded-full bg-destructive/10 p-3">
                  <Layers className="h-6 w-6 text-destructive" />
                </div>
                <p className="mb-4 text-sm font-medium text-destructive">
                  Não foi possível carregar os nichos.
                </p>
                <button
                  onClick={() => (onRetryNiches ? onRetryNiches() : window.location.reload())}
                  className="rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground transition-all hover:bg-destructive/90"
                >
                  Tentar novamente
                </button>
              </div>
            ) : displayNiches.length > 0 ? (
              displayNiches.map((niche) => (
                <div
                  key={niche}
                  className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/45 px-4 py-3"
                >
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-sm font-medium text-foreground">{niche}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum nicho cadastrado para este produto.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
