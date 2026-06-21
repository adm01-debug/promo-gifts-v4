import { Search, Star, Bell, Send, Heart, Settings, Trash2, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BorderRadiusControlProps {
  value: number;
  onChange: (value: number) => void;
}

const QUICK_PRESETS = [
  { label: 'Reto', value: 0 },
  { label: 'Sutil', value: 4 },
  { label: 'Médio', value: 8 },
  { label: 'Suave', value: 12 },
  { label: 'Redondo', value: 20 },
];

export function BorderRadiusControl({ value, onChange }: BorderRadiusControlProps) {
  const r = `${value}px`;

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-foreground">Raio da Borda</h2>
          </div>
          <span className="rounded-md bg-muted px-3 py-1 font-mono text-sm font-semibold text-foreground">
            {value}px
          </span>
        </div>

        {/* Quick presets */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-medium transition-all',
                value === preset.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Slider */}
        <div className="relative">
          <Slider
            value={[value]}
            min={0}
            max={20}
            step={1}
            onValueChange={([v]) => onChange(v)}
            className="my-2"
            aria-label="Raio da borda em pixels"
          />
          <div className="mt-1 flex justify-between">
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-[10px] text-muted-foreground">20</span>
          </div>
        </div>

        {/* Preview Label */}
        <p className="mb-4 mt-6 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Preview em tempo real
        </p>

        {/* Row 1: Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" style={{ borderRadius: r }}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar
          </Button>
          <Button size="sm" variant="secondary" style={{ borderRadius: r }}>
            <Heart className="mr-1.5 h-3.5 w-3.5" /> Curtir
          </Button>
          <Button size="sm" variant="outline" style={{ borderRadius: r }}>
            <Settings className="mr-1.5 h-3.5 w-3.5" /> Config
          </Button>
          <Button size="sm" variant="destructive" style={{ borderRadius: r }}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
          </Button>
        </div>

        {/* Row 2: Search input + badges */}
        <div className="mt-4 flex items-center gap-2">
          <div
            className="flex h-9 flex-1 items-center gap-2 border border-input bg-background px-3 text-sm text-muted-foreground"
            style={{ borderRadius: r }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span>Buscar...</span>
          </div>
          <div
            className="flex h-8 items-center gap-1 bg-primary/10 px-3 text-xs font-medium text-primary"
            style={{ borderRadius: r }}
          >
            <Star className="h-3 w-3" /> Novo
          </div>
          <div
            className="flex h-8 items-center gap-1 bg-muted px-3 text-xs font-medium text-muted-foreground"
            style={{ borderRadius: r }}
          >
            <Bell className="h-3 w-3" /> 3
          </div>
        </div>

        {/* Row 3: Mini card with avatar */}
        <div
          className="mt-4 flex items-center gap-3 border border-border bg-card p-3"
          style={{ borderRadius: r }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-xs font-bold text-primary-foreground"
            style={{ borderRadius: r }}
          >
            JD
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">João da Silva</p>
            <p className="truncate text-xs text-muted-foreground">
              Última mensagem enviada há 5 min
            </p>
          </div>
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
        </div>
      </CardContent>
    </Card>
  );
}
