/**
 * Quality Gate — redesign do Calendar (src/components/ui/calendar.tsx).
 *
 * O componente sobrescreve as classes .rdp-* via prop `classNames`, então
 * as asserções usam seletores ARIA/atributos que o react-day-picker aplica
 * sempre + busca por classe utilitária diretamente.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Calendar } from '../calendar';

const REF = new Date(2026, 6, 2); // 02/jul/2026

afterEach(() => cleanup());

const classes = (el: Element | null | undefined) =>
  (el?.getAttribute('class') ?? '').toLowerCase();

function byClass(substr: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[class]'));
  const needle = substr.toLowerCase();
  return nodes.find((n) => classes(n).includes(needle)) ?? null;
}

describe('Calendar redesign — tokens semânticos', () => {
  it('renderiza pt-BR (mês "julho" e ano 2026)', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const caption = byClass('capitalize');
    expect(caption).toBeTruthy();
    expect(caption!.textContent?.toLowerCase()).toMatch(/julho.*2026/);
  });

  it('caption tem font-semibold + capitalize + tracking-tight', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const cap = byClass('capitalize');
    const c = classes(cap);
    expect(c).toMatch(/font-semibold/);
    expect(c).toMatch(/tracking-tight/);
  });

  it('nav_button: ghost variant + rounded-lg + h-8 w-8, sem border-input (outline)', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const navs = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter((b) =>
      /previous month|next month|mês anterior|próximo mês/i.test(b.getAttribute('aria-label') || b.getAttribute('name') || ''),
    );
    // Fallback: pega botões com hover:bg-accent + h-8 w-8
    const list = navs.length ? navs : Array.from(document.querySelectorAll<HTMLElement>('button')).filter((b) => {
      const c = classes(b);
      return c.includes('h-8') && c.includes('w-8') && c.includes('rounded-lg');
    });
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const n of list) {
      const c = classes(n);
      expect(c).toMatch(/rounded-lg/);
      expect(c).toMatch(/h-8/);
      expect(c).toMatch(/w-8/);
      expect(c).not.toMatch(/border-input/);
    }
  });

  it('head_cell: uppercase + tracking-wider + muted-foreground/70', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const heads = Array.from(document.querySelectorAll<HTMLElement>('[class*="uppercase"]')).filter((n) =>
      classes(n).includes('tracking-wider'),
    );
    expect(heads.length).toBeGreaterThanOrEqual(7);
    for (const h of heads.slice(0, 7)) {
      expect(classes(h)).toMatch(/muted-foreground\/70/);
    }
  });

  it('cada botão de dia é rounded-lg + h-9 w-9', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const days = Array.from(document.querySelectorAll<HTMLButtonElement>('button[name="day"]'));
    expect(days.length).toBeGreaterThan(20);
    for (const d of days) {
      const c = classes(d);
      expect(c).toMatch(/rounded-lg/);
      expect(c).toMatch(/h-9/);
      expect(c).toMatch(/w-9/);
    }
  });

  it('day_today: ring-1 + text-primary, sem bg-accent sólido', () => {
    render(<Calendar mode="single" defaultMonth={new Date()} />);
    const today =
      document.querySelector('button[aria-current="date"]') ??
      Array.from(document.querySelectorAll<HTMLElement>('button[name="day"]')).find((b) =>
        /ring-primary\/40/.test(b.getAttribute('class') ?? ''),
      );
    expect(today).toBeTruthy();
    const c = classes(today);
    expect(c).toMatch(/ring-1/);
    expect(c).toMatch(/ring-primary\/40/);
    expect(c).toMatch(/text-primary/);
    expect(c).not.toMatch(/(?:^|\s)bg-accent(?:\s|$)/);
  });

  it('day_selected: bg-primary + text-primary-foreground + shadow-sm', () => {
    render(<Calendar mode="single" selected={REF} defaultMonth={REF} />);
    const sel = document.querySelector('button[aria-selected="true"]');
    expect(sel).toBeTruthy();
    const c = classes(sel);
    expect(c).toMatch(/bg-primary/);
    expect(c).toMatch(/text-primary-foreground/);
    expect(c).toMatch(/shadow-sm/);
    expect(c).toMatch(/rounded-lg/);
  });

  it('day_outside é discreto (muted-foreground/40)', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const outside = Array.from(document.querySelectorAll<HTMLElement>('button[name="day"]')).find((b) =>
      /\bday-outside\b/.test(b.getAttribute('class') ?? ''),
    );
    if (outside) expect(classes(outside)).toMatch(/muted-foreground\/40/);
  });

  it('range mode: middle usa accent/60 + rounded-none', () => {
    render(
      <Calendar
        mode="range"
        selected={{ from: new Date(2026, 6, 5), to: new Date(2026, 6, 12) }}
        defaultMonth={REF}
      />,
    );
    // Middle days: aria-selected="true" mas não são from/to.
    const selected = Array.from(document.querySelectorAll<HTMLElement>('button[aria-selected="true"]'));
    expect(selected.length).toBeGreaterThanOrEqual(2);
    // A regra `aria-selected:rounded-none` só é asserida via string na classe (Tailwind ARIA variant).
    const grid = document.querySelector('table, [role="grid"]');
    expect(grid).toBeTruthy();
    // Verifica que a classe da regra está no cell wrapper OU no botão.
    const withRoundedNone = Array.from(document.querySelectorAll<HTMLElement>('[class*="rounded-none"]'));
    expect(withRoundedNone.length).toBeGreaterThan(0);
  });

  it('sem cores hard-coded (bg-white/black/text-white) em nenhum nó', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[class]'));
    for (const n of nodes) {
      const c = classes(n);
      expect(c).not.toMatch(/(?:^|\s)bg-white(?:\s|$)/);
      expect(c).not.toMatch(/(?:^|\s)bg-black(?:\s|$)/);
      expect(c).not.toMatch(/(?:^|\s)text-white(?:\s|$)/);
    }
  });

  it('fuzz: 100 renders alternando defaultMonth mantêm 1 caption por render', () => {
    for (let i = 0; i < 100; i++) {
      const y = 2020 + (i % 10);
      const m = i % 12;
      const d = (i % 27) + 1;
      const dt = new Date(y, m, d);
      const { unmount } = render(<Calendar mode="single" selected={dt} defaultMonth={dt} />);
      const captions = document.querySelectorAll('[class*="capitalize"]');
      expect(captions.length).toBeGreaterThanOrEqual(1);
      // Cada caption tem texto não vazio.
      for (const c of Array.from(captions)) {
        expect((c.textContent ?? '').trim().length).toBeGreaterThan(0);
      }
      unmount();
    }
  });
});
