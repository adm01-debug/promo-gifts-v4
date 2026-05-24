import { describe, it, expect } from 'vitest';
import { maskCnpj, maskPhone, validateCnpj, maskCep } from './masks';

describe('Utility Masks & Validation', () => {
  describe('CNPJ Masking & Validation', () => {
    it('masks a raw 14-digit string to CNPJ format', () => {
      expect(maskCnpj('12345678000195')).toBe('12.345.678/0001-95');
    });

    it('truncates more than 14 digits', () => {
      expect(maskCnpj('12345678000195999')).toBe('12.345.678/0001-95');
    });

    it('validates a real valid CNPJ', () => {
      // 12.345.678/0001-95 is a common valid test CNPJ pattern
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
