import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MockupGenerator from '@/pages/mockups/MockupGenerator';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HelmetProvider } from 'react-helmet-async';
import * as mockupService from '@/hooks/mockup/mockupGenerationService';
import { toast } from 'sonner';
import { ProductsProvider } from '@/contexts/ProductsContext';
import { AriaLiveProvider } from '@/components/a11y/AriaLive';

// Mock global environment
window.scrollTo = vi.fn();

// Mock services
vi.mock('@/hooks/mockup/mockupGenerationService', () => ({
  deleteMockupFromDb: vi.fn(),
  fetchMockupHistory: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockMg = {
  user: { id: 'user-123' },
  mockupHistory: [
    {
      id: 'mockup-1',
      product_name: 'Caneca 325ml',
      technique_name: 'Sublimação',
      mockup_url: 'https://example.com/mockup1.png',
      created_at: new Date().toISOString(),
      client_name: 'Cliente Teste',
    },
  ],
  isLoadingHistory: false,
  fetchHistory: vi.fn(),
  historyClients: [],
  activeTab: 'generator',
  setActiveTab: vi.fn(),
  isLoading: false,
  selectedProduct: null,
  selectedTechnique: null,
  selectedClient: null,
  hasLogo: false,
  wizardStep: 1,
  generatedMockup: null,
  generatedBatchMockups: [],
  generationError: null,
  setGenerationError: vi.fn(),
  showDraftRestoredNotice: false,
  positionHistory: { canUndo: false, canRedo: false, undo: vi.fn(), redo: vi.fn() },
  isDraftSaving: false,
  lastSaved: null,
  draftError: null,
  techniques: [],
  productSelection: null,
  isLoadingData: false,
  personalizationAreas: [],
  filteredTechniques: [],
  setProductSelection: vi.fn(),
  setSelectedClient: vi.fn(),
  resetForm: vi.fn(),
  activeAreaId: null,
  setPersonalizationAreas: vi.fn(),
  setActiveAreaId: vi.fn(),
  handleAreaLogoUpload: vi.fn(),
  logoColorAnalysis: { colors: [], clearAnalysis: vi.fn() },
  productLocations: [],
  getProductImage: vi.fn(),
  activeArea: null,
  lastSavedRecordId: null,
  setLastSavedRecordId: vi.fn(),
  lastSavedMockupUrl: null,
  setLastSavedMockupUrl: vi.fn(),
  lastSavedLayoutMode: 'static',
  setLastSavedLayoutMode: vi.fn(),
  downloadMockup: vi.fn(),
  generateMockup: vi.fn(),
  saveMockupToHistory: vi.fn(),
};

vi.mock('@/hooks/mockup', () => ({
  useMockupGenerator: () => mockMg,
}));

vi.mock('@/hooks/mockup/MockupTechniqueHandlers', () => ({
  useTechniqueHandlers: () => ({
    handleTechniqueChange: vi.fn(),
    isDialogOpen: false,
    setIsDialogOpen: vi.fn(),
    confirmTechniqueChange: vi.fn(),
    pendingTechnique: null,
    setColorConfigDialogOpen: vi.fn(),
    colorConfigDialogOpen: false,
  }),
}));

vi.mock('@/components/mockup/KeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('@/lib/telemetry/bridgeCallMetrics', () => ({
  estimatePayloadBytes: vi.fn().mockReturnValue(0),
  trackBridgeCall: vi.fn(),
  recordBridgeCall: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: { user: { id: 'user-123' } } }, error: null }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockReturnThis(),
    }),
  },
}));

vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

vi.mock('@/components/seo/PageSEO', () => ({
  PageSEO: () => null,
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
            <ProductsProvider>
              <MemoryRouter>
                <ThemeProvider>
                  <AuthProvider>{ui}</AuthProvider>
                </ThemeProvider>
              </MemoryRouter>
            </ProductsProvider>
          </QueryClientProvider>
        </AriaLiveProvider>
      </TooltipProvider>
    </HelmetProvider>,
  );
};

describe('Mockup Deletion Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMg.activeTab = 'generator';
    vi.mocked(mockupService.deleteMockupFromDb).mockResolvedValue(undefined);
  });

  it('deve abrir o diálogo de confirmação ao clicar em excluir', async () => {
    mockMg.activeTab = 'history';
    renderWithProviders(<MockupGenerator />);

    // Encontrar e clicar no botão de excluir
    const deleteButton = await screen.findByTestId('delete-mockup-button');
    fireEvent.click(deleteButton);

    // Verificar se o diálogo apareceu
    expect(screen.getByText(/Excluir mockup\?/i)).toBeInTheDocument();
  });

  it('deve chamar deleteMockupFromDb e atualizar a lista ao confirmar', async () => {
    mockMg.activeTab = 'history';
    renderWithProviders(<MockupGenerator />);

    const deleteButton = await screen.findByTestId('delete-mockup-button');
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByRole('button', {
      name: /excluir/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockupService.deleteMockupFromDb).toHaveBeenCalledWith('mockup-1', 'user-123');
    });

    expect(toast.success).toHaveBeenCalledWith('Mockup excluído com sucesso');
    expect(mockMg.fetchHistory).toHaveBeenCalled();
  });

  it('deve exibir toast de erro quando a deleção falhar', async () => {
    vi.mocked(mockupService.deleteMockupFromDb).mockRejectedValue(new Error('Database error'));
    mockMg.activeTab = 'history';

    renderWithProviders(<MockupGenerator />);

    const deleteButton = await screen.findByTestId('delete-mockup-button');
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByRole('button', {
      name: /excluir/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Não foi possível excluir o mockup. Tente novamente.',
      );
    });
  });
});
