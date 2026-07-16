/**
 * TemplateCard — Card individual da galeria de templates.
 *
 * Renderiza o template REAL em escala reduzida (1920×2716 → ~400×566)
 * usando `transform: scale`. Adia a montagem até estar visível via
 * IntersectionObserver — evita renderizar 12 templates de uma vez.
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TemplateEntry } from '../components/templates/TemplateRegistry';
import { buildMockMagazine, buildMockPage } from './mockMagazine';

interface Props {
  entry: TemplateEntry;
  onPreview: (id: TemplateEntry['id']) => void;
  onUse: (id: TemplateEntry['id']) => void;
  useLabel: string;
}

const THUMB_WIDTH = 400;
const THUMB_HEIGHT = 566; // ≈ proporção A4 (1920×2716 → 0.2083)
const SCALE = THUMB_WIDTH / 1920;

const FAMILY_LABEL: Record<TemplateEntry['family'], string> = {
  editorial: 'Editorial',
  catalog: 'Catálogo',
  corporate: 'Corporativo',
};

function TemplateCardImpl({ entry, onPreview, onUse, useLabel }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const magazine = useMemo(() => buildMockMagazine(entry.id), [entry.id]);
  const page = useMemo(() => buildMockPage(entry.id), [entry.id]);
  const Template = entry.Component;

  return (
    <div
      ref={rootRef}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
      data-testid={`template-card-${entry.id}`}
    >
      {/* Miniatura */}
      <button
        type="button"
        aria-label={`Ver o template ${entry.name} em tamanho real`}
        onClick={() => onPreview(entry.id)}
        className="relative block overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{ width: '100%', aspectRatio: `${THUMB_WIDTH} / ${THUMB_HEIGHT}` }}
      >
        {visible ? (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 origin-top-left"
            style={{
              width: 1920,
              height: 2716,
              transform: `scale(${SCALE})`,
            }}
          >
            <Template magazine={magazine} page={page} totalPages={1} />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Carregando preview…
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-foreground/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow">
            <Eye className="h-4 w-4" aria-hidden />
            Ver em tamanho real
          </span>
        </div>
      </button>

      {/* Meta */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold">{entry.name}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {entry.description}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {FAMILY_LABEL[entry.family]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {entry.productsPerPage} {entry.productsPerPage === 1 ? 'produto' : 'produtos'} / página
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px]"
            title={`Fontes: ${entry.fonts.heading} + ${entry.fonts.body}`}
          >
            {entry.fonts.heading}
          </Badge>
          <div className="flex items-center gap-1" aria-label="Paleta padrão">
            {(['primary', 'secondary', 'text'] as const).map((k) => (
              <span
                key={k}
                aria-hidden
                className={cn('h-4 w-4 rounded-full ring-1 ring-border')}
                style={{ background: entry.defaultColors[k] }}
                title={`${k}: ${entry.defaultColors[k]}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onPreview(entry.id)}
            data-testid={`template-preview-${entry.id}`}
          >
            <Eye className="mr-1.5 h-4 w-4" aria-hidden />
            Preview
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onUse(entry.id)}
            data-testid={`template-use-${entry.id}`}
          >
            <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
            {useLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const TemplateCard = memo(TemplateCardImpl);
