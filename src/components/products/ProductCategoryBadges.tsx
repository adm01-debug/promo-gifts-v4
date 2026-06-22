import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Package, Palette, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryIcon, useCategoryIcons } from '@/hooks/products/useCategoryIcons';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

/**
 * Categoria/grupo exibido como badge. Aceita id string (UUID) ou numérico,
 * espelhando os shapes reais de `Product.category` e `Product.groups`.
 */
interface CategoryBadgeItem {
  id: number | string;
  name: string;
  icon?: string;
}

interface ProductCategoryBadgesProps {
  category: CategoryBadgeItem;
  groups?: CategoryBadgeItem[];
  className?: string;
  showLabels?: boolean;
  // UUID real da categoria (para deep-link correto ao Super Filtro)
  categoryUuid?: string | null;
  // Caminho raiz→folha da categoria principal (ex.: ["Cadernetas", "…", "Com Pauta"]).
  // Exibido no tooltip do badge principal.
  categoryPath?: string[];
  // Props para o link de personalização
  productId?: string;
  productName?: string;
  productSku?: string;
  productPrice?: number;
  productImageUrl?: string | null;
  productMinQuantity?: number;
  showPersonalizationLink?: boolean;
  isKit?: boolean;
}

/**
 * Exibe badges com ícones Lucide (ou emojis legados) das categorias/grupos do produto.
 * Combina a categoria principal com grupos adicionais.
 * Inclui links opcionais para Personalização, Mockup e Kit Builder.
 *
 * ## Resolução do ícone
 * getCategoryIcon() → string (nome Lucide ou emoji) → <CategoryIcon /> → SVG ou emoji
 */
export const ProductCategoryBadges = memo(
  ({
    category,
    groups,
    className,
    categoryUuid,
    categoryPath,
    productId,
    productName,
    productSku,
    productPrice,
    productImageUrl,
    showPersonalizationLink = true,
    isKit = false,
  }: ProductCategoryBadgesProps) => {
    const navigate = useNavigate();
    const { data: categoryIcons = [] } = useCategoryIcons();

    // Combinar categoria principal com grupos adicionais (sem duplicatas)
    const allCategories: CategoryBadgeItem[] = [];

    if (category) {
      allCategories.push(category);
    }

    if (groups && groups.length > 0) {
      groups.forEach((group) => {
        if (group && !allCategories.some((c) => c.id === group.id)) {
          allCategories.push(group);
        }
      });
    }

    if (allCategories.length === 0) return null;

    /**
     * Resolve o ícone da categoria:
     * 1. Busca em category_icons via getCategoryIcon (4-pass fuzzy match)
     * 2. Fallback para cat.icon local se o DB retornar o default '📦'
     * Retorna sempre uma string (nome Lucide ou emoji).
     */
    const getIconValue = (cat: CategoryBadgeItem): string => {
      const supabaseIcon = getCategoryIcon(cat.name, categoryIcons);
      if (supabaseIcon !== '📦') return supabaseIcon;
      return cat.icon || '📦';
    };

    // Navegar para o simulador com o produto pré-selecionado
    const handlePersonalizationClick = () => {
      if (!productId) return;

      const productData = {
        id: productId,
        name: productName || '',
        sku: productSku || '',
        price: productPrice || 0,
        imageUrl: productImageUrl,
        categoryName: category?.name,
      };

      navigate('/simulador', {
        state: {
          preSelectedProduct: productData,
        },
      });
    };

    return (
      <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
        {allCategories.map((cat) => {
          const isMainCategory = String(cat.id) === String(category?.id);
          // Caminho completo só para a categoria principal e quando houver ≥2 níveis.
          const path =
            isMainCategory && categoryPath && categoryPath.length > 1 ? categoryPath : null;
          const ancestors = path ? path.slice(0, -1) : [];
          const leaf = path ? path[path.length - 1] : '';
          return (
            <Tooltip key={cat.id}>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  onClick={() => {
                    // Categoria principal usa categoryUuid (folha); grupos usam o próprio id.
                    const idToUse = isMainCategory && categoryUuid ? categoryUuid : cat.id;
                    navigate(`/filtros?categories=${idToUse}`);
                  }}
                  className={cn(
                    'cursor-pointer px-2.5 py-1 text-sm font-medium',
                    'border border-border/50 bg-secondary/80 hover:bg-secondary',
                    'transition-all duration-300 hover:scale-105 group-hover:shadow-md',
                    'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent hover:before:animate-[shimmer_2s_infinite]',
                  )}
                >
                  {/* Ícone: SVG Lucide para nomes conhecidos, emoji/texto para legados */}
                  <CategoryIcon
                    value={getIconValue(cat)}
                    size={14}
                    className="mr-1.5"
                  />
                  <span className="text-xs">{cat.name}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs font-medium">
                {path ? (
                  <span>
                    <span className="opacity-70">{ancestors.join(' › ')} › </span>
                    {leaf}
                  </span>
                ) : (
                  <>Ver todos os produtos de {cat.name}</>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Link para Simulador de Personalização */}
        {showPersonalizationLink && productId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                onClick={handlePersonalizationClick}
                data-testid="product-personalization-badge"
                className={cn(
                  'cursor-pointer px-2.5 py-1 text-sm font-medium',
                  'border-primary/50 bg-primary/10 hover:bg-primary/20',
                  'text-primary hover:text-primary',
                  'transition-all duration-300 hover:scale-105 hover:border-primary group-hover:shadow-md',
                  'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent hover:before:animate-[shimmer_2s_infinite]',
                )}
              >
                <Palette className="mr-1.5 h-3.5 w-3.5" />
                <span className="text-xs">Personalização</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-medium">
              Simular preço de personalização
            </TooltipContent>
          </Tooltip>
        )}

        {/* Visualizar com Logo */}
        {productId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                onClick={() =>
                  navigate('/mockup-generator', {
                    state: {
                      preSelectedProduct: {
                        id: productId,
                        name: productName,
                        sku: productSku,
                        imageUrl: productImageUrl,
                      },
                    },
                  })
                }
                data-testid="product-mockup-badge"
                className={cn(
                  'cursor-pointer px-2.5 py-1 text-sm font-medium',
                  'border-success/50 bg-success/15 hover:bg-success/25',
                  'text-success hover:text-success/80',
                  'transition-all duration-300 hover:scale-105 hover:border-success group-hover:shadow-md',
                  'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent hover:before:animate-[shimmer_2s_infinite]',
                )}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                <span className="text-xs">Visualizar com Logo</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-medium">
              Gerar mockup com sua logo
            </TooltipContent>
          </Tooltip>
        )}

        {/* Monte seu Kit - apenas para produtos que NÃO são kits nativos */}
        {productId && !isKit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                onClick={() => navigate(`/kit-builder?product=${productId}`)}
                data-testid="product-kit-badge"
                className={cn(
                  'cursor-pointer px-2.5 py-1 text-sm font-medium',
                  'border-warning/50 bg-warning/15 hover:bg-warning/25',
                  'text-warning hover:text-warning',
                  'transition-all duration-300 hover:scale-105 hover:border-warning group-hover:shadow-md',
                  'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent hover:before:animate-[shimmer_2s_infinite]',
                )}
              >
                <Package className="mr-1.5 h-3.5 w-3.5" />
                <span className="text-xs">Monte seu Kit</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-medium">
              Montar um kit personalizado com este produto
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  },
);
