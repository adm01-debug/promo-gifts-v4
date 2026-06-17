import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRESET_COLORS, PRESET_EMOJIS } from './preset-utils';

// ─── Color & Emoji Picker ─────────────────────────────────
export function ColorEmojiPicker({
  emoji,
  color,
  onEmojiChange,
  onColorChange,
}: {
  emoji: string;
  color: string;
  onEmojiChange: (e: string) => void;
  onColorChange: (c: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Emoji</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onEmojiChange(e)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all',
                'hover:scale-110 hover:bg-accent',
                emoji === e ? 'scale-110 bg-primary/15 ring-2 ring-primary' : 'bg-muted/50',
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Cor</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-all hover:scale-110',
                color === c ? 'scale-110 border-foreground shadow-lg' : 'border-transparent',
              )}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check className="mx-auto h-3.5 w-3.5 text-primary-foreground" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Preview Header ───────────────────────────────────────
export function PresetPreviewHeader({
  emoji,
  color,
  name,
  description,
}: {
  emoji: string;
  color: string;
  name: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/50 p-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl transition-colors"
        style={{ backgroundColor: color + '25' }}
      >
        {emoji}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name || 'Nome do preset'}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {description || 'Descrição...'}
        </p>
      </div>
    </div>
  );
}
