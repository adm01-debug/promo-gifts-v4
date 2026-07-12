/**
 * Step 4 — Design: galeria dos 10 templates agrupados por família.
 */

import { Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Magazine, MagazineTemplateId } from '@/types/magazine';
import { templatesByFamily } from '../templates/TemplateRegistry';

interface Props {
  magazine: Magazine;
  onChange: (id: MagazineTemplateId) => void;
}

const FAMILY_LABELS: Record<'editorial' | 'catalog' | 'corporate', string> = {
  editorial: 'Editorial (luxo)',
  catalog: 'Catálogo comercial',
  corporate: 'Corporativo / B2B',
};

export function DesignStep({ magazine, onChange }: Props) {
  const grouped = templatesByFamily();
  return (
    <div className="space-y-6">
      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((family) => (
        <section key={family}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {FAMILY_LABELS[family]}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {grouped[family].map((t) => {
              const selected = magazine.templateId === t.id;
              return (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition ${
                    selected ? 'border-primary ring-2 ring-primary/40' : 'hover:border-primary/60'
                  }`}
                  onClick={() => onChange(t.id)}
                  data-testid={`magazine-template-${t.id}`}
                >
                  <div
                    className="aspect-[3/4] w-full overflow-hidden rounded-t-lg"
                    style={{
                      background: `linear-gradient(135deg, ${t.defaultColors.primary}, ${t.defaultColors.secondary})`,
                    }}
                  >
                    <div className="flex h-full flex-col items-center justify-center p-6 text-white">
                      <div
                        className="mb-3 text-4xl leading-none"
                        style={{ fontFamily: `'${t.fonts.heading}', serif` }}
                      >
                        Aa
                      </div>
                      <div
                        className="text-center text-xs uppercase tracking-widest opacity-80"
                        style={{ fontFamily: `'${t.fonts.body}', sans-serif` }}
                      >
                        {t.name}
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-1 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{t.name}</span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    <div className="text-[10px] text-muted-foreground">
                      {t.productsPerPage} produto{t.productsPerPage === 1 ? '' : 's'} / página
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
