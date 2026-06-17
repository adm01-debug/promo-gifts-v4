/**
 * Match card components extracted from ProductMatchPage.
 */
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { type MatchResult, type Product } from '@/hooks/products';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';
import { ExternalLink, Users, Tag, Layers, Equal, Link2, FileText } from 'lucide-react';

function formatPrice(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export const MATCH_TYPE_CONFIG = {
  identical: { label: 'Idêntico', icon: Equal, color: 'bg-primary text-primary-foreground' },
  similar: { label: 'Semelhante', icon: Layers, color: 'bg-info text-info-foreground' },
  complementary: {
    label: 'Complementar',
    icon: Link2,
    color: 'bg-warning text-warning-foreground',
  },
} as const;

export function SelectedProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <img
            src={getCdnUrl(product.images?.[0] || product.image_url || '/placeholder.svg', 'small')}
            alt={product.name}
            className="h-20 w-20 shrink-0 rounded-lg bg-muted object-cover"
            loading="lazy"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="font-display text-sm font-bold leading-tight text-foreground">
              {product.name}
            </h3>
            <p className="text-[11px] text-muted-foreground">SKU: {product.sku}</p>
            <p className="text-sm font-semibold text-foreground">{formatPrice(product.price)}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {product.category?.name && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {product.category.name}
                </Badge>
              )}
              {product.supplier?.name && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {product.supplier.name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {product.tags && (
          <div className="space-y-1.5">
            {product.tags.publicoAlvo?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Users className="h-3 w-3 shrink-0 text-primary" />
                {product.tags.publicoAlvo.map((t) => (
                  <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[9px]">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {product.tags.nicho?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag className="h-3 w-3 shrink-0 text-accent-foreground" />
                {product.tags.nicho.map((t) => (
                  <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[9px]">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => navigate(`/produto/${product.id}`)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver detalhes
        </Button>
      </CardContent>
    </Card>
  );
}

export function MatchCard({
  match,
  onNavigate,
}: {
  match: MatchResult;
  onNavigate: (id: string) => void;
}) {
  const navigate = useNavigate();
  const config = MATCH_TYPE_CONFIG[match.matchType];
  const Icon = config.icon;

  const handleAddToQuote = () => {
    const p = match.product;
    const params = new URLSearchParams({
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku ?? '',
      product_price: String(p.price),
      min_quantity: String(p.minQuantity || 1),
      ...(p.image_url ? { product_image: p.image_url } : {}),
    });
    navigate(`/orcamentos/novo?${params.toString()}`);
  };

  return (
    <Card className="group border-border/40 transition-all hover:border-border/80 hover:shadow-md">
      <CardContent className="flex items-start gap-3 p-3">
        <img
          src={getCdnUrl(
            match.product.images?.[0] || match.product.image_url || '/placeholder.svg',
            'small',
          )}
          alt={match.product.name}
          className="h-16 w-16 shrink-0 rounded-lg bg-muted object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-xs font-bold text-foreground">{match.product.name}</h4>
              <p className="text-[10px] text-muted-foreground">
                {match.product.sku} • {formatPrice(match.product.price)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge className={cn('gap-0.5 px-1.5 py-0 text-[9px]', config.color)}>
                <Icon className="h-2.5 w-2.5" />
                {config.label}
              </Badge>
              <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px]">
                {match.score}pts
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {match.reasons.map((reason, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded bg-secondary/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
              >
                {reason}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {match.product.category?.name && <span>{match.product.category.name}</span>}
            {match.product.supplier?.name && (
              <>
                <span className="text-border">•</span>
                <span>{match.product.supplier.name}</span>
              </>
            )}
            {match.product.colors?.length > 0 && (
              <>
                <span className="text-border">•</span>
                <span>{match.product.colors.length} cores</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={handleAddToQuote}
            >
              <FileText className="h-3 w-3" />
              Orçamento
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => onNavigate(match.product.id)}
            >
              <ExternalLink className="h-3 w-3" />
              Detalhes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
