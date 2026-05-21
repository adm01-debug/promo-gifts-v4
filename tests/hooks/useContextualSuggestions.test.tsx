import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useContextualSuggestions } from '@/hooks/intelligence/useContextualSuggestions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('useContextualSuggestions', () => {
  it('should initialize successfully', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useContextualSuggestions(), { wrapper });
    
    expect(result.current).toBeDefined();
    expect(result.current.suggestions).toBeDefined();
  });
});
