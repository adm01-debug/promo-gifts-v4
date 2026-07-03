/**
 * Dev-only visual harness for the shared Calendar.
 * Rota: `/__visual/calendar`.
 */
import { useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';

const DEFAULT_MONTH = new Date(2026, 6, 1);
const SELECTED_DAY = new Date(2026, 6, 3);

export default function CalendarHarness() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme');
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    return () => {
      root.classList.remove('dark');
    };
  }, []);

  return (
    <main
      data-testid="visual-calendar-root"
      className="flex min-h-dvh items-center justify-center bg-background p-4"
    >
      <h1 className="sr-only">Calendário visual</h1>
      <div
        data-testid="visual-calendar-card"
        className="w-[240px] rounded-2xl border border-border/50 bg-card p-2 shadow-xl"
      >
        <Calendar mode="single" defaultMonth={DEFAULT_MONTH} selected={SELECTED_DAY} />
      </div>
    </main>
  );
}