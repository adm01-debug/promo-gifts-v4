/**
 * TemplatePreviewDialog — Preview em tamanho real (escala responsiva).
 *
 * Renderiza o template 1920×2716 dentro de um dialog que ajusta a escala
 * para caber na viewport, mantendo proporção A4.
 */

import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TemplateEntry } from '../components/templates/TemplateRegistry';
import { buildMockMagazine, buildMockPage } from './mockMagazine';

const PAGE_W = 1920;
const PAGE_H = 2716;

interface Props {
  entry: TemplateEntry | null;
  onOpenChange: (open: boolean) => void;
  onUse: (id: TemplateEntry['id']) => void;
  useLabel: string;
}

function useResponsiveScale(open: boolean) {
  const [scale, setScale] = useState(0.35);

  useEffect(() => {
    if (!open) return;
    const compute = () => {
      // deixa margem para header + padding do dialog
      const maxW = Math.min(window.innerWidth - 96, 1400);
      const maxH = window.innerHeight - 200;
      const s = Math.min(maxW / PAGE_W, maxH / PAGE_H);
      setScale(Math.max(0.1, s));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [open]);

  return scale;
}

export function TemplatePreviewDialog({ entry, onOpenChange, onUse, useLabel }: Props) {
  const open = entry != null;
  const scale = useResponsiveScale(open);

  const magazine = useMemo(() => (entry ? buildMockMagazine(entry.id) : null), [entry]);
  const page = useMemo(() => (entry ? buildMockPage(entry.id) : null), [entry]);

  if (!entry || !magazine || !page) {
    return (
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const Template = entry.Component;
  const scaledW = PAGE_W * scale;
  const scaledH = PAGE_H * scale;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] p-0 sm:max-w-[min(1500px,95vw)]"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="font-display text-xl">{entry.name}</DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {entry.family}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {entry.productsPerPage} / página
                </Badge>
                <span className="text-xs text-muted-foreground">{entry.description}</span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => onUse(entry.id)}
              data-testid="template-preview-use"
            >
              <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
              {useLabel}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-center overflow-auto bg-muted/40 p-6">
          <div
            className="relative shadow-2xl"
            style={{ width: scaledW, height: scaledH }}
            aria-label={`Preview do template ${entry.name}`}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 origin-top-left"
              style={{
                width: PAGE_W,
                height: PAGE_H,
                transform: `scale(${scale})`,
              }}
            >
              <Template magazine={magazine} page={page} totalPages={1} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
