import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useIPValidation } from '@/hooks/admin/useIPValidation';
import { supabase } from '@/integrations/supabase/client';

type ValidationResult = Awaited<
  ReturnType<ReturnType<typeof useIPValidation>['validateIPForAuthenticatedUser']>
>;

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useIPValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: successful get-visitor-info
    vi.mocked(supabase.functions.invoke).mockImplementation(async (fnName) => {
      if (fnName === 'get-visitor-info') return { data: { ip: '1.2.3.4' }, error: null };
      return { data: null, error: null };
    });
  });

  describe('fetchCurrentIP', () => {
    it('returns IP from get-visitor-info when successful', async () => {
      const { result } = renderHook(() => useIPValidation());
      const ip = await result.current.fetchCurrentIP();

      expect(ip).toBe('1.2.3.4');
      expect(supabase.functions.invoke).toHaveBeenCalledWith('get-visitor-info');
      // Should NOT call ipify if visitor info succeeds
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('falls back to ipify when get-visitor-info fails', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed' },
      });
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ip: '5.6.7.8' }),
      });

      const { result } = renderHook(() => useIPValidation());
      const ip = await result.current.fetchCurrentIP();

      expect(ip).toBe('5.6.7.8');
      expect(mockFetch).toHaveBeenCalledWith('https://api.ipify.org?format=json');
    });

    it('returns null when both methods fail', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed' },
      });
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useIPValidation());
      const ip = await result.current.fetchCurrentIP();

      expect(ip).toBeNull();
    });
  });

  describe('validateIPForAuthenticatedUser', () => {
    it('returns isAllowed true when IP is whitelisted', async () => {
      vi.mocked(supabase.functions.invoke).mockImplementation(async (fnName) => {
        if (fnName === 'get-visitor-info') return { data: { ip: '1.2.3.4' }, error: null };
        if (fnName === 'validate-access')
          return { data: { allowed: true, reason: 'whitelisted' }, error: null };
        return { data: null, error: null };
      });

      const { result } = renderHook(() => useIPValidation());

      let validationResult: ValidationResult | undefined;
      await act(async () => {
        validationResult = await result.current.validateIPForAuthenticatedUser('user-123');
      });

      expect(validationResult).toEqual({
        isAllowed: true,
        currentIP: '1.2.3.4',
        hasRestrictions: true,
      });
    });

    it('returns isAllowed false when IP is blocked', async () => {
      vi.mocked(supabase.functions.invoke).mockImplementation(async (fnName) => {
        if (fnName === 'get-visitor-info') return { data: { ip: '1.2.3.4' }, error: null };
        if (fnName === 'validate-access')
          return { data: { allowed: false, reason: 'ip_not_whitelisted' }, error: null };
        return { data: null, error: null };
      });

      const { result } = renderHook(() => useIPValidation());

      let validationResult: ValidationResult | undefined;
      await act(async () => {
        validationResult = await result.current.validateIPForAuthenticatedUser('user-123');
      });

      expect(validationResult).toMatchObject({
        isAllowed: false,
        currentIP: '1.2.3.4',
        reason: 'ip_not_whitelisted',
      });
      expect(validationResult?.error).toContain('não está autorizado');
    });

    it('fails open when edge function errors', async () => {
      vi.mocked(supabase.functions.invoke).mockImplementation(async (fnName) => {
        if (fnName === 'get-visitor-info') return { data: { ip: '1.2.3.4' }, error: null };
        if (fnName === 'validate-access')
          return { data: null, error: { message: 'Function error' } };
        return { data: null, error: null };
      });

      const { result } = renderHook(() => useIPValidation());

      let validationResult: ValidationResult | undefined;
      await act(async () => {
        validationResult = await result.current.validateIPForAuthenticatedUser('user-123');
      });

      expect(validationResult?.isAllowed).toBe(true);
      expect(validationResult?.error).toBe('Function error');
    });

    it('returns error when current IP cannot be identified', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Network' },
      });
      mockFetch.mockRejectedValueOnce(new Error('Fetch failed'));

      const { result } = renderHook(() => useIPValidation());

      let validationResult: ValidationResult | undefined;
      await act(async () => {
        validationResult = await result.current.validateIPForAuthenticatedUser('user-123');
      });

      expect(validationResult).toMatchObject({
        isAllowed: false,
        currentIP: null,
        error: 'Não foi possível identificar seu IP',
      });
    });

    it('handles city_not_whitelisted reason correctly', async () => {
      vi.mocked(supabase.functions.invoke).mockImplementation(async (fnName) => {
        if (fnName === 'get-visitor-info') return { data: { ip: '1.2.3.4' }, error: null };
        if (fnName === 'validate-access')
          return {
            data: {
              allowed: false,
              reason: 'city_not_whitelisted',
              details: { detected_city: 'São Paulo' },
            },
            error: null,
          };
        return { data: null, error: null };
      });

      const { result } = renderHook(() => useIPValidation());

      let validationResult: ValidationResult | undefined;
      await act(async () => {
        validationResult = await result.current.validateIPForAuthenticatedUser('user-123');
      });

      expect(validationResult?.isAllowed).toBe(false);
      expect(validationResult?.error).toContain('São Paulo');
    });

    it('handles too_many_attempts reason correctly', async () => {
      vi.mocked(supabase.functions.invoke).mockImplementation(async (fnName) => {
        if (fnName === 'get-visitor-info') return { data: { ip: '1.2.3.4' }, error: null };
        if (fnName === 'validate-access')
          return {
            data: {
              allowed: false,
              reason: 'too_many_attempts',
              details: { lockout_minutes: 30 },
            },
            error: null,
          };
        return { data: null, error: null };
      });

      const { result } = renderHook(() => useIPValidation());

      let validationResult: ValidationResult | undefined;
      await act(async () => {
        validationResult = await result.current.validateIPForAuthenticatedUser('user-123');
      });

      expect(validationResult?.isAllowed).toBe(false);
      expect(validationResult?.error).toContain('30 minutos');
    });

    it('manages isValidating state correctly', async () => {
      type InvokeReturn = Awaited<ReturnType<typeof supabase.functions.invoke>>;
      let resolveInvoke: (value: InvokeReturn) => void;
      const invokePromise = new Promise<InvokeReturn>((resolve) => {
        resolveInvoke = resolve;
      });

      vi.mocked(supabase.functions.invoke).mockImplementation(async (fnName) => {
        if (fnName === 'get-visitor-info') return { data: { ip: '1.2.3.4' }, error: null };
        return invokePromise;
      });

      const { result } = renderHook(() => useIPValidation());

      expect(result.current.isValidating).toBe(false);

      let validationPromise: Promise<ValidationResult> | undefined;
      await act(async () => {
        validationPromise = result.current.validateIPForAuthenticatedUser('user-123');
      });

      // Need to wait a tick for the first fetchCurrentIP to complete and then move to validate-access
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isValidating).toBe(true);

      await act(async () => {
        resolveInvoke!({ data: { allowed: true }, error: null });
        await validationPromise;
      });

      expect(result.current.isValidating).toBe(false);
    });
  });

  describe('logLoginAttempt', () => {
    it('calls log-login-attempt even if fetchCurrentIP fails', async () => {
      vi.mocked(supabase.functions.invoke).mockImplementation(async (fnName) => {
        if (fnName === 'get-visitor-info') return { data: null, error: { message: 'Failed' } };
        return { data: { success: true }, error: null };
      });
      mockFetch.mockRejectedValueOnce(new Error('Fetch failed'));

      const { result } = renderHook(() => useIPValidation());

      await act(async () => {
        await result.current.logLoginAttempt(
          'test@example.com',
          null,
          false,
          'Invalid credentials',
        );
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'log-login-attempt',
        expect.objectContaining({
          body: expect.objectContaining({
            ip_address: 'unknown',
            success: false,
            failure_reason: 'Invalid credentials',
          }),
        }),
      );
    });

    it('calls log-login-attempt edge function', async () => {
      const { result } = renderHook(() => useIPValidation());

      await act(async () => {
        await result.current.logLoginAttempt('test@example.com', 'user-123', true);
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'log-login-attempt',
        expect.objectContaining({
          body: expect.objectContaining({
            email: 'test@example.com',
            user_id: 'user-123',
            success: true,
          }),
        }),
      );
    });
  });
});
