import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useIPValidation } from './useIPValidation';
import { supabase } from '@/integrations/supabase/client';

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


// TODO(test-debt): 6 testes falham — mock supabase.functions.invoke retorna shape errado.
// Skipado em fix(test): eliminate 88 test failures. Origem: revert 06-07/mai/2026.
// Fixar em PR separado quando ownership for retomada.

describe('useIPValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchCurrentIP', () => {
    it('returns IP when fetch is successful', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ip: '1.2.3.4' }),
      });

      const { result } = renderHook(() => useIPValidation());
      const ip = await result.current.fetchCurrentIP();

      expect(ip).toBe('1.2.3.4');
      expect(mockFetch).toHaveBeenCalledWith('https://api.ipify.org?format=json');
    });

    it('returns null when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useIPValidation());
      const ip = await result.current.fetchCurrentIP();

      expect(ip).toBeNull();
    });
  });

  describe('validateIPForAuthenticatedUser', () => {
    it('returns isAllowed true when IP is whitelisted', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ip: '1.2.3.4' }),
      });

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { allowed: true, reason: 'whitelisted' },
        error: null,
      } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

      const { result } = renderHook(() => useIPValidation());

      let validationResult;
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
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ip: '1.2.3.4' }),
      });

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { allowed: false, reason: 'ip_not_whitelisted' },
        error: null,
      } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

      const { result } = renderHook(() => useIPValidation());

      let validationResult;
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
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ip: '1.2.3.4' }),
      });

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Function error' },
      } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

      const { result } = renderHook(() => useIPValidation());

      let validationResult;
      await act(async () => {
        validationResult = await result.current.validateIPForAuthenticatedUser('user-123');
      });

      expect(validationResult?.isAllowed).toBe(true);
      expect(validationResult?.error).toBe('Function error');
    });

    it('returns error when current IP cannot be identified', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({}), // Missing ip field
      });

      const { result } = renderHook(() => useIPValidation());

      let validationResult;
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
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ip: '1.2.3.4' }),
      });

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          allowed: false,
          reason: 'city_not_whitelisted',
          details: { detected_city: 'São Paulo' },
        },
        error: null,
      } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

      const { result } = renderHook(() => useIPValidation());

      let validationResult;
      await act(async () => {
        validationResult = await result.current.validateIPForAuthenticatedUser('user-123');
      });

      expect(validationResult?.isAllowed).toBe(false);
      expect(validationResult?.error).toContain('São Paulo');
    });

    it('handles too_many_attempts reason correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ip: '1.2.3.4' }),
      });

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          allowed: false,
          reason: 'too_many_attempts',
          details: { lockout_minutes: 30 },
        },
        error: null,
      } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

      const { result } = renderHook(() => useIPValidation());

      let validationResult;
      await act(async () => {
        validationResult = await result.current.validateIPForAuthenticatedUser('user-123');
      });

      expect(validationResult?.isAllowed).toBe(false);
      expect(validationResult?.error).toContain('30 minutos');
    });

    it('manages isValidating state correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ip: '1.2.3.4' }),
      });

      let resolveInvoke: (value: Awaited<ReturnType<typeof supabase.functions.invoke>>) => void;
      const invokePromise = new Promise<Awaited<ReturnType<typeof supabase.functions.invoke>>>(
        (resolve) => {
          resolveInvoke = resolve;
        },
      );

      vi.mocked(supabase.functions.invoke).mockReturnValueOnce(invokePromise);

      const { result } = renderHook(() => useIPValidation());

      expect(result.current.isValidating).toBe(false);

      let validationPromise;
      await act(async () => {
        validationPromise = result.current.validateIPForAuthenticatedUser('user-123');
      });

      expect(result.current.isValidating).toBe(true);

      await act(async () => {
        resolveInvoke({ data: { allowed: true }, error: null });
        await validationPromise;
      });

      expect(result.current.isValidating).toBe(false);
    });
  });

  describe('logLoginAttempt', () => {
    it('calls log-login-attempt even if fetchCurrentIP fails', async () => {
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
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ip: '1.2.3.4' }),
      });

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
