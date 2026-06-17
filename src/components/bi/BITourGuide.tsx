/**
 * BITourGuide — tour guiado de 5 passos na primeira visita ao BI.
 * Implementação leve in-house (sem react-joyride) com overlay + tooltip
 * ancorado em data-attrs (`data-tour="..."`). Persiste conclusão em localStorage.
 */
import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'bi.tour.completed.v1';

interface Step {
  selector: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    selector: '[data-tour="health-hero"]',
    title: 'Health Score',
    description:
      'Diagnóstico 0-100 do cliente combinando recência, frequência, ticket, crescimento e share-of-wallet.',
  },
  {
    selector: '[data-tour="churn-banner"]',
    title: 'Risco de churn',
    description:
      'Aparece quando há sinais de perda. Sugere abordagem prioritária com canal e janela ideal.',
  },
  {
    selector: '[data-tour="orders-timeline"]',
    title: 'Linha do tempo',
    description: 'Pedidos recentes com sparkline, tendência e marcação de pedidos atípicos (±2σ).',
  },
  {
    selector: '[data-tour="seasonality"]',
    title: 'Sazonalidade',
    description:
      'Mês a mês × setor + projeção 6 meses. Identifica próxima janela ideal para abordagem.',
  },
  {
    selector: '[data-tour="copilot"]',
    title: 'Pergunte ao BI',
    description: 'Copilot conversacional. Pergunte em linguagem natural sobre o cliente.',
  },
];

interface Props {
  /** Quando true, força exibição mesmo se já concluído (modo replay) */
  force?: boolean;
  onClose?: () => void;
}

export function BITourGuide({ force = false, onClose }: Props) {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (force) {
      setActive(true);
      setStepIdx(0);
      return;
    }
    try {
      const done = localStorage.getItem(STORAGE_KEY) === '1';
      if (!done) {
        // Pequeno delay para garantir mount dos targets
        const t = setTimeout(() => setActive(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, [force]);

  const currentStep = STEPS[stepIdx];

  useLayoutEffect(() => {
    if (!active || !currentStep) return;
    const updateRect = () => {
      const el = document.querySelector(currentStep.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect(r);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setRect(null);
      }
    };
    updateRect();
    const t = setTimeout(updateRect, 350); // após scroll
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [active, currentStep, stepIdx]);

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setActive(false);
    onClose?.();
  };

  const next = () => {
    if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
    else finish();
  };
  const prev = () => setStepIdx((i) => Math.max(0, i - 1));

  if (!active || !currentStep) return null;

  // Cálculo da posição do tooltip
  const tooltipStyle: React.CSSProperties = (() => {
    if (!rect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
      };
    }
    const tooltipWidth = 320;
    const margin = 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeBelow = spaceBelow > 220;
    const top = placeBelow ? rect.bottom + margin : rect.top - margin - 200;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));
    return {
      position: 'fixed',
      top: Math.max(margin, top),
      left,
      width: tooltipWidth,
      zIndex: 10000,
    };
  })();

  // Spotlight (recorte) via box-shadow gigante
  const spotlightStyle: React.CSSProperties | null = rect
    ? {
        position: 'fixed',
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        borderRadius: 12,
        boxShadow: '0 0 0 9999px hsl(0 0% 0% / 0.65)',
        pointerEvents: 'none',
        zIndex: 9999,
        transition: 'all 0.3s ease',
      }
    : null;

  return createPortal(
    <>
      {spotlightStyle && <div style={spotlightStyle} aria-hidden="true" />}
      {!rect && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'hsl(0 0% 0% / 0.65)',
            zIndex: 9999,
          }}
        />
      )}
      <div ref={tooltipRef} style={tooltipStyle}>
        <Card className="border-2 border-primary/40 p-4 shadow-2xl">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Passo {stepIdx + 1} de {STEPS.length}
                </div>
                <h4 className="font-display text-sm font-semibold">{currentStep.title}</h4>
              </div>
            </div>
            <button
              onClick={finish}
              aria-label="Fechar tour"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            {currentStep.description}
          </p>
          <div className="mb-3 flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i === stepIdx ? 'bg-primary' : i < stepIdx ? 'bg-primary/40' : 'bg-muted',
                )}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={finish}
              className="text-xs text-muted-foreground"
            >
              Pular
            </Button>
            <div className="flex gap-1">
              {stepIdx > 0 && (
                <Button variant="outline" size="sm" onClick={prev} className="h-8 gap-1">
                  <ChevronLeft className="h-3 w-3" /> Voltar
                </Button>
              )}
              <Button size="sm" onClick={next} className="h-8 gap-1">
                {stepIdx === STEPS.length - 1 ? 'Concluir' : 'Próximo'}
                {stepIdx < STEPS.length - 1 && <ChevronRight className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>,
    document.body,
  );
}

export function resetBITour() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
