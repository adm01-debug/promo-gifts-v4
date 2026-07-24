import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getProxiedImageUrl, deriveOriginalUrl } from '@/utils/imageProxy';

interface GalleryThumbnailsProps {
  images: string[];
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

/**
 * Deriva a URL de fallback para uma imagem da galeria.
 * 1. Tenta derivar URL original SPOT a partir do CF ID
 * 2. Cai de volta para a própria URL (que pode ser raw de fornecedor)
 * 3. Proxia via edge function se for domínio de fornecedor
 *
 * BUG-GALLERY-CORS FIX (2026-06-23):
 * GalleryThumbnails não tinha urlOriginal → sem fallback quando CF falha.
 * Agora toda thumbnail tem fallback proxiado para supplier CDN.
 */
function getThumbFallback(image: string): string | null {
  return getProxiedImageUrl(deriveOriginalUrl(image) ?? image) ?? null;
}

export function GalleryThumbnails({
  images,
  currentIndex,
  onSelect,
  className,
}: GalleryThumbnailsProps) {
  return (
    <div className={cn('scrollbar-thin flex gap-2 overflow-x-auto pb-2', className)}>
      {images.map((image, index) => (
        <button
          key={image || index}
          onClick={() => onSelect(index)}
          className={cn(
            'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
            index === currentIndex
              ? 'border-primary ring-2 ring-primary/30'
              : 'border-transparent hover:border-primary/50',
          )}
        >
          <OptimizedImage
            src={image}
            alt={`Thumbnail ${index + 1}`}
            className="object-cover"
            containerClassName="h-full w-full"
            urlOriginal={getThumbFallback(image)}
          />
        </button>
      ))}
    </div>
  );
}

export function FullscreenThumbnails({ images, currentIndex, onSelect }: GalleryThumbnailsProps) {
  return (
    <div className="flex justify-center gap-2 overflow-x-auto">
      {images.map((image, index) => (
        <button
          key={image || index}
          onClick={() => onSelect(index)}
          className={cn(
            'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
            index === currentIndex
              ? 'border-primary ring-2 ring-primary/30'
              : 'border-transparent opacity-60 hover:border-primary/50 hover:opacity-100',
          )}
        >
          <OptimizedImage
            src={image}
            alt={`Thumbnail ${index + 1}`}
            className="object-cover"
            containerClassName="h-full w-full"
            urlOriginal={getThumbFallback(image)}
          />
        </button>
      ))}
    </div>
  );
}
