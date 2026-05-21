import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { useCollections } from '@/hooks/collections/useCollections';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock AuthContext so useCollections can call useAuth
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: "test-user-id", email: "test@test.com" },
    session: { access_token: "mock-token" },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useCollections', () => {
  it('should initialize with empty collections', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCollections(), { wrapper });
    
    expect(result.current).toBeDefined();
    expect(result.current.collections).toBeDefined();
    expect(Array.isArray(result.current.collections)).toBe(true);
  });
});
