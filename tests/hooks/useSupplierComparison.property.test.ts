import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { tokenize, computeScore, stripAccents, ScoreInput } from '@/hooks/products/useSupplierComparison';

describe('Supplier Comparison - Property Based Testing', () => {
  describe('tokenize', () => {
    it('should always return a Set of strings', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const tokens = tokenize(input);
          expect(tokens).toBeInstanceOf(Set);
          tokens.forEach(token => {
            expect(typeof token).toBe('string');
          });
        })
      );
    });

    it('should remove accents correctly (property)', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const stripped = stripAccents(input);
          // Regex to check for common Portuguese accents
          const hasAccents = /[áàâãéèêíïóôõöúç]/i.test(stripped);
          expect(hasAccents).toBe(false);
        })
      );
    });

    it('should handle short tokens and numbers according to rules', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (input) => {
          const tokens = tokenize(input);
          tokens.forEach(token => {
            if (token.length === 2) {
              // Rule: 2-char tokens must contain a number
              expect(/[0-9]/.test(token)).toBe(true);
            } else if (token.length < 2) {
              // Rule: no tokens < 2 chars
              expect(token.length).toBeGreaterThanOrEqual(2);
            }
          });
        })
      );
    });
  });

  describe('computeScore', () => {
    it('should always return a number between 0 and 100 (inclusive)', () => {
      const scoreInputArb = fc.record({
        priceDiffPercent: fc.float(),
        stock: fc.integer({ min: 0 }),
        highestStock: fc.integer({ min: 0 }),
        leadTimeDays: fc.oneof(fc.integer({ min: 0 }), fc.constant(null)),
        maxLead: fc.integer({ min: 1 }),
        commonColors: fc.integer({ min: 0 }),
        maxCommonColors: fc.integer({ min: 1 }),
        isVerified: fc.boolean(),
      });

      fc.assert(
        fc.property(scoreInputArb, (input) => {
          const score = computeScore(input as ScoreInput);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
          expect(Number.isNaN(score)).toBe(false);
        })
      );
    });

    it('should handle edge cases like zero highestStock or maxLead', () => {
      const edgeCaseArb = fc.record({
        priceDiffPercent: fc.constant(NaN), // Test robustness against NaN
        stock: fc.constant(0),
        highestStock: fc.constant(0),
        leadTimeDays: fc.constant(null),
        maxLead: fc.constant(0),
        commonColors: fc.constant(0),
        maxCommonColors: fc.constant(0),
        isVerified: fc.boolean(),
      });

      fc.assert(
        fc.property(edgeCaseArb, (input) => {
          const score = computeScore(input as ScoreInput);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
          expect(Number.isNaN(score)).toBe(false);
        })
      );
    });
  });
});
