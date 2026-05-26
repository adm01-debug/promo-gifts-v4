import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoSelectorProps {
  images: string[];
  selectedImages: Set<number>;
  onToggle: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function PhotoSelector({
  images,
  selectedImages,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: PhotoSelectorProps) {
  const allSelected = selectedImages.size === images.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {selectedImages.size} de {images.length} fotos selecionadas
        </span>
        <button
          type="button"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-xs text-primary hover:underline"
        >
          {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {images.map((img, idx) => {
          const selected = selectedImages.has(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onToggle(idx)}
              className={cn(
                'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-secondary transition-all',
                selected
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <img
                src={img}
                alt={`Foto ${idx + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {selected && (
                <div className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
