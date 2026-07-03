/**
 * Quality Gate — Calendar number distribution.
 * Blinda a correção do calendário: números distribuídos por toda a largura
 * usando justify-between/gap-0, sem reintroduzir mt/mb/space-y nas linhas.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Calendar } from '../calendar';

const REF = new Date(2026, 6, 2);

afterEach(() => cleanup());

const classes = (el: Element | null | undefined) =>
  (el?.getAttribute('class') ?? '').toLowerCase();

const hasToken = (className: string, token: string) =>
  new RegExp(`(^|\\s)${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(className);

function getCalendarRows(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[class*="justify-between"]'))
    .filter((el) => {
      const c = classes(el);
      return hasToken(c, 'flex') && hasToken(c, 'w-full') && !hasToken(c, 'flex-col');
    });
}

describe('Calendar — distribuição interna dos números', () => {
  it('head_row e rows usam justify-between + gap-0 para ocupar a largura sem gaps artificiais', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);

    const rows = getCalendarRows(container);
    expect(rows.length).toBeGreaterThanOrEqual(6);

    for (const row of rows) {
      const c = classes(row);
      expect(c).toMatch(/justify-between/);
      expect(c).toMatch(/gap-0/);
    }
  });

  it('linhas não usam mt/mb/space-y que aumentariam a altura do card', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);

    for (const row of getCalendarRows(container)) {
      const c = classes(row);
      expect(c).not.toMatch(/(^|\s)m[bt]-/);
      expect(c).not.toMatch(/(^|\s)space-y-/);
    }
  });

  it('células mantêm distribuição responsiva e preservam aspect-square', () => {
    const { container } = render(<Calendar mode="single" defaultMonth={REF} />);
    const cells = Array.from(
      container.querySelectorAll<HTMLElement>('[class*="flex-1"][class*="sm:h-[18.571428px]"][class*="aspect-square"]'),
    );

    expect(cells.length).toBeGreaterThanOrEqual(28);
    for (const cell of cells.slice(0, 14)) {
      const c = classes(cell);
      expect(c).toMatch(/flex-1/);
      expect(c).toMatch(/sm:flex-none/);
      expect(c).toMatch(/sm:h-\[18\.571428px\]/);
      expect(c).toMatch(/sm:w-\[18\.571428px\]/);
      expect(c).toMatch(/aspect-square/);
      expect(c).not.toMatch(/(^|\s)(h|w)-(9|10)(\s|$)/);
    }
  });
});