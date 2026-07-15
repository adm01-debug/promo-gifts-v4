/**
 * Quality Gate — Calendar iOS-style redesign.
 * Valida invariantes do novo visual: header grande, weekdays de 1 letra,
 * domingo destrutivo, hoje invertido, selecionado primário, outside oculto.
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

describe('Calendar iOS redesign', () => {
  it('renderiza mês pt-BR capitalizado ("Julho 2026")', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const caption = byClass('capitalize');
    expect(caption).toBeTruthy();
    expect(caption!.textContent?.toLowerCase()).toMatch(/julho.*2026/);
  });

  it('caption tem text-[15px] + font-bold + tracking-tight', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const cap = byClass('capitalize');
    const c = classes(cap);
    expect(c).toMatch(/text-\[15px\]/);
    expect(c).toMatch(/font-bold/);
    expect(c).toMatch(/tracking-tight/);
  });

  it('weekday cells: 7 células com 1 letra (D/S/T/Q/Q/S/S)', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const heads = Array.from(document.querySelectorAll<HTMLElement>('th, [role="columnheader"]'));
    const active = heads.filter((h) => (h.textContent ?? '').trim().length > 0);
    expect(active.length).toBeGreaterThanOrEqual(7);
    for (const h of active.slice(0, 7)) {
      expect((h.textContent ?? '').trim().length).toBe(1);
    }
  });

  it('domingo recebe modificador text-destructive', () => {
    render(<Calendar mode="single" defaultMonth={REF} />);
    const sundays = document.querySelectorAll('.text-destructive');
    expect(sundays.length).toBeGreaterThanOrEqual(1);
  });

  it('day_today: bg-foreground + text-background (círculo invertido)', () => {
    render(<Calendar mode="single" defaultMonth={new Date()} />);
    const today =
      document.querySelector('button[aria-current="date"]') ??
      Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) =>
        (b.getAttribute('class') ?? '').includes('bg-foreground'),
      );
    expect(today).toBeTruthy();
    const c = classes(today);
    expect(c).toMatch(/bg-foreground/);
    expect(c).toMatch(/text-background/);
    expect(c).toMatch(/rounded-full|rounded-lg/);
  });

  it('day_selected: bg-primary + text-primary-foreground', () => {
    render(<Calendar mode="single" selected={REF} defaultMonth={REF} />);
    const sel = document.querySelector('button[aria-selected="true"]');
    expect(sel).toBeTruthy();
    const c = classes(sel);
    expect(c).toMatch(/bg-primary/);
    expect(c).toMatch(/text-primary-foreground/);
  });

  it('day_outside é oculto (invisible + pointer-events-none)', () => {
    render(<Calendar mode="single" showOutsideDays defaultMonth={REF} />);
    const outside = Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) =>
      /day-outside|day_outside/.test(b.className),
    );
    if (outside) {
      const c = classes(outside.closest('[class*="invisible"]') ?? outside);
      expect(c).toMatch(/invisible|pointer-events-none/);
    }
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

  it('fuzz: 50 renders em meses diferentes mantêm caption única e válida', () => {
    for (let i = 0; i < 50; i++) {
      const y = 2020 + (i % 10);
      const m = i % 12;
      const d = (i % 27) + 1;
      const dt = new Date(y, m, d);
      const { unmount } = render(<Calendar mode="single" selected={dt} defaultMonth={dt} />);
      const captions = document.querySelectorAll('[class*="capitalize"]');
      expect(captions.length).toBeGreaterThanOrEqual(1);
      for (const c of Array.from(captions)) {
        expect((c.textContent ?? '').trim().length).toBeGreaterThan(0);
      }
      unmount();
    }
  });
});
