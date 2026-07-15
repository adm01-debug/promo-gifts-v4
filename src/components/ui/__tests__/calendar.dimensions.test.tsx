/**
 * Quality Gate — Calendar shrink ~50% (contract).
 * Blinda dimensões após o resize: p-2, text-base, células h-6 w-6,
 * nav h-5 w-5, ícones h-3 w-3. Rejeita tokens antigos (p-4, text-2xl, h-10 w-10).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Calendar } from '../calendar';

const REF = new Date(2026, 6, 2);

afterEach(() => cleanup());

const classes = (el: Element | null | undefined) =>
  (el?.getAttribute('class') ?? '').toLowerCase();

describe('Calendar shrink 50% — dimensions contract', () => {
  it('container root tem p-1.5 (não p-4)', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const root = container.querySelector('.rdp') ?? container.firstElementChild;
    const c = classes(root);
    expect(c).toMatch(/(^|\s)p-1\.5(\s|$)/);
    expect(c).not.toMatch(/(^|\s)p-4(\s|$)/);
  });


  it('caption_label é text-[15px] (não text-2xl)', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const cap = container.querySelector('.capitalize');
    const c = classes(cap);
    expect(c).toMatch(/text-\[15px\]/);
    expect(c).not.toMatch(/text-2xl/);
  });

  it('nav_button é h-6 w-6', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const nav = Array.from(container.querySelectorAll<HTMLElement>('button')).find((b) =>
      /h-6\s+w-6/.test(b.getAttribute('class') ?? ''),
    );
    expect(nav).toBeTruthy();
  });

  it('cell usa flex mobile + tamanho compacto em sm+ (sem altura grande h-9/h-10)', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const cells = Array.from(
      container.querySelectorAll<HTMLElement>('[class*="flex-1"][class*="sm:h-[18.571428px]"][class*="aspect-square"]'),
    );
    expect(cells.length).toBeGreaterThanOrEqual(20);
    for (const c of cells) {
      const cls = classes(c);
      expect(cls).toMatch(/flex-1/);
      expect(cls).toMatch(/sm:flex-none/);
      expect(cls).toMatch(/sm:h-\[18\.571428px\]/);
      expect(cls).toMatch(/sm:w-\[18\.571428px\]/);
      expect(cls).toMatch(/aspect-square/);
      expect(cls).not.toMatch(/(?:^|\s)h-9(?:\s|$)/);
      expect(cls).not.toMatch(/(?:^|\s)h-10(?:\s|$)|(?:^|\s)w-10(?:\s|$)/);
    }
  });


  it('ícones nav são h-3.5 w-3.5', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const svgs = Array.from(container.querySelectorAll<SVGElement>('svg'));
    const small = svgs.filter((s) => /h-3\.5\s+w-3\.5/.test(s.getAttribute('class') ?? ''));
    expect(small.length).toBeGreaterThanOrEqual(2);
  });

  it('mantém a11y: role grid, focus-visible:ring nos nav, aria-selected em selected', () => {
    const { container } = render(
      <Calendar mode="single" selected={REF} defaultMonth={REF} />,
    );
    expect(container.querySelector('[role="grid"]')).toBeTruthy();
    const sel = container.querySelector('button[aria-selected="true"]');
    expect(sel).toBeTruthy();
    const navBtn = Array.from(container.querySelectorAll<HTMLElement>('button')).find((b) =>
      /h-6\s+w-6/.test(b.getAttribute('class') ?? ''),
    );
    expect(classes(navBtn)).toMatch(/focus-visible:ring-2/);
  });

  it('shrink extra: month sem space-y, rows com justify-between/gap-0, weekdays text-[10px], days text-[11px]', () => {

    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const month = container.querySelector('[class*="flex"][class*="flex-col"]');
    expect(month, 'month container flex flex-col').toBeTruthy();
    expect(classes(month)).not.toMatch(/space-y-/);

    const rows = Array.from(container.querySelectorAll<HTMLElement>('[class*="w-full"]'))
      .map((el) => classes(el))
      .filter((c) => /(^|\s)flex(\s|$)/.test(c) && c.includes('w-full'));
    const hasGap0Row = rows.some((c) => /(^|\s)gap-0(\s|$)/.test(c));
    const hasJustifyBetweenRow = rows.some((c) => /(^|\s)justify-between(\s|$)/.test(c));
    expect(hasGap0Row, 'ao menos uma row com gap-0').toBe(true);
    expect(hasJustifyBetweenRow, 'ao menos uma row com justify-between').toBe(true);

    const heads = Array.from(container.querySelectorAll<HTMLElement>('th, [role="columnheader"]'))
      .filter((h) => (h.textContent ?? '').trim().length > 0);
    expect(heads.length).toBeGreaterThanOrEqual(7);
    for (const h of heads.slice(0, 7)) {
      expect(classes(h)).toMatch(/text-\[10px\]/);
      expect(classes(h)).toMatch(/flex-1/);
      expect(classes(h)).toMatch(/sm:flex-none/);
      expect(classes(h)).toMatch(/sm:h-\[18\.571428px\]/);
      expect(classes(h)).toMatch(/sm:w-\[18\.571428px\]/);
    }

    const dayBtns = Array.from(container.querySelectorAll<HTMLElement>('button[name="day"]'));
    expect(dayBtns.length).toBeGreaterThan(20);
    for (const b of dayBtns.slice(0, 10)) {
      expect(classes(b)).toMatch(/text-\[11px\]/);
    }
  });
});

