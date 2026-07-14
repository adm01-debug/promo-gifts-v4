/**
 * EditorHero — bloco premium no topo do editor.
 *
 * Compõe:
 *  - Miniatura FIEL da capa (TemplateThumbnail com magazine real quando há itens)
 *  - Breadcrumb + título editável visualmente (h1 continua)
 *  - Chip do template ativo (nome + produtos/página + fonte)
 *  - Popover "Trocar template" com grid inline de miniaturas (todos os templates)
 *
 * Não altera dados nem regras — apenas apresentação. `onChange` já
 * é `editor.setTemplate` no editor.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Magazine, MagazineTemplateId } from '@/types/magazine';
import { TemplateThumbnail } from './TemplateThumbnail';
import { getTemplate, listTemplates } from './templates/TemplateRegistry';

interface Props {
  magazine: Magazine;
  onChangeTemplate: (id: MagazineTemplateId) => void;
}

const FAMILY_LABEL: Record<'editorial' | 'catalog' | 'corporate', string> = {
  editorial: 'Editorial',
  catalog: 'Catálogo',
  corporate: 'Corporativo',
};

export function EditorHero({ magazine, onChangeTemplate }: Props) {
  const [open, setOpen] = useState(false);
  const active = getTemplate(magazine.templateId);
  const source = magazine.items.length > 0 ? magazine : undefined;
  const all = listTemplates();

  return (
    <section
      aria-label="Cabeçalho do editor"
      className="mb-4 overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5">
        {/* Miniatura real da capa */}
        <div className="w-full max-w-[132px] shrink-0 sm:w-[132px]">
          <div className="overflow-hidden rounded-lg ring-1 ring-border/60 shadow-sm">
            <TemplateThumbnail
              templateId={magazine.templateId}
              sourceMagazine={source}
            />
          </div>
        </div>

        {/* Metadados */}
        <div className="min-w-0 flex-1">
          <nav
            aria-label="Trilha"
            className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link to="/magazine" className="hover:text-foreground">
              Magazines
            </Link>
            <span aria-hidden>/</span>
            <span className="truncate">Editor</span>
          </nav>

          <h1
            data-testid="page-title-magazine-editor"
            className="line-clamp-2 font-display text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {magazine.title || 'Nova revista'}
          </h1>

          {magazine.subtitle && (
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {magazine.subtitle}
            </p>
          )}

          {/* Chip do template + swap inline */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-2 pr-3 text-xs"
              aria-label="Template ativo"
            >
              <Layers className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="font-semibold">{active.name}</span>
              <span className="text-muted-foreground" aria-hidden>
                ·
              </span>
              <span className="text-muted-foreground">
                {FAMILY_LABEL[active.family]}
              </span>
              <span className="text-muted-foreground" aria-hidden>
                ·
              </span>
              <span className="text-muted-foreground">
                {active.productsPerPage}/pág
              </span>
            </div>

            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  aria-label="Trocar template da revista"
                >
                  Trocar template
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={8}
                className="w-[min(680px,calc(100vw-2rem))] p-3"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Trocar template
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    Aplica instantaneamente — sem perder produtos.
                  </span>
                </div>
                <div
                  role="radiogroup"
                  aria-label="Escolher template"
                  className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4"
                >
                  {all.map((t) => {
                    const selected = t.id === magazine.templateId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          onChangeTemplate(t.id);
                          setOpen(false);
                        }}
                        className={cn(
                          'group overflow-hidden rounded-md border bg-card text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          selected
                            ? 'border-primary ring-2 ring-primary/40'
                            : 'hover:border-primary/60',
                        )}
                      >
                        <div className="relative">
                          <TemplateThumbnail
                            templateId={t.id}
                            sourceMagazine={source}
                          />
                          {selected && (
                            <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                              <Check className="h-3 w-3" aria-hidden />
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 p-2">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-xs font-semibold">
                              {t.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {FAMILY_LABEL[t.family]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {t.productsPerPage}/pág
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </section>
  );
}
