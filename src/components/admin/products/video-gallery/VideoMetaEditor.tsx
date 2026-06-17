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
import { Save, X } from 'lucide-react';
import { type ExternalVideo, VIDEO_TYPES } from './types';
import { cn } from '@/lib/utils';

interface Props {
  video: ExternalVideo;
  onSave: (data: { title?: string; description?: string; video_type?: string }) => void;
  onCancel: () => void;
}

export function VideoMetaEditor({ video, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(video.title ?? '');
  const [description, setDescription] = useState(video.description ?? '');
  const [videoType, setVideoType] = useState(video.video_type || 'product_video');

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col gap-1.5 rounded-lg bg-black/85 p-2 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título do vídeo"
        className="h-6 border-white/20 bg-white/10 text-[10px] text-white placeholder:text-white/50"
      />
      <Select value={videoType} onValueChange={setVideoType}>
        <SelectTrigger className="h-6 border-white/20 bg-white/10 text-[10px] text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VIDEO_TYPES.map((t) => (
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
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição"
        className="h-6 border-white/20 bg-white/10 text-[10px] text-white placeholder:text-white/50"
      />
      <div className="mt-auto flex gap-1">
        <Button
          type="button"
          size="icon"
          aria-label="Salvar"
          variant="ghost"
          className="h-6 w-6 text-white hover:bg-white/20"
          onClick={() =>
            onSave({
              title: title.trim() || undefined,
              description: description.trim() || undefined,
              video_type: videoType,
            })
          }
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
