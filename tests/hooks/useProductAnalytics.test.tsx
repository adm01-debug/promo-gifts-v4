import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProductAnalytics } from '@/hooks/productsAnalytics';
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

describe('useProductAnalytics', () => {
  it('should return analytics functions', async () => {
    let hookResult: ReturnType<typeof renderHook>;
    await act(async () => {
      hookResult = renderHook(() => useProductAnalytics(), { wrapper: createWrapper() });
    });

    await waitFor(() => {
      expect(hookResult!.result.current).toBeDefined();
      expect(typeof hookResult!.result.current.trackProductView).toBe('function');
      expect(typeof hookResult!.result.current.trackSearch).toBe('function');
    });
  });
});
