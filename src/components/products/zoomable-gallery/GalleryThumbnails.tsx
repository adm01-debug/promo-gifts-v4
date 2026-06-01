import { useState } from 'react';
import { cn } from '@/lib/utils';

interface GalleryThumbnailsProps {
  images: string[];
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

function BlurThumb({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        'h-full w-full object-cover transition-all duration-500 ease-out',
        loaded ? 'opacity-100 blur-0' : 'opacity-40 blur-sm',
      )}
      onLoad={() => setLoaded(true)}
    />
  );
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
          <BlurThumb src={image} alt={`Thumbnail ${index + 1}`} />
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
          <BlurThumb src={image} alt={`Thumbnail ${index + 1}`} />
        </button>
      ))}
    </div>
  );
}

export { BlurThumb };
