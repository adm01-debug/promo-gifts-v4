/**
 * PreviewSidebar — sticky com:
 *  - Thumbs verticais de TODAS as páginas
 *  - Preview grande da página selecionada
 *  - Zoom (Fit / 100% / 150% / 200%) com scroll interno
 *  - Highlight da página que contém o item em hover no LayoutStep
 *  - Contador de páginas/produtos
 *  - Botão "Ver todas em nova aba"
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
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
  /** Onda 1 — item destacado no LayoutStep para realçar a página correspondente. */
  highlightedItemId?: string | null;
  /** 'sidebar' (default, sticky) ou 'drawer' (fluido, sem sticky). */
  variant?: 'sidebar' | 'drawer';
}

/** Níveis de zoom: 1 = fit-to-width (comportamento padrão do renderer). */
const ZOOM_LEVELS = [1, 1.5, 2, 3] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

function pageLabel(p: MagazinePage): string {
  if (p.kind === 'cover') return 'Capa';
  if (p.kind === 'back-cover') return 'Contracapa';
  if (p.kind === 'section') return `Seção: ${p.sectionTitle ?? '—'}`;
  return `${p.items.length} produto${p.items.length === 1 ? '' : 's'}`;
}

export function PreviewSidebar({
  magazine,
  pages,
  activeIdx,
  onSelect,
  onOpenAll,
  highlightedItemId,
  variant = 'sidebar',
}: Props) {
  const [zoom, setZoom] = useState<ZoomLevel>(1);
  const active = pages[activeIdx] ?? pages[0];

  const highlightedPageIdx = useMemo(() => {
    if (!highlightedItemId) return -1;
    return pages.findIndex((p) => p.items.some((it) => it.id === highlightedItemId));
  }, [highlightedItemId, pages]);

  const canZoomIn = zoom < ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  const canZoomOut = zoom > ZOOM_LEVELS[0];

  const stepZoom = useCallback((dir: 1 | -1) => {
    setZoom((cur) => {
      const idx = ZOOM_LEVELS.indexOf(cur);
      return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, idx + dir))];
    });
  }, []);

  const resetZoom = useCallback(() => setZoom(1), []);

  /**
   * Atalhos globais de zoom (`+`/`=`, `-`, `0`).
   *
   * - Ignoramos quando o foco está em campo editável (input/textarea/select/
   *   contentEditable) — assim não sequestramos digitação em outras partes do
   *   editor (título, form fields, etc.).
   * - Ignoramos com modificadores (Ctrl/Cmd/Alt) para não colidir com o zoom
   *   nativo do navegador.
   * - `preventDefault` só quando de fato tratamos a tecla, preservando Tab e
   *   demais navegação por teclado do editor.
   */
  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditable(e.target)) return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        stepZoom(1);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        stepZoom(-1);
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepZoom, resetZoom]);


  return (
    <Card className={cn(variant === 'sidebar' && 'sticky top-4', variant === 'drawer' && 'border-0 shadow-none')}>
      <CardContent className={cn('space-y-3 p-3', variant === 'drawer' && 'p-0')}>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Preview {active ? `— ${pageLabel(active)}` : ''}
          </span>
          <div
            role="group"
            aria-label="Controles de zoom do preview"
            className="flex items-center gap-0.5"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => stepZoom(-1)}
              disabled={!canZoomOut}
              aria-label="Diminuir zoom"
              aria-keyshortcuts="-"
              aria-controls="magazine-preview-zoom-value"
              title="Diminuir zoom (−)"
            >
              <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <button
              id="magazine-preview-zoom-value"
              type="button"
              onClick={resetZoom}
              className="min-w-[46px] rounded px-1 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Zoom atual: ${Math.round(zoom * 100)} por cento. Clique para ajustar à largura`}
              aria-keyshortcuts="0"
              role="spinbutton"
              aria-valuemin={Math.round(ZOOM_LEVELS[0] * 100)}
              aria-valuemax={Math.round(ZOOM_LEVELS[ZOOM_LEVELS.length - 1] * 100)}
              aria-valuenow={Math.round(zoom * 100)}
              aria-valuetext={zoom === 1 ? 'Ajustar à largura' : `${Math.round(zoom * 100)} por cento`}
              title="Ajustar à largura (0)"
            >
              {zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => stepZoom(1)}
              disabled={!canZoomIn}
              aria-label="Aumentar zoom"
              aria-keyshortcuts="+"
              aria-controls="magazine-preview-zoom-value"
              title="Aumentar zoom (+)"
            >
              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>


            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenAll}
              aria-label="Abrir todas as páginas em nova aba"
              className="ml-1"
            >
              <Eye className="mr-1 h-3.5 w-3.5" /> Ver todas
            </Button>
          </div>
        </div>

        {active ? (
          <div
            className={cn(
              'overflow-auto rounded-lg border bg-neutral-100',
              'max-h-[55vh] sm:max-h-[65vh] xl:max-h-[70vh]',
            )}
          >
            {/*
              O renderer usa fit-to-width no wrapper. Ao aumentar a largura do
              wrapper para `zoom * 100%`, o ResizeObserver interno recalcula e
              escala o conteúdo — sem duplicar transforms.
            */}
            <div style={{ width: `${zoom * 100}%` }}>
              <MagazinePageRenderer
                magazine={magazine}
                page={active}
                totalPages={pages.length}
                fitContainer
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border p-8 text-center text-xs text-muted-foreground">
            Adicione produtos para gerar o preview.
          </div>
        )}

        {pages.length > 1 && (
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Navegar entre páginas</span>
              {zoom !== 1 && (
                <button
                  type="button"
                  onClick={resetZoom}
                  className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted"
                >
                  <Maximize2 className="h-3 w-3" /> Fit
                </button>
              )}
            </div>
            <ScrollArea className="h-[210px]">
              <div className="grid grid-cols-2 gap-2 pr-2 sm:grid-cols-3">
                {pages.map((p, idx) => {
                  const isHighlighted = idx === highlightedPageIdx;
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelect(idx)}
                      className={cn(
                        'group relative overflow-hidden rounded border bg-background text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isActive && 'ring-2 ring-primary',
                        !isActive && isHighlighted && 'ring-2 ring-amber-500',
                        !isActive && !isHighlighted && 'hover:border-primary/60',
                      )}
                      aria-label={`Ir para página ${idx + 1}: ${pageLabel(p)}`}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-50">
                        <MagazinePageRenderer magazine={magazine} page={p} totalPages={pages.length} fitContainer />
                      </div>

                      <div className="flex items-center justify-between px-1.5 py-1 text-[10px]">
                        <span className="font-mono">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="truncate text-muted-foreground">{pageLabel(p)}</span>
                      </div>
                    </button>
                  );
                })}
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
