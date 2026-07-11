/**
 * Dev-only visual harness para o DatePickerField (compact + input).
 * Rota: `/__visual/date-picker-field`.
 *
 * Query params:
 *   ?theme=dark
 *   ?variant=compact|input   (default: compact)
 *   ?state=empty|selected|error|open   (default: empty)
 *   ?value=YYYY-MM-DD        (default: 2026-07-11 quando state=selected)
 *
 * Este harness monta o mesmo componente que renderiza o "Prazo p/ envio",
 * permitindo capturar snapshots visuais estáveis sem depender de auth/carrinho.
 */
import { useEffect, useMemo, useState } from 'react';
import { DatePickerField, type DatePickerFieldVariant } from '@/components/ui/date-picker-field';

function readVariant(raw: string | null): DatePickerFieldVariant {
  return raw === 'input' ? 'input' : 'compact';
}

export default function DatePickerFieldHarness() {
  const params = useMemo(
    () =>
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams(),
    [],
  );

  const variant = readVariant(params.get('variant'));
  const state = params.get('state') ?? 'empty';
  const initial = params.get('value') ?? (state === 'selected' ? '2026-07-11' : '');
  const [value, setValue] = useState<string>(initial);

  useEffect(() => {
    const theme = params.get('theme');
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    return () => {
      root.classList.remove('dark');
    };
  }, [params]);

  return (
    <main
      data-testid="visual-date-picker-root"
      className="flex min-h-dvh items-center justify-center bg-background p-4"
    >
      <h1 className="sr-only">DatePickerField visual</h1>
      <div
        data-testid="visual-date-picker-card"
        className="flex w-[280px] flex-col gap-2 rounded-2xl border border-border/50 bg-card p-3 shadow-xl"
      >
        <label
          htmlFor="visual-dp-field"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
        >
          Prazo p/ envio
        </label>
        <DatePickerField
          id="visual-dp-field"
          data-testid="visual-dp-field"
          variant={variant}
          value={value}
          onChange={setValue}
          aria-invalid={state === 'error'}
          aria-describedby={state === 'error' ? 'visual-dp-error' : undefined}
          aria-label="Prazo para envio"
        />
        {state === 'error' && (
          <span id="visual-dp-error" role="alert" className="text-[10px] font-medium text-destructive">
            Selecione uma data válida.
          </span>
        )}
      </div>
    </main>
  );
}
