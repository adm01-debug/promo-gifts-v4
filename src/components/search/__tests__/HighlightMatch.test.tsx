/**
 * Tests for HighlightMatch — regression suite for BUG-GS-01.
 *
 * BUG-GS-01: Previously, `regex.test(part)` was called with the same stateful
 * global regex (`gi`) used in `text.split(regex)`. After `split()`, the regex
 * `.lastIndex` ends up in an unpredictable position, causing `.test()` to
 * alternate true/false — every other match was missed.
 *
 * These tests verify that ALL matching segments are highlighted regardless of
 * their position in the string, and that diacritic-insensitive matching works.
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HighlightMatch } from '../HighlightMatch';

describe('HighlightMatch', () => {
  /**
   * Helper: returns all <mark> text content from the rendered output.
   */
  function getHighlightedParts(text: string, query: string): string[] {
    const { container } = render(<HighlightMatch text={text} query={query} />);
    return [...container.querySelectorAll('mark')].map((el) => el.textContent ?? '');
  }

  // ──────────────────────────────────────────────────────
  // Empty / short query — no highlights expected
  // ──────────────────────────────────────────────────────
  it('renders plain text when query is empty', () => {
    const { container } = render(<HighlightMatch text="Caneta Personalizada" query="" />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toBe('Caneta Personalizada');
  });

  it('renders plain text when query has only 1 character', () => {
    const { container } = render(<HighlightMatch text="Caneta Personalizada" query="C" />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
  });

  it('renders plain text when all query words are shorter than 2 chars', () => {
    const { container } = render(<HighlightMatch text="Caneta Personalizada" query="a b c" />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────
  // Exact match
  // ──────────────────────────────────────────────────────
  it('highlights an exact match', () => {
    const marks = getHighlightedParts('Caneta Personalizada Premium', 'Caneta');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toBe('Caneta');
  });

  it('highlights a case-insensitive match', () => {
    const marks = getHighlightedParts('Caneta Personalizada Premium', 'caneta');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toBe('Caneta');
  });

  // ──────────────────────────────────────────────────────
  // Diacritic-insensitive matching (BUG-GS-01 adjacent)
  // ──────────────────────────────────────────────────────
  it('highlights accented text when query uses unaccented letters', () => {
    const marks = getHighlightedParts('Canéta Personalizada', 'caneta');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toBe('Canéta');
  });

  it('highlights unaccented text when query uses accented letters', () => {
    const marks = getHighlightedParts('Caneta Personalizada', 'canéta');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toBe('Caneta');
  });

  // ──────────────────────────────────────────────────────
  // REGRESSION: multiple occurrences — BUG-GS-01 core test
  // Before the fix, every other match was missed due to regex.lastIndex.
  // ──────────────────────────────────────────────────────
  it('highlights ALL occurrences of a word in the string (regression BUG-GS-01)', () => {
    const text = 'caneta azul caneta vermelha caneta preta';
    const marks = getHighlightedParts(text, 'caneta');
    expect(marks).toHaveLength(3);
    expect(marks).toEqual(['caneta', 'caneta', 'caneta']);
  });

  it('does not skip every other match (alternating lastIndex bug)', () => {
    // "abc abc abc abc abc" — 5 occurrences.
    // With the old global-regex bug, only odd-positioned matches (1st, 3rd, 5th) would pass test().
    const text = 'abc abc abc abc abc';
    const marks = getHighlightedParts(text, 'abc');
    expect(marks).toHaveLength(5);
  });

  // ──────────────────────────────────────────────────────
  // Multi-word query
  // ──────────────────────────────────────────────────────
  it('highlights each word of a multi-word query independently', () => {
    const marks = getHighlightedParts('Caneta Personalizada Premium', 'Caneta Premium');
    expect(marks).toHaveLength(2);
    expect(marks).toContain('Caneta');
    expect(marks).toContain('Premium');
  });

  // ──────────────────────────────────────────────────────
  // No match
  // ──────────────────────────────────────────────────────
  it('renders plain text when there is no match', () => {
    const { container } = render(<HighlightMatch text="Caneta Personalizada" query="borracha" />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toBe('Caneta Personalizada');
  });

  // ──────────────────────────────────────────────────────
  // className / highlightClassName propagation
  // ──────────────────────────────────────────────────────
  it('applies custom highlightClassName to <mark> elements', () => {
    const { container } = render(
      <HighlightMatch text="Caneta" query="Caneta" highlightClassName="my-highlight" />,
    );
    const mark = container.querySelector('mark');
    expect(mark?.classList.contains('my-highlight')).toBe(true);
  });
});
