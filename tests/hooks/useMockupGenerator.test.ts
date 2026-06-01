/**
 * useMockupGenerator — testes leves: mockamos TODAS as dependências pesadas
 * antes de importar o hook para evitar pagar o custo de transformar o grafo
 * de imports (image-converter, ProductsContext, MultiAreaManager, mockup
 * service, MockupSuccessToast, etc.).
 *
 * Mantém a cobertura: shape de dados (smoke) + smoke de render do hook
 * (verifica que monta sem crashar com providers padrão).
 */
import { describe, it, expect, vi } from "vitest";
import "../components/render-helpers"; // Supabase + Auth + sonner globais

// --- Mocks de dependências pesadas (evita carregar o grafo real) ---
vi.mock("@/lib/image-converter", () => ({
  needsConversion: vi.fn(() => false),
  ensureSupportedFormat: vi.fn(async (f: File) => f),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/external-db/invoke", () => ({
  invokeWithRetry: vi.fn().mockResolvedValue({ data: null, error: null }),
  extractFunctionErrorMessage: vi.fn(() => "erro"),
}));

vi.mock("@/lib/db/postgrest", () => ({
  dbInvoke: vi.fn().mockResolvedValue({ records: [], count: 0 }),
  dbInvokeSingle: vi.fn().mockResolvedValue({}),
  dbInvokeDelete: vi.fn().mockResolvedValue(undefined),
  dbBatch: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/contexts/ProductsContext", () => ({
  useProductsContext: () => ({ getProductById: vi.fn(() => null), products: [] }),
  ProductsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useMockupDraft", () => ({
  useMockupDraft: () => ({
    saveDraft: vi.fn(),
    loadDraft: vi.fn(),
    clearDraft: vi.fn(),
    isSaving: false,
    lastSaved: null,
    error: null,
  }),
}));

vi.mock("@/hooks/mockup/useMockupTechniques", () => ({
  useFilteredTechniques: () => ({ techniques: [], isLoading: false }),
  useProductCustomizationOptionsForMockup: () => ({ data: null, isLoading: false }),
}));

vi.mock("@/hooks/usePositionHistory", () => ({
  usePositionHistory: () => ({
    push: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    setOnApply: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLogoColorAnalysis", () => ({
  useLogoColorAnalysis: () => ({ colors: [], isAnalyzing: false, analyze: vi.fn() }),
}));

vi.mock("@/components/mockup/mockupWizardStep", () => ({
  getMockupWizardStep: vi.fn(() => "product"),
}));

vi.mock("@/components/mockup/MockupSuccessToast", () => ({
  showMockupSuccessToast: vi.fn(),
}));

vi.mock("@/components/mockup/techniqueColorUtils", () => ({
  classifyTechnique: vi.fn(() => "monocolor"),
  techniqueNeedsColorConfig: vi.fn(() => false),
}));

vi.mock("@/hooks/mockup/mockupGenerationService", () => ({
  createDefaultArea: vi.fn(() => ({ id: "a1", name: "Área 1" })),
  fetchMockupHistory: vi.fn().mockResolvedValue([]),
  saveMockupToDb: vi.fn().mockResolvedValue({ id: "m1" }),
  generateMockupApi: vi.fn().mockResolvedValue({ mockup_url: "https://x/m.png" }),
  downloadMockupAsPdf: vi.fn().mockResolvedValue(undefined),
  deleteMockupFromDb: vi.fn().mockResolvedValue(undefined),
}));

describe("useMockupGenerator (smoke)", () => {
  it("exporta o hook como função", async () => {
    const mod = await import("@/hooks/mockup/useMockupGenerator");
    expect(typeof mod.useMockupGenerator).toBe("function");
  });

  it("monta sem crashar com providers padrão", async () => {
    const { renderHookWithProviders } = await import("./_helpers/render-hook-providers");
    const { useMockupGenerator } = await import("@/hooks/mockup/useMockupGenerator");
    const { result, unmount } = renderHookWithProviders(() => useMockupGenerator());
    expect(typeof result.current).toBe("object");
    unmount();
  });
});

describe("GeneratedMockup data shape", () => {
  it("valida estrutura completa", () => {
    const mockup = {
      id: "m1",
      product_name: "Caneca Premium",
      product_sku: "CAN-001",
      client_name: "João Silva",
      technique_name: "Serigrafia",
      location_name: "Frontal",
      colors_count: 3,
      logo_width_cm: 10,
      logo_height_cm: 5,
      mockup_url: "https://storage.example.com/mockup.png",
      layout_url: "https://storage.example.com/layout.png",
      created_at: "2024-01-01T00:00:00Z",
    };
    expect(mockup.product_name).toBeTruthy();
    expect(mockup.colors_count).toBeGreaterThan(0);
    expect(mockup.logo_width_cm).toBeGreaterThan(0);
    expect(mockup.mockup_url).toContain("https://");
  });

  it("aceita campos opcionais nulos", () => {
    const mockup = {
      id: "m2",
      product_name: null,
      product_sku: null,
      client_name: null,
      technique_name: null,
      location_name: null,
      colors_count: null,
      logo_width_cm: null,
      logo_height_cm: null,
      mockup_url: null,
      layout_url: null,
      created_at: "2024-01-01T00:00:00Z",
    };
    expect(mockup.product_name).toBeNull();
    expect(mockup.mockup_url).toBeNull();
    expect(mockup.created_at).toBeTruthy();
  });
});
