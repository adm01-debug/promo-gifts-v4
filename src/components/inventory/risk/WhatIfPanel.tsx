/**
 * WhatIfPanel — Slider interativo para simular impacto de reposição.
 * Onda 3 / Melhoria 20. Self-contained, aditivo.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useWhatIfScenario } from '@/hooks/stock/useWhatIfScenario';
import { Loader2, Zap } from 'lucide-react';

const LEVEL_COLORS: Record<string, string> = {
  'RUPTURA':   'bg-red-500/20 text-red-700 dark:text-red-400',
  'CRÍTICO':   'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  'ALERTA':    'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  'ATENÇÃO':   'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  'SEM_SINAL': 'bg-muted/60 text-muted-foreground',
  'OK':        'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
};

interface Props { supplierId?: string | null; }

export function WhatIfPanel({ supplierId }: Props) {
  const [delta, setDelta] = useState(100);
  const { data = [], isLoading } = useWhatIfScenario(delta, 'RUPTURA', supplierId);

  const totalAffected = data.reduce((s, r) => s + r.variantes, 0);
  const nowOk = data.find((r) => r.nivel_simulado === 'OK')?.variantes ?? 0;
  const stillRuptura = data.find((r) => r.nivel_simulado === 'RUPTURA')?.variantes ?? 0;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-amber-500" />
          What-if: E se adicionarmos {delta.toLocaleString('pt-BR')} un por SKU em RUPTURA?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Slider 0-2000 unidades */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0 un</span>
            <span className="font-semibold text-foreground">{delta.toLocaleString('pt-BR')} un / SKU</span>
            <span>2.000 un</span>
          </div>
          <Slider
            min={0} max={2000} step={50}
            value={[delta]}
            onValueChange={([v]) => setDelta(v)}
            className="w-full"
            aria-label="Unidades a adicionar por SKU"
          />
        </div>

        {/* Resultado */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando...
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {data.map((row) => (
                <div
                  key={row.nivel_simulado}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${LEVEL_COLORS[row.nivel_simulado] ?? 'bg-muted/60'}`}
                >
                  <span className="font-bold tabular-nums">{row.variantes.toLocaleString('pt-BR')}</span>
                  <span>→ {row.nivel_simulado}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              De {totalAffected.toLocaleString('pt-BR')} em RUPTURA:
              {nowOk > 0 && <span className="ml-1 text-emerald-600 font-medium">{nowOk.toLocaleString('pt-BR')} passariam para OK</span>}
              {stillRuptura > 0 && <span className="ml-1 text-red-600">· {stillRuptura.toLocaleString('pt-BR')} continuariam em RUPTURA (EMA alto)</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
