/**
 * EditorHero — bloco premium no topo do editor.
 *
 * Compõe:
 *  - Breadcrumb + título editável visualmente (h1 continua)
 *  - Chip do template ativo (nome + produtos/página + fonte)
 *  - Popover "Trocar template" com grid inline de cards (sem miniaturas)
 *
 * Sem miniaturas: o preview real vive só na sidebar direita. A remoção
 * das thumbs neste componente (hero + popover) foi solicitada pelo PO
 * para reduzir ruído visual e evitar duplicidade com a `PreviewSidebar`.
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
import { getTemplate, listTemplates } from './templates/TemplateRegistry';

interface Props {
  magazine: Magazine;
  onChangeTemplate: (id: MagazineTemplateId) => void;
}

const FAMILY_LABEL: Record<'catalog' | 'corporate' | 'editorial', string> = {
  editorial: 'Editorial',
  catalog: 'Catálogo',
  corporate: 'Corporativo',
};

export function EditorHero({ magazine, onChangeTemplate }: Props) {
  const [open, setOpen] = useState(false);
  const active = getTemplate(magazine.templateId);
  const all = listTemplates();

  return (
    <section
      data-testid="editor-hero"
      aria-label="Cabeçalho do editor"
      className="mb-4"
    >
      <div className="py-2">
        <div className="min-w-0">
          <nav
            data-testid="magazine-editor-breadcrumb"
            aria-label="Trilha"
            className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link to="/magazine" className="hover:text-foreground">
              Magazines
            </Link>
            <span aria-hidden>/</span>
            <span className="truncate" aria-current="page">
              Editor
            </span>
          </nav>

          <div
            data-testid="magazine-hero-title-row"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4"
          >
            <h1
              data-testid="page-title-magazine-editor"
              className="line-clamp-2 font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl"
            >
              {magazine.title || 'Nova revista'}
            </h1>

            {/* Chip do template + swap inline — alinhados ao título */}
            <div
              data-testid="magazine-template-chip"
              className="inline-flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-2 pr-3 text-xs"
              role="group"
              aria-label={`Template ativo: ${active.name}, ${FAMILY_LABEL[active.family]}, ${active.productsPerPage} por página`}
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
                  data-testid="magazine-template-swap-trigger"
                  className="h-8 gap-1.5 text-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label="Trocar template da revista"
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  aria-controls="magazine-template-swap-popover"
                >
                  Trocar template
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      open && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                id="magazine-template-swap-popover"
                align="start"
                sideOffset={8}
                aria-labelledby="magazine-template-swap-heading"
                className="w-[min(680px,calc(100vw-2rem))] p-3"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <p
                    id="magazine-template-swap-heading"
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
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
                        aria-label={`${t.name}, ${FAMILY_LABEL[t.family]}, ${t.productsPerPage} por página${selected ? ' (selecionado)' : ''}`}
                        onClick={() => {
                          onChangeTemplate(t.id);
                          setOpen(false);
                        }}
                        className={cn(
                          'group relative flex items-start gap-2 rounded-md border bg-card p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          selected
                            ? 'border-primary ring-2 ring-primary/40'
                            : 'hover:border-primary/60',
                        )}
                      >
                        <Layers
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0',
                            selected ? 'text-primary' : 'text-muted-foreground',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <span className="block truncate text-xs font-semibold">
                            {t.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
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
                        {selected && (
                          <span
                            className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
                            aria-hidden
                          >
                            <Check className="h-2.5 w-2.5" aria-hidden />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {magazine.subtitle && (
            <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">
              {magazine.subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
