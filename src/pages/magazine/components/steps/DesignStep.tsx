/**
 * Step 4 — Design: galeria dos 12 templates (sem miniaturas) + seletor de
 * categoria (14 tokens Abreez-inspired) que colore o SidebarChrome/PageNumberBadge.
 *
 * A miniatura FIEL (`TemplateThumbnail`) foi removida deste step a pedido do PO:
 * o preview real vive só na `PreviewSidebar` à direita e as miniaturas geravam
 * duplicidade + ruído visual. Cards agora exibem apenas metadados (nome,
 * família, produtos/página, fontes).
 */

import { Check, Layers, LayoutTemplate } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  Magazine,
  MagazineCategory,
  MagazineTemplateId,
} from '@/types/magazine';
import { templatesByFamily } from '../templates/TemplateRegistry';
import { MAGAZINE_CATEGORY_META } from '../templates/chrome';

interface Props {
  magazine: Magazine;
  onChange: (id: MagazineTemplateId) => void;
  onCategoryChange: (category: MagazineCategory) => void;
}

const FAMILY_LABELS: Record<'catalog' | 'corporate' | 'editorial', string> = {
  editorial: 'Editorial (luxo)',
  catalog: 'Catálogo comercial',
  corporate: 'Corporativo / B2B',
};

const FAMILY_HINT: Record<'catalog' | 'corporate' | 'editorial', string> = {
  editorial: 'Fotografia dominante, 1–5 produtos por página. Ideal para lançamentos.',
  catalog: 'Densidade alta, foco em preço e código. Ideal para pedidos.',
  corporate: 'Marca do cliente em destaque, layouts B2B sóbrios.',
};

const CATEGORY_LIST: MagazineCategory[] = [
  'technology',
  'drinkwares',
  'general',
  'wearables',
  'pins',
  'awards',
  'packaging',
  'stationery',
  'bags',
  'clocks',
  'signs',
  'id',
  'giftsets',
  'customized',
];

export function DesignStep({ magazine, onChange, onCategoryChange }: Props) {
  const grouped = templatesByFamily();
  const currentCategory = magazine.branding.category ?? 'technology';

  return (
    <div className="space-y-8">
      {/* Seletor de categoria semântica — obrigatório (Abreez SSOT) */}
      <section aria-labelledby="magazine-category-picker">
        <div className="mb-3 flex items-baseline justify-between">
          <h3
            id="magazine-category-picker"
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Categoria da revista
          </h3>
          <span className="text-xs text-muted-foreground">
            Define a cor da sidebar vertical, do número de página e dos rótulos.
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Categoria da revista"
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7"
        >
          {CATEGORY_LIST.map((cat) => {
            const meta = MAGAZINE_CATEGORY_META[cat];
            const selected = currentCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onCategoryChange(cat)}
                className={cn(
                  'group flex flex-col items-center gap-1.5 rounded-md border p-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  selected ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'hover:border-primary/40',
                )}
              >
                <span
                  aria-hidden
                  className="h-8 w-full rounded-sm ring-1 ring-black/5"
                  style={{ background: meta.hex }}
                />
                <span className="font-medium leading-tight text-center">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((family) => (
        <section key={family} aria-labelledby={`family-${family}`}>
          <div className="mb-3 flex items-baseline justify-between">
            <h3
              id={`family-${family}`}
              className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            >
              {FAMILY_LABELS[family]}
            </h3>
            <span className="text-xs text-muted-foreground">{FAMILY_HINT[family]}</span>
          </div>
          <div
            role="radiogroup"
            aria-labelledby={`family-${family}`}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {grouped[family].map((t) => {
              const selected = magazine.templateId === t.id;
              return (
                <Card
                  key={t.id}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  onClick={() => onChange(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChange(t.id);
                    }
                  }}
                  className={cn(
                    'cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    selected ? 'border-primary ring-2 ring-primary/40' : 'hover:border-primary/60',
                  )}
                  data-testid={`magazine-template-${t.id}`}
                >
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers
                          className={cn(
                            'h-4 w-4 shrink-0',
                            selected ? 'text-primary' : 'text-muted-foreground',
                          )}
                          aria-hidden
                        />
                        <span className="truncate text-sm font-semibold">{t.name}</span>
                      </div>
                      {selected && (
                        <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Selecionado" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {t.productsPerPage} / pág
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {t.fonts.heading}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
