/**
 * Shared render helpers and mocks for component render tests.
 */
import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { vi } from "vitest";

// --- Supabase mock ---
// Issue #59 fix: builder chainable completo + auth.signOut/refreshSession/mfa.
// Antes faltavam `.like()`, `.ilike()`, `.gte()`, `.lte()`, etc., causando
// "supabase.from(...).select(...).like is not a function" em testes de admin.
vi.mock("@/integrations/supabase/client", () => {
  // Builder retornado por `.from(table)` — todos os métodos retornam o próprio
  // builder (this) para permitir chain arbitrário, e `single`/`maybeSingle`/`then`
  // resolvem com `{ data, error }` no shape do supabase-js 2.x.
  const builderFactory = () => {
    const builder: Record<string, unknown> = {};
    const chainMethods = [
      "select", "insert", "update", "delete", "upsert",
      "eq", "neq", "gt", "gte", "lt", "lte",
      "like", "ilike", "in", "is", "not", "or", "and",
      "match", "contains", "containedBy", "overlaps",
      "filter", "order", "limit", "range", "abortSignal",
      "csv", "explain", "rollback", "returns",
    ];
    for (const m of chainMethods) {
      builder[m] = vi.fn().mockReturnValue(builder);
    }
    // Terminais — resolvem com { data, error }.
    builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.then = vi.fn((onFulfilled?: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(onFulfilled),
    );
    return builder;
  };

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
        signInWithOAuth: vi.fn().mockResolvedValue({ data: null, error: null }),
        signUp: vi.fn().mockResolvedValue({ data: null, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: null, error: null }),
        updateUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi
            .fn()
            .mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null }),
          listFactors: vi.fn().mockResolvedValue({ data: { totp: [], all: [] }, error: null }),
          enroll: vi.fn().mockResolvedValue({ data: null, error: null }),
          challenge: vi.fn().mockResolvedValue({ data: null, error: null }),
          verify: vi.fn().mockResolvedValue({ data: null, error: null }),
          unenroll: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
      from: vi.fn(builderFactory),
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
      removeAllChannels: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: null, error: null }),
          download: vi.fn().mockResolvedValue({ data: null, error: null }),
          remove: vi.fn().mockResolvedValue({ data: null, error: null }),
          list: vi.fn().mockResolvedValue({ data: [], error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "" } }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "" }, error: null }),
        }),
      },
    },
  };
});

// --- @/hooks/admin mock (Issue #59) ---
// Auth.tsx importa `useDevGate` + `useIPValidation` daqui; AdminLayout importa
// vários outros. Mock genérico cobre todos sem precisar atualizar test files.
vi.mock("@/hooks/admin", () => ({
  useDevGate: vi.fn().mockReturnValue({ isAllowed: false, isDev: false }),
  useIPValidation: vi.fn().mockReturnValue({
    validateIPForAuthenticatedUser: vi.fn().mockResolvedValue({ isAllowed: true }),
    logLoginAttempt: vi.fn(),
    fetchCurrentIP: vi.fn().mockResolvedValue("0.0.0.0"),
  }),
  useAllowedIPs: vi.fn().mockReturnValue({ ips: [], isLoading: false, refetch: vi.fn() }),
  useIPValidationConfig: vi.fn().mockReturnValue({ config: null, isLoading: false }),
}));

// --- @/services/authService mock (Issue #59) ---
// AuthContext.tsx importa authService.signOut + outros. Mock cobre todos os
// métodos para evitar "authService.signOut is not a function" em testes que
// não fazem mock explícito.
vi.mock("@/services/authService", () => ({
  authService: {
    signIn: vi.fn().mockResolvedValue({ data: null, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    fetchAAL: vi.fn().mockResolvedValue({ currentAAL: "aal1", nextAAL: "aal1", hasMFA: false }),
    queryRoles: vi.fn().mockResolvedValue({ data: [], error: null }),
    fetchProfile: vi.fn().mockResolvedValue({ data: null, error: null }),
    updateLastLogin: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// --- Auth context mock ---
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: "test-user-id", email: "test@test.com" },
    session: { access_token: "mock-token" },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// --- Sonner/toast mock ---
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
  Toaster: () => null,
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
  }),
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface WrapperOptions {
  route?: string;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: WrapperOptions & Omit<RenderOptions, "wrapper">
) {
  const queryClient = createTestQueryClient();
  const { route = "/", ...renderOptions } = options || {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
