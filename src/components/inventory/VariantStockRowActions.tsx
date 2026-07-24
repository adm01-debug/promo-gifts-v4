/**
 * VariantStockRowActions — Replica as 7 ações do ProductCard do Catálogo na
 * tabela de Estoque (uma linha = uma variação SKU).
 *
 * Ordem (esquerda → direita): Copiar SKU · Carrinho · Orçamento · Coleção ·
 * Favoritar · Comparar · Visualizar · Compartilhar.
 *
 * Como cada linha já representa um SKU específico, dispensamos o
 * VariantPickerDialog do catálogo e aplicamos a ação direto na variação.
 *
 * Robustez:
 * - Todas as ações têm try/catch e fallback silencioso de copiar (execCommand).
 * - Ações assíncronas (copiar/compartilhar) expõem estado `pending` e bloqueiam
 *   duplo-clique. Mensagens de erro são profissionais e neutras (sem stack).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy,
  FileText,
  FolderPlus,
  Heart,
  GitCompare,
  Eye,
  Share2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { QuickAddToQuote } from '@/components/products/QuickAddToQuote';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import type { ProductStockSummary, VariantStock } from '@/types/stock';

interface VariantStockRowActionsProps {
  product: ProductStockSummary;
  variant: VariantStock;
}

type PendingAction = 'copy' | 'share' | null;

export async function safeCopyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback abaixo */
  }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand?.('copy') ?? false;
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function VariantStockRowActions({ product, variant }: VariantStockRowActionsProps) {
  const navigate = useNavigate();
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const isFavorite = useFavoritesStore((s) => s.isFavorite(product.productId));
  const addFavorite = useFavoritesStore((s) => s.addFavorite);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);

  const isInCompare = useComparisonStore((s) =>
    s.isInCompare(product.productId, variant.variantId),
  );
  const addToCompare = useComparisonStore((s) => s.addToCompare);
  const removeFromCompare = useComparisonStore((s) => s.removeFromCompare);

  const variantInfo = {
    color_name: variant.colorName,
    color_hex: variant.colorHex,
    size_code: variant.sizeCode,
    variant_id: variant.variantId,
    thumbnail: variant.imageUrl ?? product.productImageUrl,
  };

  const productUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/produto/${product.productId}`
      : `/produto/${product.productId}`;

  const handleCopySku = async () => {
    if (pending === 'copy') return;
    setPending('copy');
    const ok = await safeCopyText(variant.variantSku);
    setPending(null);
    if (ok) toast.success(`SKU ${variant.variantSku} copiado`);
    else toast.error('Não foi possível copiar o SKU. Tente novamente.');
  };

  const handleQuote = () => {
    try {
      const params = new URLSearchParams({
        product_id: product.productId,
        product_name: product.productName,
        product_sku: variant.variantSku,
        variant_id: variant.variantId,
        min_quantity: String(variant.minStock || 1),
      });
      if (variant.colorName) params.set('color_name', variant.colorName);
      if (variant.colorHex) params.set('color_hex', variant.colorHex);
      if (variant.sizeCode) params.set('size_code', variant.sizeCode);
      if (variant.imageUrl) params.set('product_image', variant.imageUrl);
      navigate(`/orcamentos/novo?${params.toString()}`);
    } catch {
      toast.error('Não foi possível abrir o orçamento. Tente novamente.');
    }
  };

  const handleFavorite = () => {
    try {
      if (isFavorite) {
        removeFavorite(product.productId);
        toast.success(`"${product.productName}" removido dos favoritos`);
      } else {
        addFavorite(product.productId, variantInfo);
        toast.success(
          `"${product.productName}" favoritado${variant.colorName ? ` — ${variant.colorName}` : ''}`,
        );
      }
    } catch {
      toast.error('Não foi possível atualizar os favoritos. Tente novamente.');
    }
  };

  const handleCompare = () => {
    try {
      if (isInCompare) {
        removeFromCompare(product.productId, variant.variantId);
        toast.success(`"${product.productName}" removido da comparação`);
        return;
      }
      const ok = addToCompare(product.productId, variantInfo);
      if (!ok) {
        toast.error('Limite de 4 produtos para comparação atingido');
      } else {
        toast.success(
          `"${product.productName}" adicionado à comparação${variant.colorName ? ` — ${variant.colorName}` : ''}`,
        );
      }
    } catch {
      toast.error('Não foi possível atualizar a comparação. Tente novamente.');
    }
  };

  const handleView = () => {
    try {
      navigate(`/produto/${product.productId}`);
    } catch {
      toast.error('Não foi possível abrir o produto.');
    }
  };

  const handleShare = async () => {
    if (pending === 'share') return;
    setPending('share');
    const shareData = {
      title: product.productName,
      text: `${product.productName}${variant.colorName ? ` — ${variant.colorName}` : ''}`,
      url: productUrl,
    };
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share(shareData);
          return;
        } catch (err) {
          const name = (err as { name?: string } | undefined)?.name;
          if (name === 'AbortError') return; // cancelado pelo usuário — silencioso
          // outros erros caem no fallback de cópia
        }
      }
      const ok = await safeCopyText(productUrl);
      if (ok) toast.success('Link do produto copiado');
      else toast.error('Não foi possível compartilhar. Tente novamente.');
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div
        className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        data-testid="stock-row-actions"
      >
        <IconAction
          label={`Copiar SKU ${variant.variantSku}`}
          icon={pending === 'copy' ? Loader2 : Copy}
          onClick={handleCopySku}
          iconClassName={pending === 'copy' ? 'animate-spin' : undefined}
          disabled={pending === 'copy'}
          testId="stock-row-copy-sku"
        />

        {/* Carrinho — usa fluxo padrão do QuickAddToQuote (variante-aware). */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex" data-testid="stock-row-cart">
              <QuickAddToQuote
                productId={product.productId}
                productName={product.productName}
                productSku={variant.variantSku}
                productImageUrl={variant.imageUrl ?? product.productImageUrl ?? undefined}
                minQuantity={variant.minStock || 1}
                variant="icon"
                className="h-7 w-7"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>Adicionar ao carrinho</TooltipContent>
        </Tooltip>

        <IconAction
          label="Orçamento"
          icon={FileText}
          onClick={handleQuote}
          testId="stock-row-quote"
        />
        <IconAction
          label="Coleção"
          icon={FolderPlus}
          onClick={() => setCollectionOpen(true)}
          testId="stock-row-collection"
        />
        <IconAction
          label={isFavorite ? 'Remover favorito' : 'Favoritar'}
          icon={Heart}
          onClick={handleFavorite}
          active={isFavorite}
          iconClassName={isFavorite ? 'fill-destructive text-destructive' : undefined}
          ariaPressed={isFavorite}
          testId="stock-row-favorite"
        />
        <IconAction
          label={isInCompare ? 'Remover da comparação' : 'Comparar'}
          icon={GitCompare}
          onClick={handleCompare}
          active={isInCompare}
          iconClassName={isInCompare ? 'text-primary' : undefined}
          ariaPressed={isInCompare}
          testId="stock-row-compare"
        />
        <IconAction
          label="Visualizar produto"
          icon={Eye}
          onClick={handleView}
          testId="stock-row-view"
        />
        <IconAction
          label="Compartilhar"
          icon={pending === 'share' ? Loader2 : Share2}
          onClick={handleShare}
          iconClassName={pending === 'share' ? 'animate-spin' : undefined}
          disabled={pending === 'share'}
          testId="stock-row-share"
        />
      </div>

      <AddToCollectionModal
        open={collectionOpen}
        onOpenChange={setCollectionOpen}
        productId={product.productId}
        productName={product.productName}
        variant={{
          color_name: variant.colorName,
          color_hex: variant.colorHex,
          size_code: variant.sizeCode,
          variant_id: variant.variantId,
          thumbnail: variant.imageUrl ?? product.productImageUrl,
        }}
      />
    </>
  );
}

function IconAction({
  label,
  icon: Icon,
  onClick,
  active,
  iconClassName,
  ariaPressed,
  disabled,
  testId,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  iconClassName?: string;
  ariaPressed?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7', active && 'bg-muted/60')}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          aria-label={label}
          aria-pressed={ariaPressed}
          disabled={disabled}
          data-testid={testId}
        >
          <Icon className={cn('h-3 w-3', iconClassName)} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
