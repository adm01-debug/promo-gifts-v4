/**
 * TrendsTour — onboarding leve de primeira visita ao módulo de Tendências.
 * Usa localStorage para evitar repetir.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'trends-tour-seen-v1';

const STEPS = [
  {
    title: 'Bem-vindo à Análise de Tendências',
    body: 'Aqui você descobre o que está crescendo, o que está caindo e onde estão suas próximas oportunidades.',
  },
  {
    title: 'Insights da IA',
    body: 'No topo, a IA resume o que mudou, por quê e qual sua próxima ação recomendada.',
  },
  {
    title: 'KPIs com deltas %',
    body: 'Cada cartão mostra a variação versus o período anterior — verde sobe, vermelho desce.',
  },
  {
    title: 'Funil & Demanda Reprimida',
    body: 'Identifique gargalos de conversão e termos buscados sem resultado para criar oportunidades.',
  },
];

export function TrendsTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setVisible(true);
  }, []);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-fade-in">
      <Card className="border-primary/40 bg-card shadow-2xl">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary/15 p-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{current.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  Passo {step + 1} de {STEPS.length}
                </p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">{current.body}</p>
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 rounded-full transition-all',
                    i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted',
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Pular
              </Button>
              {isLast ? (
                <Button size="sm" onClick={dismiss}>
                  Concluir
                </Button>
              ) : (
                <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                  Próximo
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
