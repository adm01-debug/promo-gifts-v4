/**
 * Media section — lazy-loaded since it imports ImageGallery + VideoGallery
 */
import { ProductImageGallery } from '../image-gallery';
import { ProductVideoGallery } from '../ProductVideoGallery';
import { SectionCard } from '../ProductFormHelpers';
import { ImageIcon, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  images: string[];
  onImagesChange: (images: string[]) => void;
  productId?: string;
}

export default function ProductMediaSection({ images, onImagesChange, productId }: Props) {
  return (
    <SectionCard
      id="media"
      title="Mídia"
      icon={ImageIcon}
      subtitle="Galeria de imagens e vídeos do produto"
    >
      <div className="space-y-6">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold">Galeria de Imagens</h4>
              <p className="text-[11px] text-muted-foreground">Classificadas por tipo</p>
            </div>
            {images.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {images.length} imagem(ns)
              </Badge>
            )}
          </div>
          <ProductImageGallery
            images={images}
            onChange={onImagesChange}
            folder="products"
            productId={productId}
          />
        </div>

        <div className="border-t border-border/30 pt-5">
          <div className="mb-3 flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-semibold">Galeria de Vídeos</h4>
            <p className="text-[11px] text-muted-foreground">Classificados por tipo</p>
          </div>
          <ProductVideoGallery productId={productId} />
        </div>
      </div>
    </SectionCard>
  );
}
