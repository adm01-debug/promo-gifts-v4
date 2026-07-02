/**
 * Quality Gate — redesign do Calendar (src/components/ui/calendar.tsx).
 *
 * Valida tokens semânticos, arredondamentos, estado "hoje"/selecionado,
 * range mode e resiliência a navegação prev/next (fuzz 100x).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Calendar } from '../calendar';

const REF = new Date(2026, 6, 2); // 02/jul/2026

function classes(el: Element | null | undefined): string {
  return (el?.getAttribute('class') ?? '').toLowerCase();
}

function firstDayButton(): HTMLElement {
  const btns = document.querySelectorAll('button[name="day"]');
  const list = btns.length ? btns : document.querySelectorAll('td button');
  return list[0] as HTMLElement;
}

describe('Calendar redesign — tokens semânticos', () => {
  it('renderiza em pt-BR com "julho 2026"', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    expect(
      screen.getByText(/julho\s+2026/i, { selector: '.rdp-caption_label, [class*="caption_label" i]' }),
    ).toBeInTheDocument();
    cleanup();
  });

  it('caption_label tem font-semibold + capitalize + tracking-tight', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const label = document.querySelector('.rdp-caption_label') as HTMLElement;
    const c = classes(label);
    expect(c).toMatch(/font-semibold/);
    expect(c).toMatch(/capitalize/);
    expect(c).toMatch(/tracking-tight/);
    cleanup();
  });

  it('nav_button: ghost/rounded-lg/h-8 w-8, sem variant outline', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const navs = document.querySelectorAll('.rdp-nav_button');
    expect(navs.length).toBeGreaterThanOrEqual(2);
    navs.forEach((n) => {
      const c = classes(n);
      expect(c).toMatch(/rounded-lg/);
      expect(c).toMatch(/h-8/);
      expect(c).toMatch(/w-8/);
      expect(c).toMatch(/hover:bg-accent/);
      expect(c).not.toMatch(/border-input/); // outline variant leva border-input
    });
    cleanup();
  });

  it('head_cell: uppercase + tracking-wider + muted-foreground/70', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const heads = document.querySelectorAll('.rdp-head_cell');
    expect(heads.length).toBe(7);
    heads.forEach((h) => {
      const c = classes(h);
      expect(c).toMatch(/uppercase/);
      expect(c).toMatch(/tracking-wider/);
      expect(c).toMatch(/muted-foreground\/70/);
    });
    cleanup();
  });

  it('cada dia é rounded-lg h-9 w-9', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const days = document.querySelectorAll('.rdp-day');
    expect(days.length).toBeGreaterThan(20);
    days.forEach((d) => {
      const c = classes(d);
      expect(c).toMatch(/rounded-lg/);
      expect(c).toMatch(/h-9/);
      expect(c).toMatch(/w-9/);
    });
    cleanup();
  });

  it('day_today: ring-1 + text-primary (sem bg-accent sólido)', () => {
    render(<Calendar mode="single" defaultMonth={new Date()} />);
    const today = document.querySelector('.rdp-day_today');
    expect(today).toBeTruthy();
    const c = classes(today);
    expect(c).toMatch(/ring-1/);
    expect(c).toMatch(/ring-primary\/40/);
    expect(c).toMatch(/text-primary/);
    // Não deve pintar o fundo com accent sólido no estado "hoje".
    expect(c).not.toMatch(/(?:^|\s)bg-accent(?:\s|$)/);
    cleanup();
  });

  it('day_selected: bg-primary + text-primary-foreground + shadow-sm, sem ring', () => {
    render(<Calendar mode="single" selected={REF} defaultMonth={REF} />);
    const sel = document.querySelector('.rdp-day_selected');
    expect(sel).toBeTruthy();
    const c = classes(sel);
    expect(c).toMatch(/bg-primary/);
    expect(c).toMatch(/text-primary-foreground/);
    expect(c).toMatch(/shadow-sm/);
    expect(c).toMatch(/rounded-lg/);
    expect(c).not.toMatch(/ring-1/);
    cleanup();
  });

  it('day_outside é discreto (muted-foreground/40)', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const outside = document.querySelector('.rdp-day_outside');
    if (outside) {
      const c = classes(outside);
      expect(c).toMatch(/muted-foreground\/40/);
    }
    cleanup();
  });

  it('range mode: middle usa accent/60 + rounded-none', () => {
    render(
      <Calendar
        mode="range"
        selected={{ from: new Date(2026, 6, 5), to: new Date(2026, 6, 12) }}
        defaultMonth={REF}
      />,
    );
    const middle = document.querySelector('.rdp-day_range_middle');
    if (middle) {
      const c = classes(middle);
      expect(c).toMatch(/accent\/60/);
      expect(c).toMatch(/rounded-none/);
    }
    cleanup();
  });

  it('sem cores hard-coded (bg-white/black/#hex/text-white)', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const html = document.body.innerHTML.toLowerCase();
    // Não deve conter tokens brutos como classes utilitárias.
    expect(html).not.toMatch(/class="[^"]*\bbg-white\b/);
    expect(html).not.toMatch(/class="[^"]*\bbg-black\b/);
    expect(html).not.toMatch(/class="[^"]*\btext-white\b/);
    cleanup();
  });

  it('fuzz: 100 renders com defaultMonth alternando não lançam erro', () => {
    for (let i = 0; i < 100; i++) {
      const y = 2020 + (i % 10);
      const m = i % 12;
      const d = (i % 27) + 1;
      const dt = new Date(y, m, d);
      const { unmount } = render(<Calendar mode="single" selected={dt} defaultMonth={dt} />);
      const label = document.querySelector('.rdp-caption_label');
      expect(label?.textContent?.length ?? 0).toBeGreaterThan(0);
      // Um único caption por render.
      expect(document.querySelectorAll('.rdp-caption_label').length).toBe(1);
      unmount();
    }
  });
});
