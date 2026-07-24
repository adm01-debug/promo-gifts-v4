/**
 * Unit tests for src/lib/textUtils.ts — toTitleCase
 *
 * Portuguese Title Case: capitalizes every word except prepositions/articles
 * that appear in the middle of a phrase. The first word is always capitalized.
 */
import { describe, it, expect } from 'vitest';
import { toTitleCase } from '@/lib/textUtils';

describe('toTitleCase', () => {
  it('capitalizes a single word', () => {
    expect(toTitleCase('azul')).toBe('Azul');
  });

  it('capitalizes the first letter of every non-preposition word', () => {
    expect(toTitleCase('camisa polo masculina')).toBe('Camisa Polo Masculina');
  });

  it('first word is always capitalized even if it is a preposition', () => {
    expect(toTitleCase('de brindes corporativos')).toBe('De Brindes Corporativos');
  });

  it('keeps Portuguese prepositions lowercase in the middle', () => {
    expect(toTitleCase('bolsa de couro')).toBe('Bolsa de Couro');
    expect(toTitleCase('caneta do escritório')).toBe('Caneta do Escritório');
  });

  it('handles all listed preposition/article tokens', () => {
    const prepositions = ['e', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com'];
    for (const prep of prepositions) {
      const result = toTitleCase(`produto ${prep} empresa`);
      expect(result).toBe(`Produto ${prep} Empresa`);
    }
  });

  it('lowercases the entire input first (normalizes ALL-CAPS)', () => {
    expect(toTitleCase('COPO DE VIDRO')).toBe('Copo de Vidro');
  });

  it('handles empty string', () => {
    expect(toTitleCase('')).toBe('');
  });

  it('handles single preposition word (should capitalize as first word)', () => {
    expect(toTitleCase('de')).toBe('De');
  });

  it('does not lowercase the first word when it is a preposition', () => {
    expect(toTitleCase('em destaque')).toBe('Em Destaque');
  });

  it('handles multi-word with conjunction "e"', () => {
    expect(toTitleCase('lápis e borracha')).toBe('Lápis e Borracha');
  });
});
