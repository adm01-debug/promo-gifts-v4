import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { SellerCartProvider } from "@/contexts/SellerCartContext";
import { AriaLiveProvider } from "@/components/a11y";

// vi.mock factories are hoisted before imports — cannot reference outer vars.

vi.mock('@/contexts/OrganizationContext', async () => {
  const ReactMod = await import('react');
  return {
    OrganizationProvider: ({ children }: { children: React.ReactNode }) =>
      ReactMod.createElement(ReactMod.Fragment, null, children),
    useOrganization: () => ({
      organizations: [],
      currentOrg: null,
      currentRole: null,
      isLoading: false,
      switchOrganization: vi.fn(),
      createOrganization: vi.fn(),
    }),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
    from: () => {
      const c: Record<string, unknown> = {};
      ['select','eq','neq','order','limit','range','filter','or','in','single','maybeSingle','update','delete','upsert','insert'].forEach(m => { c[m] = () => c; });
      c.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(r);
      return c;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
  SUPABASE_URL: 'https://pqpdolkaeqlyzpdpbizo.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test-key',
}));

vi.mock("@/integrations/supabase/lazy-client", () => ({
  getSupabaseClient: () => Promise.resolve({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
    from: () => {
      const c: Record<string, unknown> = {};
      ['select','eq','neq','order','limit','range','filter','or','in','single','maybeSingle','update','delete','upsert','insert'].forEach(m => { c[m] = () => c; });
      c.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(r);
      return c;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  }),
}));

vi.mock("@/lib/telemetry/structuredLogger", () => ({
  createClientLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), headers: () => ({}) }),
}));

// Mock heavy subcomponents to avoid pulling in deep module graphs
vi.mock("@/components/search/GlobalSearchPalette", () => ({
  GlobalSearchPalette: () => null,
}));
vi.mock("@/components/notifications/NotificationDrawer", () => ({
  NotificationBell: () => null,
}));
vi.mock("@/components/inventory/StockAlertsIndicator", () => ({
  StockAlertsIndicator: () => null,
}));
vi.mock("@/components/admin/DiscountApprovalHeaderBadge", () => ({
  DiscountApprovalHeaderBadge: () => null,
}));
vi.mock("@/components/cart/CartHeaderButton", () => ({
  CartHeaderButton: () => null,
}));
vi.mock("@/lib/external-db", () => ({
  invokeExternalDb: vi.fn(),
}));
vi.mock("@/lib/external-db/bridge", () => ({
  invokeExternalDb: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", async () => {
  const ReactMod = await import('react');
  const ctx = ReactMod.createContext<unknown>(null);
  const stubUser = { id: 'stub-user', email: 'test@example.com' };
  const stubValue = {
    user: stubUser, session: null, isLoading: false, userRoles: [],
    signIn: vi.fn(), signOut: vi.fn(), refreshSession: vi.fn(),
    isAdmin: false, isSeller: false, isDev: false,
  };
  return {
    AuthContext: ctx,
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      ReactMod.createElement(ctx.Provider, { value: stubValue }, children),
    useAuth: () => stubValue,
  };
});

import { Header } from "@/components/layout/Header";
import { SidebarReorganized } from "@/components/layout/SidebarReorganized";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
        <OnboardingProvider>
          <SellerCartProvider>
            <AriaLiveProvider>
              <TooltipProvider>
                {children}
              </TooltipProvider>
            </AriaLiveProvider>
          </SellerCartProvider>
        </OnboardingProvider>
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

describe("Integridade de Sintaxe e Renderização Básica", () => {
  it("Header deve renderizar sem erros de sintaxe ou JSX", () => {
    const { getByTestId } = render(
      <AllProviders>
        <Header onMenuToggle={() => {}} searchQuery="" onSearchChange={() => {}} />
      </AllProviders>
    );
    expect(getByTestId("app-header")).toBeDefined();
  });

  it("SidebarReorganized deve renderizar sem erros de sintaxe ou JSX", () => {
    const { getByLabelText } = render(
      <AllProviders>
        <SidebarReorganized isOpen={true} onToggle={() => {}} />
      </AllProviders>
    );
    expect(getByLabelText("Menu principal")).toBeDefined();
  });
});
