import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { Header } from "@/components/layout/Header";
import { SidebarReorganized } from "@/components/layout/SidebarReorganized";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { SellerCartProvider } from "@/contexts/SellerCartContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { AriaLiveProvider } from "@/components/a11y";


// Mock das dependências que poderiam causar efeitos colaterais ou erros de contexto
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null })),
          order: vi.fn(() => Promise.resolve({ data: [] })),
        })),
        count: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ count: 0 })),
        })),
      })),
    })),
    rpc: vi.fn(),
  },
}));

// Mock do módulo de telemetria para evitar erros de importação ou execução em teste
vi.mock("@/lib/telemetry/structuredLogger", () => ({
  createClientLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    headers: vi.fn(() => ({})),
  })),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <OrganizationProvider>
            <OnboardingProvider>
              <SellerCartProvider>
                <AriaLiveProvider>
                  <TooltipProvider>
                    {children}
                  </TooltipProvider>
                </AriaLiveProvider>
              </SellerCartProvider>
            </OnboardingProvider>
          </OrganizationProvider>
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

