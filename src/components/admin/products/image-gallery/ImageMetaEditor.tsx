import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Save, X } from 'lucide-react';
import { type ExternalImage, IMAGE_TYPES } from './types';

interface Props {
  image: ExternalImage;
  onSave: (data: { alt_text: string; image_type: string; caption: string }) => void;
  onCancel: () => void;
}

export function ImageMetaEditor({ image, onSave, onCancel }: Props) {
  const [altText, setAltText] = useState(image.alt_text ?? '');
  const [imageType, setImageType] = useState(image.image_type || 'main');
  const [caption, setCaption] = useState(image.caption ?? '');

  return (
    <div className="absolute inset-0 z-10 flex flex-col gap-1.5 rounded-lg bg-black/85 p-2 backdrop-blur-sm">
      <Input
        value={altText}
        onChange={(e) => setAltText(e.target.value)}
        placeholder="Alt text (SEO)"
        className="h-6 border-white/20 bg-white/10 text-[10px] text-white placeholder:text-white/50"
      />
      <Select value={imageType} onValueChange={setImageType}>
        <SelectTrigger className="h-6 border-white/20 bg-white/10 text-[10px] text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {IMAGE_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value} className="text-xs">
              <span className="flex items-center gap-1.5">
                <t.icon className={cn('h-3 w-3', t.color)} />
                {t.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Legenda"
        className="h-6 border-white/20 bg-white/10 text-[10px] text-white placeholder:text-white/50"
      />
      <div className="mt-auto flex gap-1">
        <Button
          type="button"
          size="icon"
          aria-label="Salvar"
          variant="ghost"
          className="h-6 w-6 text-white hover:bg-white/20"
          onClick={() => onSave({ alt_text: altText, image_type: imageType, caption })}
        >
          <Save className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-white hover:bg-white/20"
          onClick={onCancel}
          aria-label="Fechar"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
