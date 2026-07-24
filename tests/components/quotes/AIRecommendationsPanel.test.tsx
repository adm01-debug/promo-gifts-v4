/**
 * Tests for AIRecommendationsPanel — current component interface.
 * Covers:
 * - Form rendering (client fields, product counter, generate button)
 * - Button disabled/enabled based on name + products
 * - Loading skeleton display
 * - Error alert display
 * - Recommendations list rendering (rank, score, reason)
 * - Insights section visibility
 * - Empty state
 * - onProductClick callback
 * - hideClientForm prop
 * - Reset (Limpar) button when data is available
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

// ── Module mocks ──────────────────────────────────────────────────

vi.mock("framer-motion", () => {
  const motionStub = {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement("div", props, children),
  };
  return {
    motion: motionStub,
    m: motionStub,
    LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    domMax: {},
    domAnimation: {},
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const mockFetchRecommendations = vi.fn();
const mockReset = vi.fn();
const mockClearCache = vi.fn();

const defaultHookState = {
  data: null as null | object,
  recommendations: [] as Array<{ productId: string; score: number; reason: string }>,
  insights: "",
  isLoading: false,
  error: null as string | null,
  fetchRecommendations: mockFetchRecommendations,
  reset: mockReset,
  clearCache: mockClearCache,
};

vi.mock("@/hooks/intelligence/useAIRecommendations", () => ({
  useAIRecommendations: vi.fn(() => defaultHookState),
}));

import { useAIRecommendations } from "@/hooks/intelligence/useAIRecommendations";
import type { ProductForRecommendation } from "@/hooks/intelligence/useAIRecommendations";
import { AIRecommendationsPanel } from "@/components/ai/AIRecommendationsPanel";

const PRODUCTS: ProductForRecommendation[] = [
  { id: "prod-1", name: "Caneta Esferográfica", category: "Escritório", description: "Caneta azul" },
  { id: "prod-2", name: "Mochila Executiva", category: "Bags" },
  { id: "prod-3", name: "Garrafa Térmica", category: "Casa", description: "500ml" },
];

describe("AIRecommendationsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAIRecommendations).mockReturnValue({ ...defaultHookState });
  });

  // ── Form rendering ─────────────────────────────────────────────

  it("renders client form fields in default state", async () => {
    renderWithProviders(<AIRecommendationsPanel products={PRODUCTS} />);

    expect(screen.getByRole("textbox", { name: /nome do cliente/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /empresa/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/segmento/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/orçamento/i)).toBeInTheDocument();
  });

  it("shows product count in the action area", async () => {
    renderWithProviders(<AIRecommendationsPanel products={PRODUCTS} />);

    expect(screen.getByText(/3 produtos disponíveis/i)).toBeInTheDocument();
  });

  it("shows singular 'produto disponível' when exactly 1 product", async () => {
    renderWithProviders(<AIRecommendationsPanel products={[PRODUCTS[0]]} />);

    expect(screen.getByText(/1 produto disponível/i)).toBeInTheDocument();
  });

  // ── Button disabled/enabled ────────────────────────────────────

  it("button is disabled when no client name and no products", async () => {
    renderWithProviders(<AIRecommendationsPanel />);

    expect(screen.getByRole("button", { name: /gerar recomendações/i })).toBeDisabled();
  });

  it("button is disabled when products provided but client name is empty", async () => {
    renderWithProviders(<AIRecommendationsPanel products={PRODUCTS} />);

    expect(screen.getByRole("button", { name: /gerar recomendações/i })).toBeDisabled();
  });

  it("button is disabled when client name set but products array is empty", async () => {
    renderWithProviders(
      <AIRecommendationsPanel products={[]} initialClient={{ name: "Corp ACME" }} />
    );

    expect(screen.getByRole("button", { name: /gerar recomendações/i })).toBeDisabled();
  });

  it("button is enabled when both client name and products are provided", async () => {
    renderWithProviders(
      <AIRecommendationsPanel products={PRODUCTS} initialClient={{ name: "Corp ACME" }} />
    );

    expect(screen.getByRole("button", { name: /gerar recomendações/i })).not.toBeDisabled();
  });

  // ── Loading state ──────────────────────────────────────────────

  it("shows loading skeleton and 'Analisando...' button label when isLoading is true", async () => {
    vi.mocked(useAIRecommendations).mockReturnValue({
      ...defaultHookState,
      isLoading: true,
    });

    renderWithProviders(
      <AIRecommendationsPanel products={PRODUCTS} initialClient={{ name: "Corp" }} />
    );

    expect(screen.getByText(/Analisando\.\.\./i)).toBeInTheDocument();
  });

  // ── Error state ────────────────────────────────────────────────

  it("displays error message in alert when error is set and not loading", async () => {
    vi.mocked(useAIRecommendations).mockReturnValue({
      ...defaultHookState,
      isLoading: false,
      error: "Falha na conexão com a IA",
    });

    renderWithProviders(<AIRecommendationsPanel products={PRODUCTS} initialClient={{ name: "Corp" }} />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Falha na conexão com a IA");
  });

  // ── Recommendations rendering ──────────────────────────────────

  it("renders recommendation cards with product name, reason and score badge", async () => {
    vi.mocked(useAIRecommendations).mockReturnValue({
      ...defaultHookState,
      data: {},
      isLoading: false,
      recommendations: [
        { productId: "prod-1", score: 0.9, reason: "Ideal para empresas de tecnologia" },
        { productId: "prod-2", score: 0.6, reason: "Bom custo-benefício" },
      ],
    });

    renderWithProviders(<AIRecommendationsPanel products={PRODUCTS} />);

    expect(screen.getByText("Caneta Esferográfica")).toBeInTheDocument();
    expect(screen.getByText("Ideal para empresas de tecnologia")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("Mochila Executiva")).toBeInTheDocument();
    expect(screen.getByText("Bom custo-benefício")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  // ── Insights ──────────────────────────────────────────────────

  it("displays 'Insights da IA' section when insights string is non-empty", async () => {
    vi.mocked(useAIRecommendations).mockReturnValue({
      ...defaultHookState,
      data: {},
      isLoading: false,
      recommendations: [{ productId: "prod-1", score: 0.9, reason: "Ótimo" }],
      insights: "Cliente prefere itens premium e sustentáveis.",
    });

    renderWithProviders(<AIRecommendationsPanel products={PRODUCTS} />);

    expect(screen.getByText("Insights da IA")).toBeInTheDocument();
    expect(screen.getByText("Cliente prefere itens premium e sustentáveis.")).toBeInTheDocument();
  });

  it("does not render insights section when insights is empty string", async () => {
    vi.mocked(useAIRecommendations).mockReturnValue({
      ...defaultHookState,
      data: {},
      isLoading: false,
      recommendations: [{ productId: "prod-1", score: 0.9, reason: "Ótimo" }],
      insights: "",
    });

    renderWithProviders(<AIRecommendationsPanel products={PRODUCTS} />);

    expect(screen.queryByText("Insights da IA")).not.toBeInTheDocument();
  });

  // ── Empty state ────────────────────────────────────────────────

  it("shows empty state prompt when data is null and no recommendations", async () => {
    renderWithProviders(<AIRecommendationsPanel products={PRODUCTS} />);

    expect(
      screen.getByText(/Preencha o perfil e clique em "Gerar Recomendações"/i)
    ).toBeInTheDocument();
  });

  // ── onProductClick callback ───────────────────────────────────

  it("calls onProductClick with correct productId when recommendation card is clicked", async () => {
    const onProductClick = vi.fn();

    vi.mocked(useAIRecommendations).mockReturnValue({
      ...defaultHookState,
      data: {},
      isLoading: false,
      recommendations: [{ productId: "prod-1", score: 0.9, reason: "Ideal" }],
    });

    renderWithProviders(
      <AIRecommendationsPanel products={PRODUCTS} onProductClick={onProductClick} />
    );

    const card = screen.getByRole("button", { name: /ver produto Caneta Esferográfica/i });
    fireEvent.click(card);
    expect(onProductClick).toHaveBeenCalledWith("prod-1");
  });

  // ── hideClientForm ─────────────────────────────────────────────

  it("hides the client form when hideClientForm prop is true", async () => {
    renderWithProviders(
      <AIRecommendationsPanel products={PRODUCTS} hideClientForm initialClient={{ name: "Corp" }} />
    );

    expect(screen.queryByRole("textbox", { name: /nome do cliente/i })).not.toBeInTheDocument();
  });

  // ── Reset (Limpar) button ─────────────────────────────────────

  it("shows 'Limpar' button and calls reset when data is available and button is clicked", async () => {
    vi.mocked(useAIRecommendations).mockReturnValue({
      ...defaultHookState,
      data: { recommendations: [] },
      isLoading: false,
      recommendations: [{ productId: "prod-1", score: 0.8, reason: "Boa escolha" }],
    });

    renderWithProviders(<AIRecommendationsPanel products={PRODUCTS} initialClient={{ name: "Corp" }} />);

    const limparBtn = screen.getByRole("button", { name: /limpar resultados/i });
    expect(limparBtn).toBeInTheDocument();
    fireEvent.click(limparBtn);
    expect(mockReset).toHaveBeenCalledOnce();
  });
});
