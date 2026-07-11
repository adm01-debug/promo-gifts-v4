/**
 * Dev-only visual harness for the shared Calendar.
 * Rota: `/__visual/calendar`.
 *
 * Query params:
 *   ?theme=dark
 *   ?month=YYYY-MM      → mês exibido (default 2026-07)
 *   ?selected=none|first|last|day-DD   → estado de seleção
 */
import { useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';

function parseMonth(raw: string | null): Date {
  if (raw) {
    const m = /^(\d{4})-(\d{2})$/.exec(raw);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);
  }
  return new Date(2026, 6, 1);
}

function parseSelected(raw: string | null, month: Date): Date | undefined {
  if (!raw || raw === 'none') return undefined;
  if (raw === 'first') return new Date(month.getFullYear(), month.getMonth(), 1);
  if (raw === 'last') {
    return new Date(month.getFullYear(), month.getMonth() + 1, 0);
  }
  const m = /^day-(\d{1,2})$/.exec(raw);
  if (m) return new Date(month.getFullYear(), month.getMonth(), Number(m[1]));
  return new Date(month.getFullYear(), month.getMonth(), 3);
}

export default function CalendarHarness() {
  const params = useMemo(
    () =>
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams(),
    [],
  );

  const month = useMemo(() => parseMonth(params.get('month')), [params]);
  const selected = useMemo(() => parseSelected(params.get('selected'), month), [params, month]);

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
      data-testid="visual-calendar-root"
      className="flex min-h-dvh items-center justify-center bg-background p-4"
    >
      <h1 className="sr-only">Calendário visual</h1>
      <div
        data-testid="visual-calendar-card"
        className={
          params.get('width') === 'mobile'
            ? 'w-full max-w-[340px] rounded-2xl border border-border/50 bg-card p-2 shadow-xl'
            : 'w-[240px] rounded-2xl border border-border/50 bg-card p-2 shadow-xl'
        }
      >
        <Calendar mode="single" defaultMonth={month} selected={selected} />
      </div>
    </main>
  );
}
