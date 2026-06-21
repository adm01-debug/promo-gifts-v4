import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MockupGenerator from '@/pages/mockups/MockupGenerator';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HelmetProvider } from 'react-helmet-async';
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
  // Unified delete flow now lives in the hook (G7) + rich load-from-history (G8).
  deleteDialogOpen: false,
  mockupToDelete: null as string | null,
  setDeleteDialogOpen: vi.fn(),
  setMockupToDelete: vi.fn(),
  deleteMockup: vi.fn(),
  loadFromHistory: vi.fn(),
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
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: 'aal1', nextLevel: 'aal1' },
          error: null,
        }),
        listFactors: vi.fn().mockResolvedValue({
          data: { all: [], totp: [] },
          error: null,
        }),
        challenge: vi.fn().mockResolvedValue({ data: null, error: null }),
        verify: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
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
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test-anon-key',
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
    mockMg.deleteDialogOpen = false;
    mockMg.mockupToDelete = null;
  });

  it('opens the delete flow (selects the mockup + opens the dialog) when clicking delete', async () => {
    mockMg.activeTab = 'history';
    renderWithProviders(<MockupGenerator />);

    const deleteButton = await screen.findByTestId('delete-mockup-button', {}, { timeout: 8000 });
    fireEvent.click(deleteButton);

    // G7: the page no longer owns delete state — it delegates to the hook.
    expect(mockMg.setMockupToDelete).toHaveBeenCalledWith('mockup-1');
    expect(mockMg.setDeleteDialogOpen).toHaveBeenCalledWith(true);
  });

  it('delegates confirmation to the hook deleteMockup', async () => {
    mockMg.activeTab = 'history';
    mockMg.deleteDialogOpen = true;
    renderWithProviders(<MockupGenerator />);

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /excluir/i }));

    await waitFor(() => {
      expect(mockMg.deleteMockup).toHaveBeenCalledTimes(1);
    });
  });

  it('loads a full configuration from history via loadFromHistory (G8)', async () => {
    mockMg.activeTab = 'history';
    renderWithProviders(<MockupGenerator />);

    // aria-label passou a ser descritivo ("Regenerar mockup de {produto}") —
    // casa por prefixo via regex em vez do texto exato.
    const regenerate = (await screen.findAllByLabelText(/^Regenerar/))[0];
    fireEvent.click(regenerate);

    expect(mockMg.loadFromHistory).toHaveBeenCalledTimes(1);
    expect(mockMg.loadFromHistory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mockup-1' }),
    );
  });
});
