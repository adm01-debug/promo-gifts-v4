/**
 * KitVisualComposition — visualização em grade dos itens de um kit, com imagens e legendas.
 */
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Package } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';
import { getProxiedImageUrl } from '@/utils/imageProxy';

export interface KitItem {
  id: string;
  name: string;
  imageUrl?: string | null;
  quantity?: number;
}

interface KitVisualCompositionProps {
  items: KitItem[];
  className?: string;
}

export function KitVisualComposition({ items, className }: KitVisualCompositionProps) {
  if (!items.length) {
    return (
      <Card className={cn('flex items-center justify-center p-8 text-muted-foreground', className)}>
        <Package className="mr-2 h-5 w-5" /> Kit vazio
      </Card>
    );
  }
  return (
    <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-4', className)}>
      {items.map((item) => (
        <Card key={item.id} className="overflow-hidden">
          <div className="flex aspect-square items-center justify-center bg-muted">
            {item.imageUrl ? (
              <OptimizedImage
                src={getCdnUrl(item.imageUrl, 'card')}
                urlOriginal={getProxiedImageUrl(item.imageUrl) ?? null}
                alt={item.name}
                className="object-cover"
                containerClassName="h-full w-full"
              />
            ) : (
              <Package className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="p-2 text-xs">
            <p className="truncate font-medium">{item.name}</p>
            {item.quantity !== null && <p className="text-muted-foreground">x{item.quantity}</p>}
          </div>
        </Card>
      ))}
    </div>
  );
}
