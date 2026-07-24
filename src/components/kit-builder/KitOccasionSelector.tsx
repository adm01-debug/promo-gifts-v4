/**
 * KitOccasionSelector — Seletor opcional de ocasião que orienta a montagem
 * do kit. Cada ocasião sugere palavras-chave de filtros e tipo de kit.
 * O componente apenas dispara o callback; a página decide se aplica filtros
 * ou apenas armazena para sugestões contextuais.
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PartyPopper, Gift, CalendarHeart, Trophy, Sparkles, RefreshCw, X } from 'lucide-react';

export type Occasion = 'birthday' | 'event' | 'reactivation' | 'vip' | 'welcome' | 'year-end';

export interface OccasionMeta {
  id: Occasion;
  label: string;
  icon: typeof Gift;
  description: string;
  suggestedKitType: 'montado' | 'original' | 'simples';
  itemKeywords: string[];
  boxKeywords: string[];
}

export const OCCASIONS: OccasionMeta[] = [
  {
    id: 'welcome',
    label: 'Boas-vindas',
    icon: Gift,
    description: 'Onboarding de novos colaboradores ou clientes.',
    suggestedKitType: 'montado',
    itemKeywords: ['caderno', 'caneta', 'garrafa', 'mochila', 'crachá'],
    boxKeywords: ['onboarding', 'kraft', 'rígida'],
  },
  {
    id: 'year-end',
    label: 'Fim de ano',
    icon: PartyPopper,
    description: 'Confraternização, presentes corporativos de dezembro.',
    suggestedKitType: 'montado',
    itemKeywords: ['vinho', 'taça', 'panettone', 'chocolate', 'bolsa térmica'],
    boxKeywords: ['premium', 'natal', 'rígida'],
  },
  {
    id: 'event',
    label: 'Evento',
    icon: Sparkles,
    description: 'Feiras, lançamentos, convenções.',
    suggestedKitType: 'simples',
    itemKeywords: ['squeeze', 'caneta', 'crachá', 'sacola', 'bloco'],
    boxKeywords: ['sacola', 'envelope'],
  },
  {
    id: 'birthday',
    label: 'Aniversário',
    icon: CalendarHeart,
    description: 'Aniversariantes do mês, datas especiais.',
    suggestedKitType: 'montado',
    itemKeywords: ['caneca', 'chocolate', 'cartão'],
    boxKeywords: ['presente', 'rígida'],
  },
  {
    id: 'vip',
    label: 'Cliente VIP',
    icon: Trophy,
    description: 'Clientes estratégicos, alto valor agregado.',
    suggestedKitType: 'montado',
    itemKeywords: ['couro', 'whisky', 'caneta premium', 'agenda'],
    boxKeywords: ['premium', 'madeira', 'luxo'],
  },
  {
    id: 'reactivation',
    label: 'Reativação',
    icon: RefreshCw,
    description: 'Reconquista de clientes inativos.',
    suggestedKitType: 'simples',
    itemKeywords: ['cartão', 'chocolate', 'voucher'],
    boxKeywords: ['envelope', 'kraft'],
  },
];

interface KitOccasionSelectorProps {
  value: Occasion | null;
  onChange: (occasion: Occasion | null) => void;
  className?: string;
}

export function KitOccasionSelector({ value, onChange, className }: KitOccasionSelectorProps) {
  const [expanded, setExpanded] = useState(value === null);
  const selected = OCCASIONS.find((o) => o.id === value) ?? null;

  if (!expanded && selected) {
    const Icon = selected.icon;
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Badge variant="outline" className="gap-1.5 border-primary px-2 py-1 text-primary">
          <Icon className="h-3.5 w-3.5" />
          Ocasião: {selected.label}
        </Badge>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded(true)}>
          Mudar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            onChange(null);
            setExpanded(true);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Para qual ocasião?
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Opcional — orienta sugestões e filtros contextuais.
            </p>
          </div>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setExpanded(false)}
            >
              Fechar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OCCASIONS.map((o) => {
            const Icon = o.icon;
            const active = value === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setExpanded(false);
                }}
                className={cn(
                  'group flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all',
                  'hover:border-primary hover:bg-primary/5',
                  active && 'border-primary bg-primary/10 ring-2 ring-primary/30',
                )}
                aria-pressed={active}
              >
                <Icon
                  className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')}
                />
                <span className="text-sm font-medium">{o.label}</span>
                <span className="line-clamp-2 text-[10px] text-muted-foreground">
                  {o.description}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            onChange(null);
            setExpanded(false);
          }}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Pular esta etapa
        </button>
      </CardContent>
    </Card>
  );
}
