/**
 * Kit Identity Picker — popover para definir cor, ícone e tag do kit
 */
import { useState } from 'react';
import * as Lucide from 'lucide-react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { KitIdentity } from '@/lib/kit-builder';

const PRESET_COLORS = [
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#22C55E',
  '#6366F1',
];

const PRESET_ICONS = [
  'Package',
  'Gift',
  'Heart',
  'Star',
  'Crown',
  'Sparkles',
  'Briefcase',
  'Coffee',
  'Laptop',
  'Leaf',
  'Trophy',
  'Users',
] as const;

interface Props {
  identity?: KitIdentity;
  onChange: (next: KitIdentity) => void;
}

export function KitIdentityPicker({ identity, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current: KitIdentity = {
    color: identity?.color ?? '#3B82F6',
    icon: identity?.icon ?? 'Package',
    tag: identity?.tag ?? '',
    description: identity?.description ?? '',
    isFavorite: identity?.isFavorite ?? false,
  };

  const Icon =
    (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      current.icon
    ] || Lucide.Package;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" aria-label="Editar identidade do kit">
          <span
            className="h-4 w-4 rounded-full border border-border"
            style={{ background: current.color }}
            aria-hidden
          />
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">Identidade</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Identidade do kit</h4>
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label className="text-xs">Cor</Label>
          <div className="grid grid-cols-8 gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                onClick={() => onChange({ ...current, color: c })}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                  current.color === c
                    ? 'border-foreground ring-2 ring-primary/30'
                    : 'border-border',
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        {/* Icon */}
        <div className="space-y-2">
          <Label className="text-xs">Ícone</Label>
          <div className="grid grid-cols-6 gap-2">
            {PRESET_ICONS.map((name) => {
              const Cmp = (
                Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>
              )[name];
              if (!Cmp) return null;
              const active = current.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  onClick={() => onChange({ ...current, icon: name })}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-md border transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  <Cmp className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Tag */}
        <div className="space-y-2">
          <Label htmlFor="kit-tag" className="text-xs">
            Etiqueta
          </Label>
          <Input
            id="kit-tag"
            value={current.tag}
            onChange={(e) => onChange({ ...current, tag: e.target.value })}
            placeholder="ex: Cliente VIP, Natal, Onboarding"
            maxLength={32}
            className="h-9"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
