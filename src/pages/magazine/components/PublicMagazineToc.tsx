/**
 * PublicMagazineToc — drawer com miniaturas de todas as páginas para
 * navegação rápida no viewer público. Baseado no Sheet lateral (shadcn).
 *
 * A11y: cada thumb é um `<button>` com aria-current="page" quando ativo.
 * ul não precisa de role="list" explícito — o elemento já carrega o papel
 * implícito (jsx-a11y/no-redundant-roles).
 */

import { memo } from 'react';
import { BookmarkCheck } from 'lucide-react';
import type { Magazine, MagazinePage } from '@/types/magazine';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MagazinePageRenderer } from './MagazinePageRenderer';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  magazine: Magazine;
  pages: MagazinePage[];
  currentIndex: number;
  onGo: (index: number) => void;
  bookmarks?: Set<number>;
}

function pageLabel(p: MagazinePage): string {
  if (p.kind === 'cover') return 'Capa';
  if (p.kind === 'back-cover') return 'Contracapa';
  if (p.kind === 'section') return p.sectionTitle ?? 'Seção';
  return `${p.items.length} produto${p.items.length === 1 ? '' : 's'}`;
}

export const PublicMagazineToc = memo(({
  open,
  onOpenChange,
  magazine,
  pages,
  currentIndex,
  onGo,
  bookmarks,
}: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] max-w-[92vw] overflow-y-auto bg-neutral-950 text-white">
        <SheetHeader>
          <SheetTitle className="text-white">Sumário</SheetTitle>
          <p className="text-xs text-white/60">
            {pages.length} páginas · toque para pular
          </p>
        </SheetHeader>

        <ul className="mt-4 grid grid-cols-2 gap-3 pb-8">
          {pages.map((p) => {
            const active = p.index === currentIndex;
            const marked = bookmarks?.has(p.index) ?? false;
            return (
              <li key={p.index}>
                <button
                  type="button"
                  onClick={() => {
                    onGo(p.index);
                    onOpenChange(false);
                  }}
                  aria-current={active ? 'page' : undefined}
                  aria-label={`Ir para página ${p.index + 1}: ${pageLabel(p)}`}
                  className={cn(
                    'group flex w-full flex-col overflow-hidden rounded-md border transition',
                    active
                      ? 'border-white ring-2 ring-white'
                      : 'border-white/10 hover:border-white/40',
                  )}
                >
                  <div className="relative bg-white">
                    <MagazinePageRenderer
                      magazine={magazine}
                      page={p}
                      totalPages={pages.length}
                      fitContainer
                    />
                    {marked && (
                      <span
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-neutral-900 shadow"
                        aria-label="Página marcada"
                        title="Página marcada"
                      >
                        <BookmarkCheck className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-white/5 px-2 py-1.5 text-[10px] uppercase tracking-widest text-white/80">
                    <span className="tabular-nums">
                      {String(p.index + 1).padStart(3, '0')}
                    </span>
                    <span className="truncate opacity-80">{pageLabel(p)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
});