/**
 * Unit tests for src/lib/to-error-message.ts
 */
import { describe, it, expect } from 'vitest';
import { toErrorMessage } from '@/lib/to-error-message';

describe('toErrorMessage', () => {
  it('extracts message from an Error instance', () => {
    expect(toErrorMessage(new Error('something broke'))).toBe('something broke');
  });

  it('converts a string via String()', () => {
    expect(toErrorMessage('plain string error')).toBe('plain string error');
  });

  it('converts a number', () => {
    expect(toErrorMessage(42)).toBe('42');
  });

  it('converts null', () => {
    expect(toErrorMessage(null)).toBe('null');
  });

  it('converts undefined', () => {
    expect(toErrorMessage(undefined)).toBe('undefined');
  });

  it('uses object toString', () => {
    const obj = { toString: () => 'custom object' };
    expect(toErrorMessage(obj)).toBe('custom object');
  });

  it('uses Error.message not String(error) for Error subclasses', () => {
    class CustomError extends Error {
      constructor() {
        super('custom message');
        this.name = 'CustomError';
      }
    }
    expect(toErrorMessage(new CustomError())).toBe('custom message');
  });

  it('returns empty string for Error with empty message', () => {
    expect(toErrorMessage(new Error(''))).toBe('');
  });
});
