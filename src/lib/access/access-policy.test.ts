import { describe, it, expect } from 'vitest';
import { checkAccess } from './access-policy';

describe('checkAccess', () => {
  it('should allow access when no policy is provided', () => {
    const result = checkAccess(['agente'], 'aal1', {});
    expect(result.allowed).toBe(true);
  });

  it('should block non-dev users when requireDev is true', () => {
    const result = checkAccess(['supervisor'], 'aal1', { requireDev: true });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('insufficient_role');
  });

  it('should allow dev users when requireDev is true', () => {
    const result = checkAccess(['dev'], 'aal1', { requireDev: true });
    expect(result.allowed).toBe(true);
  });

  it('should block non-supervisors when requiredRole is supervisor', () => {
    const result = checkAccess(['agente'], 'aal1', { requiredRole: 'supervisor' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('insufficient_role');
  });

  it('should allow supervisor or dev when requiredRole is supervisor', () => {
    const result1 = checkAccess(['supervisor'], 'aal1', { requiredRole: 'supervisor' });
    const result2 = checkAccess(['dev'], 'aal1', { requiredRole: 'supervisor' });
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
  });

  it('should block aal1 sessions when requireMfa is true', () => {
    const result = checkAccess(['dev'], 'aal1', { requireMfa: true });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('mfa_required');
  });

  it('should allow aal2 sessions when requireMfa is true', () => {
    const result = checkAccess(['dev'], 'aal2', { requireMfa: true });
    expect(result.allowed).toBe(true);
  });
});
