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
  it('container root tem p-2 (não p-4)', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const root = container.querySelector('.rdp') ?? container.firstElementChild;
    const c = classes(root);
    expect(c).toMatch(/(^|\s)p-2(\s|$)/);
    expect(c).not.toMatch(/(^|\s)p-4(\s|$)/);
  });

  it('caption_label é text-base (não text-2xl)', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const cap = container.querySelector('.capitalize');
    const c = classes(cap);
    expect(c).toMatch(/text-base/);
    expect(c).not.toMatch(/text-2xl/);
  });

  it('nav_button é h-5 w-5', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const nav = Array.from(container.querySelectorAll<HTMLElement>('button')).find((b) =>
      /h-5\s+w-5/.test(b.getAttribute('class') ?? ''),
    );
    expect(nav).toBeTruthy();
  });

  it('day é h-6 w-6 (não h-10 w-10)', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const days = Array.from(container.querySelectorAll<HTMLElement>('button')).filter((b) =>
      /h-6\s+w-6/.test(b.getAttribute('class') ?? ''),
    );
    expect(days.length).toBeGreaterThanOrEqual(20);
    for (const d of days) {
      expect(classes(d)).not.toMatch(/h-10|w-10/);
    }
  });

  it('ícones nav são h-3 w-3', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const svgs = Array.from(container.querySelectorAll<SVGElement>('svg'));
    const small = svgs.filter((s) => /h-3\s+w-3/.test(s.getAttribute('class') ?? ''));
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
      /h-5\s+w-5/.test(b.getAttribute('class') ?? ''),
    );
    expect(classes(navBtn)).toMatch(/focus-visible:ring-2/);
  });
});
