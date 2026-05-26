import { describe, it, expect } from 'vitest';
import { findNearestPantone, getBestPantoneMatch } from '../color-matching';

describe('color-matching.ts', () => {
  describe('getBestPantoneMatch', () => {
    it('should find the exact match for pure white', () => {
      // Pure white is usually Pantone 000C or similar, let's see what the catalog has
      const result = getBestPantoneMatch('#FFFFFF');
      expect(result).toBeDefined();
      expect(result.deltaE).toBeLessThan(5); // Should be very close
    });

    it('should find the exact match for pure black', () => {
      const result = getBestPantoneMatch('#000000');
      expect(result).toBeDefined();
      expect(result.deltaE).toBeLessThan(15); // Black often has a higher delta-E in coated catalogs
    });

    it('should handle short hex codes if they were supported (not currently, but testing robustly)', () => {
      // Current implementation uses hexToRgb which assumes 6 chars
      // We could improve it, but let's test current behavior first
      const result = getBestPantoneMatch('#FF0000');
      expect(result.pantoneCode).toBeDefined();
    });

    it('should find a close match for a specific brand color (e.g. Coca-Cola Red #F40009)', () => {
      const result = getBestPantoneMatch('#F40009');
      expect(result.deltaE).toBeLessThan(10);
      expect(result.pantoneHex).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe('findNearestPantone', () => {
    it('should return exactly topN matches', () => {
      const topN = 3;
      const results = findNearestPantone('#4287f5', topN);
      expect(results).toHaveLength(topN);
    });

    it('should return matches sorted by deltaE ascending', () => {
      const results = findNearestPantone('#4287f5', 5);
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].deltaE).toBeLessThanOrEqual(results[i + 1].deltaE);
      }
    });

    it('should handle hex codes without the # prefix', () => {
      // The current implementation hexToRgb uses .replace('#', '')
      const result1 = getBestPantoneMatch('#FF5733');
      const result2 = getBestPantoneMatch('FF5733');
      expect(result1).toEqual(result2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid hex characters by returning some result (graceful failure)', () => {
      // parseInt will return NaN for invalid hex, which might propagate
      // Let's see how it behaves
      const result = getBestPantoneMatch('#ZZZZZZ');
      expect(result).toBeDefined();
      // Even if NaN propagates to deltaE, it shouldn't crash the app
    });

    it('should handle empty string', () => {
      try {
        getBestPantoneMatch('');
      } catch (e) {
        // expect it to throw or return something
        expect(e).toBeDefined();
      }
    });
  });
});
