import { describe, it, expect } from 'vitest';
import {
  maskCnpj,
  maskPhone,
  validateCnpj,
  maskCep,
  normalizeCnpj,
  isNormalizedCnpj,
} from './masks';

describe('Utility Masks & Validation', () => {
  describe('CNPJ Masking & Validation', () => {
    it('masks a raw 14-digit string to CNPJ format', () => {
      expect(maskCnpj('12345678000195')).toBe('12.345.678/0001-95');
    });

    it('masks the reference format 02.931.668/0001-88', () => {
      expect(maskCnpj('02931668000188')).toBe('02.931.668/0001-88');
    });

    it('masks even when input already contains punctuation', () => {
      expect(maskCnpj('02.931.668/0001-88')).toBe('02.931.668/0001-88');
      expect(maskCnpj('02 931 668 0001 88')).toBe('02.931.668/0001-88');
    });

    it('truncates more than 14 digits', () => {
      expect(maskCnpj('12345678000195999')).toBe('12.345.678/0001-95');
    });

    it('handles null/undefined safely', () => {
      expect(maskCnpj(null)).toBe('');
      expect(maskCnpj(undefined)).toBe('');
    });

    it('validates a real valid CNPJ', () => {
      expect(validateCnpj('12.345.678/0001-95')).toBe(true);
      expect(validateCnpj('12345678000195')).toBe(true);
    });

    it('invalidates an incorrect CNPJ length', () => {
      expect(validateCnpj('1234567800019')).toBe(false);
    });

    it('invalidates CNPJs with all identical digits', () => {
      expect(validateCnpj('11111111111111')).toBe(false);
    });
  });

  describe('normalizeCnpj', () => {
    it('strips punctuation from a masked CNPJ', () => {
      expect(normalizeCnpj('02.931.668/0001-88')).toBe('02931668000188');
    });

    it('keeps digits-only input unchanged', () => {
      expect(normalizeCnpj('02931668000188')).toBe('02931668000188');
    });

    it('caps at 14 digits', () => {
      expect(normalizeCnpj('029316680001889999')).toBe('02931668000188');
    });

    it('strips letters and whitespace', () => {
      expect(normalizeCnpj('  02abc931.668/0001-88xyz')).toBe('02931668000188');
    });

    it('handles null/undefined/empty safely', () => {
      expect(normalizeCnpj(null)).toBe('');
      expect(normalizeCnpj(undefined)).toBe('');
      expect(normalizeCnpj('')).toBe('');
    });

    it('roundtrips normalize → mask to reference format', () => {
      const stored = normalizeCnpj('02.931.668/0001-88');
      expect(stored).toBe('02931668000188');
      expect(maskCnpj(stored)).toBe('02.931.668/0001-88');
    });

    it('isNormalizedCnpj accepts only 14 digits without punctuation', () => {
      expect(isNormalizedCnpj('02931668000188')).toBe(true);
      expect(isNormalizedCnpj('02.931.668/0001-88')).toBe(false);
      expect(isNormalizedCnpj('0293166800018')).toBe(false);
      expect(isNormalizedCnpj('')).toBe(false);
      expect(isNormalizedCnpj(null)).toBe(false);
    });
  });

  describe('normalizeCnpj — edge cases (<14, >14, empty)', () => {
    it('empty / whitespace / non-digit-only returns ""', () => {
      expect(normalizeCnpj('')).toBe('');
      expect(normalizeCnpj('   ')).toBe('');
      expect(normalizeCnpj('abc-xyz/---')).toBe('');
    });

    it('less than 14 digits preserves partial digits (no padding)', () => {
      expect(normalizeCnpj('02')).toBe('02');
      expect(normalizeCnpj('02.931')).toBe('02931');
      expect(normalizeCnpj('02.931.668/0001-8')).toBe('0293166800018'); // 13
      expect(isNormalizedCnpj(normalizeCnpj('02.931.668/0001-8'))).toBe(false);
    });

    it('exactly 14 digits is a fixed point (idempotent)', () => {
      const canonical = '02931668000188';
      expect(normalizeCnpj(canonical)).toBe(canonical);
      expect(normalizeCnpj(normalizeCnpj(canonical))).toBe(canonical);
      expect(isNormalizedCnpj(canonical)).toBe(true);
    });

    it('more than 14 digits is truncated to first 14', () => {
      expect(normalizeCnpj('02931668000188999')).toBe('02931668000188');
      expect(normalizeCnpj('02.931.668/0001-88 extra 12345')).toBe('02931668000188');
    });

    it('consistency: normalize → mask → normalize is stable', () => {
      const samples = [
        '02.931.668/0001-88',
        '  02 931 668 / 0001-88  ',
        '02931668000188',
        '02.931.668/0001-88 lixo',
      ];
      for (const s of samples) {
        const norm = normalizeCnpj(s);
        expect(norm).toBe('02931668000188');
        expect(maskCnpj(norm)).toBe('02.931.668/0001-88');
        expect(normalizeCnpj(maskCnpj(norm))).toBe(norm);
        expect(isNormalizedCnpj(norm)).toBe(true);
      }
    });

    it('mask of partial digits does not falsely satisfy isNormalizedCnpj', () => {
      const partial = normalizeCnpj('02.931');
      expect(isNormalizedCnpj(partial)).toBe(false);
      expect(isNormalizedCnpj(maskCnpj(partial))).toBe(false);
    });
  });



  describe('Phone Masking', () => {
    it('masks a 10-digit landline number', () => {
      expect(maskPhone('1133445566')).toBe('(11) 3344-5566');
    });

    it('masks an 11-digit mobile number', () => {
      expect(maskPhone('11999887766')).toBe('(11) 99988-7766');
    });
  });

  describe('CEP Masking', () => {
    it('masks a raw 8-digit string to CEP format', () => {
      expect(maskCep('12345678')).toBe('12345-678');
    });
  });
});
