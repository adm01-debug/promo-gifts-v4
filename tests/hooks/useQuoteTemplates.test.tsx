import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuoteTemplates } from '@/hooks/quotes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import React from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

describe('useQuoteTemplates', () => {
  it('should return templates state and functions', async () => {
    let hookResult: ReturnType<typeof renderHook>;
    await act(async () => {
      hookResult = renderHook(() => useQuoteTemplates(), { wrapper: createWrapper() });
    });

    await waitFor(() => {
      expect(hookResult!.result.current).toBeDefined();
      expect(hookResult!.result.current.templates).toBeDefined();
      expect(typeof hookResult!.result.current.loading).toBe('boolean');
      expect(typeof hookResult!.result.current.createTemplate).toBe('function');
    });
  });
});
