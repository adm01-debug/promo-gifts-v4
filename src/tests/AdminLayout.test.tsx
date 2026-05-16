import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import AdminConexoesPage from "@/pages/admin/AdminConexoesPage";
import AdminConexoesStatusPage from "@/pages/admin/AdminConexoesStatusPage";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { AriaLiveProvider } from "@/components/a11y/AriaLive";

// Mock das hooks que dependem de rede/Supabase
vi.mock("@/hooks/useSecretsManager", () => ({
  useSecretsManager: () => ({
    secrets: [],
    list: vi.fn(),
    refreshCache: vi.fn(),
    getRotationHistory: vi.fn().mockResolvedValue([]),
    isLoading: false,
  }),
}));

vi.mock("@/components/admin/connections/useSeverityChangeNotifier", () => ({
  useSeverityChangeNotifier: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

// Mock do SidebarReorganized para verificar se ele é renderizado
vi.mock("@/components/layout/SidebarReorganized", () => ({
  SidebarReorganized: () => <div data-testid="sidebar">Sidebar</div>,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <HelmetProvider>
      <TooltipProvider>
        <AriaLiveProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <ThemeProvider>
                <AuthProvider>
                  {ui}
                </AuthProvider>
              </ThemeProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </AriaLiveProvider>
      </TooltipProvider>
    </HelmetProvider>
  );
};


describe("Admin Layout Standardization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AdminConexoesPage deve renderizar dentro do MainLayout (com sidebar)", async () => {
    renderWithProviders(<AdminConexoesPage />);
    // O MainLayout renderiza o sidebar. Verificamos se o mock do sidebar apareceu.
    expect(await screen.findByTestId("sidebar", {}, { timeout: 3000 })).toBeInTheDocument();
    // Verifica título da página para garantir que o conteúdo está lá
    expect(screen.getAllByText(/Conexões/i).length).toBeGreaterThan(0);
  });

  it("AdminConexoesStatusPage deve renderizar dentro do MainLayout (com sidebar)", async () => {
    renderWithProviders(<AdminConexoesStatusPage />);
    expect(await screen.findByTestId("sidebar", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/Status da sincronização/i)).toBeInTheDocument();
  });
});
