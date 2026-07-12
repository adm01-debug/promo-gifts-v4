/**
 * PreviewSidebar — sticky com:
 *  - Thumbs verticais de TODAS as páginas
 *  - Preview grande da página selecionada
 *  - Contador de páginas/produtos
 *  - Botão "Ver todas em nova aba"
 */

import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Magazine, MagazinePage } from '@/types/magazine';
import { MagazinePageRenderer } from './MagazinePageRenderer';

interface Props {
  magazine: Magazine;
  pages: MagazinePage[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  onOpenAll: () => void;
}

function pageLabel(p: MagazinePage): string {
  if (p.kind === 'cover') return 'Capa';
  if (p.kind === 'back-cover') return 'Contracapa';
  if (p.kind === 'section') return `Seção: ${p.sectionTitle ?? '—'}`;
  return `${p.items.length} produto${p.items.length === 1 ? '' : 's'}`;
}

export function PreviewSidebar({ magazine, pages, activeIdx, onSelect, onOpenAll }: Props) {
  const active = pages[activeIdx] ?? pages[0];
  return (
    <Card className="sticky top-4">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Preview {active ? `— ${pageLabel(active)}` : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={onOpenAll} aria-label="Abrir todas as páginas">
            <Eye className="mr-1 h-3.5 w-3.5" /> Ver todas
          </Button>
        </div>

        {active ? (
          <div className="overflow-hidden rounded-lg border">
            <MagazinePageRenderer magazine={magazine} page={active} totalPages={pages.length} fitContainer />
          </div>
        ) : (
          <div className="rounded-lg border p-8 text-center text-xs text-muted-foreground">
            Adicione produtos para gerar o preview.
          </div>
        )}

        {pages.length > 1 && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              Navegar entre páginas
            </div>
            <ScrollArea className="h-[210px]">
              <div className="grid grid-cols-3 gap-2 pr-2">
                {pages.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelect(idx)}
                    className={cn(
                      'group relative overflow-hidden rounded border bg-background text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      idx === activeIdx ? 'ring-2 ring-primary' : 'hover:border-primary/60',
                    )}
                    aria-label={`Ir para página ${idx + 1}: ${pageLabel(p)}`}
                    aria-current={idx === activeIdx ? 'true' : undefined}
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-50">
                      <MagazinePageRenderer magazine={magazine} page={p} totalPages={pages.length} fitContainer />
                    </div>

                    <div className="flex items-center justify-between px-1.5 py-1 text-[10px]">
                      <span className="font-mono">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="truncate text-muted-foreground">{pageLabel(p)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="border-t pt-2 text-xs text-muted-foreground">
          {pages.length} página(s) · {magazine.items.length} produto(s)
        </div>
      </CardContent>
    </Card>
  );
}
