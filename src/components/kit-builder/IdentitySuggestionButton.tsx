/**
 * IdentitySuggestionButton — Bloco discreto que ativa sugestão IA de
 * tag+cor+ícone. Usado quando a identidade está vazia ou genérica.
 */
import { useState } from 'react';
import * as Lucide from 'lucide-react';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useKitIdentitySuggestion } from '@/hooks/kit-builder';
import type { KitIdentity } from '@/lib/kit-builder';

interface Props {
  kitName: string;
  items: Array<{ name?: string; sku?: string }>;
  description?: string | null;
  current?: KitIdentity;
  onApply: (identity: Partial<KitIdentity>) => void;
}

function getIcon(name: string) {
  const I = (Lucide as unknown as Record<string, Lucide.LucideIcon>)[name];
  return I ?? Lucide.Package;
}

export function IdentitySuggestionButton({ kitName, items, description, current, onApply }: Props) {
  const { suggest, suggestion, isLoading, clear } = useKitIdentitySuggestion();
  const [dismissed, setDismissed] = useState(false);

  const hasIdentity = !!(current?.tag && current?.color && current?.icon);
  if (hasIdentity || dismissed) return null;
  if (!kitName.trim() && items.length === 0) return null;

  if (!suggestion) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5 text-primary hover:text-primary"
        onClick={() => suggest({ name: kitName, items, description })}
        disabled={isLoading}
      >
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {isLoading ? 'Pensando...' : 'Sugerir identidade'}
      </Button>
    );
  }

  const Icon = getIcon(suggestion.icon);
  return (
    <Card className="border-primary/40 bg-primary/5 animate-fade-in">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${suggestion.color}22`, color: suggestion.color }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <Badge style={{ backgroundColor: suggestion.color, color: 'white' }} className="text-[10px]">
            {suggestion.tag}
          </Badge>
          {suggestion.rationale && (
            <p className="text-[10px] text-muted-foreground line-clamp-1 flex-1">
              {suggestion.rationale}
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => {
              onApply({ tag: suggestion.tag, color: suggestion.color, icon: suggestion.icon });
              clear();
              setDismissed(true);
            }}
          >
            <Check className="h-3 w-3 mr-1" /> Aplicar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => { clear(); setDismissed(true); }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
