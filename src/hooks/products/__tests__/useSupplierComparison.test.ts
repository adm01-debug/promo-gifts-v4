import { describe, it, expect } from 'vitest';
import { tokenize, stripAccents, jaccard, computeScore } from '../useSupplierComparison';

describe('useSupplierComparison logic', () => {
  describe('stripAccents', () => {
    it('should remove accents from string', () => {
      expect(stripAccents('Caneta Esferográfica')).toBe('Caneta Esferografica');
      expect(stripAccents('Squeeze Metálico')).toBe('Squeeze Metalico');
    });
  });

  describe('tokenize', () => {
    it('should tokenize and normalize names', () => {
      const tokens = tokenize('Caneta Plástica Azul');
      expect(tokens.has('caneta')).toBe(true);
      expect(tokens.has('plastica')).toBe(true);
      expect(tokens.has('azul')).toBe(true);
      expect(tokens.size).toBe(3);
    });

    it('should handle short tokens with numbers', () => {
      const tokens = tokenize('Caderno A4 100 folhas');
      expect(tokens.has('caderno')).toBe(true);
      expect(tokens.has('a4')).toBe(true);
      expect(tokens.has('folhas')).toBe(true);
      // tokens: 'caderno', 'a4', '100', 'folhas'
      expect(tokens.size).toBe(4);
    });
  });

  describe('jaccard', () => {
    it('should calculate similarity correctly', () => {
      const a = new Set(['caneta', 'plastica', 'azul']);
      const b = new Set(['caneta', 'metalica', 'azul']);
      // inter = 2 (caneta, azul), union = 4 (caneta, plastica, metalica, azul)
      expect(jaccard(a, b)).toBe(0.5);
    });
  });

  describe('computeScore', () => {
    it('should calculate score within 0-100 range', () => {
      const score = computeScore({
        priceDiffPercent: 0,
        stock: 100,
        highestStock: 100,
        leadTimeDays: 2,
        maxLead: 10,
        commonColors: 5,
        maxCommonColors: 5,
        isVerified: true,
      });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle zero stock gracefully', () => {
      const score = computeScore({
        priceDiffPercent: 10,
        stock: 0,
        highestStock: 0,
        leadTimeDays: null,
        maxLead: 0,
        commonColors: 0,
        maxCommonColors: 0,
        isVerified: false,
      });
      expect(score).toBeDefined();
      expect(typeof score).toBe('number');
      expect(Number.isNaN(score)).toBe(false);
    });
  });
});
