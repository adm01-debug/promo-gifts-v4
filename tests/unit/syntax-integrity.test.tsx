import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { Header } from "@/components/layout/Header";
import { SidebarReorganized } from "@/components/layout/SidebarReorganized";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";

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
      })),
    })),
  },
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
          <TooltipProvider>
            {children}
          </TooltipProvider>
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
    const { getByRole } = render(
      <AllProviders>
        <SidebarReorganized isOpen={true} onToggle={() => {}} />
      </AllProviders>
    );
    expect(getByRole("navigation")).toBeDefined();
  });
});
