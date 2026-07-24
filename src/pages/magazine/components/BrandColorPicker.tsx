/**
 * BrandColorPicker — 3 swatches (primária, destaque, texto) com preview vivo,
 * presets curados e verificação WCAG. Substitui os <input type="color"> nativos
 * do Step 1 (Identidade) por peças shadcn coerentes com o design system.
 */

import { useState } from 'react';
import { Check, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  BRAND_PRESETS,
  contrastRatio,
  isValidHex,
  normalizeHex,
  wcagLevel,
  WCAG_LABEL,
} from '../utils/contrast';

type ColorKey = 'primary' | 'secondary' | 'text';

const LABEL: Record<ColorKey, string> = {
  primary: 'Primária',
  secondary: 'Destaque',
  text: 'Texto',
};

const SWATCHES = [
  '#0f172a', '#0c2340', '#0d0d0d', '#111827', '#1e293b', '#374151',
  '#dc2626', '#e11d48', '#f97316', '#f59e0b', '#eab308', '#c9a84c',
  '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#22c55e', '#10b981',
  '#ffffff', '#f5f5f4', '#a3a3a3', '#525252', '#262626', '#000000',
];

interface Props {
  colors: { primary: string; secondary: string; text: string };
  onChange: (next: { primary: string; secondary: string; text: string }) => void;
}

export function BrandColorPicker({ colors, onChange }: Props) {
  const setColor = (k: ColorKey, v: string) => {
    const hex = normalizeHex(v) || v;
    onChange({ ...colors, [k]: hex });
  };

  const applyPreset = (p: (typeof BRAND_PRESETS)[number]) =>
    onChange({ primary: p.primary, secondary: p.secondary, text: p.text });

  const bodyOnPrimary = wcagLevel(colors.text, colors.primary);
  const accentOnPrimary = wcagLevel(colors.secondary, colors.primary);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(LABEL) as ColorKey[]).map((k) => (
          <SwatchField key={k} label={LABEL[k]} value={colors[k]} onChange={(v) => setColor(k, v)} />
        ))}
      </div>

      <div>
        <Label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
          Paletas sugeridas
        </Label>
        <div className="flex flex-wrap gap-2">
          {BRAND_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="group flex items-center gap-2 rounded-full border bg-background px-2 py-1 text-xs transition hover:border-primary/60"
              aria-label={`Aplicar paleta ${p.name}`}
            >
              <span className="flex gap-0.5">
                {[p.primary, p.secondary, p.text].map((c, i) => (
                  <span
                    key={i}
                    className="h-4 w-4 rounded-full border border-border/60"
                    style={{ background: c }}
                    aria-hidden
                  />
                ))}
              </span>
              <span className="pr-1">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview WCAG */}
      <div
        className="rounded-lg border p-6"
        style={{ background: colors.primary, color: colors.text }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className="text-xs uppercase tracking-widest opacity-80"
              style={{ color: colors.secondary }}
            >
              Preview da paleta
            </div>
            <div className="mt-1 font-display text-2xl font-bold">
              Sua revista brilha assim
            </div>
            <div className="mt-1 text-sm opacity-80">
              Texto de corpo com a cor definida.
            </div>
          </div>
          <div className="space-y-1 text-right text-[10px]">
            <ContrastBadge level={bodyOnPrimary} label="Texto sobre primária" fg={colors.text} bg={colors.primary} />
            <ContrastBadge level={accentOnPrimary} label="Destaque sobre primária" fg={colors.secondary} bg={colors.primary} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SwatchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [hex, setHex] = useState(value);
  const valid = isValidHex(hex);
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-start gap-2 px-2"
            aria-label={`Escolher cor ${label}`}
          >
            <span
              className="h-6 w-6 rounded-md border"
              style={{ background: value }}
              aria-hidden
            />
            <span className="font-mono text-xs">{value}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{label}</span>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setHex(c);
                  onChange(c);
                }}
                className={cn(
                  'h-6 w-6 rounded-md border transition',
                  value.toLowerCase() === c.toLowerCase()
                    ? 'ring-2 ring-primary ring-offset-1'
                    : 'border-border hover:scale-110',
                )}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Hex customizado
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                onBlur={() => {
                  if (valid) onChange(normalizeHex(hex));
                  else setHex(value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && valid) {
                    onChange(normalizeHex(hex));
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={cn('h-8 font-mono text-xs', !valid && hex && 'border-destructive')}
                placeholder="#0f172a"
                aria-invalid={!valid}
              />
              {valid ? (
                <Check className="h-4 w-4 text-primary" aria-label="Hex válido" />
              ) : (
                <span className="text-xs text-destructive">inválido</span>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ContrastBadge({
  level,
  label,
  fg,
  bg,
}: {
  level: ReturnType<typeof wcagLevel>;
  label: string;
  fg: string;
  bg: string;
}) {
  const ratio = contrastRatio(fg, bg).toFixed(2);
  const ok = level === 'AA' || level === 'AAA';
  const Icon = ok ? ShieldCheck : ShieldAlert;
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1',
        ok ? 'bg-white/15' : 'bg-red-500/30',
      )}
      role="status"
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span className="tabular-nums">{ratio}</span>
      <span className="opacity-80">· {WCAG_LABEL[level].split('·')[0].trim()}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
