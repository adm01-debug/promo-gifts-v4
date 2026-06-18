/**
 * EventsMultiSelect — Onda 12 #6
 * Multi-select agrupado por categoria com busca, "todos do grupo" e suporte a eventos legacy.
 */
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, Search, X } from 'lucide-react';
import {
  WEBHOOK_EVENTS_CATALOG,
  ALL_KNOWN_EVENTS,
  isLegacyEvent,
} from '@/lib/webhook-events-catalog';
import { cn } from '@/lib/utils';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

export function EventsMultiSelect({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(value), [value]);
  const legacy = useMemo(() => value.filter(isLegacyEvent), [value]);

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next]);
  };

  const toggleGroup = (groupKeys: string[], allOn: boolean) => {
    const next = new Set(selected);
    for (const k of groupKeys) {
      if (allOn) next.delete(k);
      else next.add(k);
    }
    onChange([...next]);
  };

  const removeLegacy = (key: string) => {
    onChange(value.filter((v) => v !== key));
  };

  const q = query.toLowerCase().trim();
  const groups = useMemo(() => {
    return WEBHOOK_EVENTS_CATALOG.map((g) => ({
      ...g,
      events: q
        ? g.events.filter(
            (e) =>
              e.key.toLowerCase().includes(q) ||
              e.label.toLowerCase().includes(q) ||
              e.description.toLowerCase().includes(q),
          )
        : g.events,
    })).filter((g) => g.events.length > 0);
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar evento…"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
        {groups.map((g) => {
          const groupKeys = g.events.map((e) => e.key);
          const allOn = groupKeys.every((k) => selected.has(k));
          const someOn = groupKeys.some((k) => selected.has(k));
          return (
            <div key={g.category} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                  {someOn && (
                    <span className="ml-1.5 text-primary">
                      ({groupKeys.filter((k) => selected.has(k)).length}/{groupKeys.length})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleGroup(groupKeys, allOn)}
                  className="text-[10px] text-primary hover:underline"
                >
                  {allOn ? 'Limpar' : 'Selecionar todos'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {g.events.map((e) => {
                  const on = selected.has(e.key);
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => toggle(e.key)}
                      title={e.description}
                      className={cn(
                        'flex items-center gap-1.5 rounded border px-2 py-1.5 text-left text-[11px] transition-colors',
                        on
                          ? 'border-primary/40 bg-primary/10 text-foreground'
                          : 'border-border bg-background hover:bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border',
                          on ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                        )}
                      >
                        {on && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-mono">{e.key}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Nenhum evento corresponde à busca.
          </div>
        )}
      </div>

      {legacy.length > 0 && (
        <div className="space-y-1.5 border-t pt-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Eventos legacy ({legacy.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {legacy.map((k) => (
              <Badge
                key={k}
                variant="outline"
                className="gap-1 border-warning/20 bg-warning/10 text-[10px] text-warning"
              >
                <span className="font-mono">{k}</span>
                <button
                  type="button"
                  onClick={() => removeLegacy(k)}
                  aria-label={`Remover ${k}`}
                  className="hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Eventos fora do catálogo. Mantidos para compatibilidade.
          </p>
        </div>
      )}

      <div className="border-t pt-1 text-[10px] text-muted-foreground">
        {selected.size} evento{selected.size !== 1 ? 's' : ''} selecionado
        {selected.size !== 1 ? 's' : ''}
        {' · '}
        {ALL_KNOWN_EVENTS.length} no catálogo SSOT.
      </div>
    </div>
  );
}
