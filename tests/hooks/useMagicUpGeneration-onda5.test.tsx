import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMagicUpGeneration } from "@/hooks/intelligence/useMagicUpGeneration";
import { DEFAULT_BRAND_KIT, DEFAULT_BRIEF, DEFAULT_CREATIVE_CONTROLS, buildCopyPack, buildMagicScore, type MagicUpQualityDiagnosis } from "@/pages/magic-up/magicUpStrategy";

const mocks = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  selectMock: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }) };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mocks.invokeMock },
    from: () => ({
      insert: mocks.insertMock,
      update: mocks.updateMock,
      select: mocks.selectMock,
    }),
  },
}));

const aiDiagnosis = (total = 91): MagicUpQualityDiagnosis => ({
  total,
  label: "Excelente para envio",
  summary: "Diagnóstico por IA aprovado.",
  source: "ai",
  strengths: ["Produto claro"],
  risks: [],
  recommendations: ["Enviar ao cliente."],
  criteria: [
    { id: "produto-claro", label: "Produto claro", score: 94, passed: true, weight: 5, recommendation: "Ok" },
    { id: "logo-visivel", label: "Logo visível", score: 90, passed: true, weight: 5, recommendation: "Ok" },
    { id: "canal", label: "Canal", score: 88, passed: true, weight: 3, recommendation: "Ok" },
    { id: "marca", label: "Marca", score: 92, passed: true, weight: 3, recommendation: "Ok" },
  ],
});

const deps = {
  selectedProduct: { id: "prod-1", name: "Caneta Metal", sku: "CAN-1", images: [], primary_image_url: "https://example.com/product.png" },
  currentImage: "https://example.com/product.png",
  logoPreview: "https://example.com/logo.png",
  effectivePrompt: "Cenário corporativo premium",
  selectedColor: { name: "Azul", hex: "#0000ff", code: "AZ" },
  selectedTechnique: { id: "tec-1", name: "Silk", code: "SLK" },
  selectedLocationName: "Corpo",
  selectedScene: { id: "scene-1", title: "Escritório", category: "corporativo", prompt: "Mesa executiva" },
  selectedClient: { id: "client-1", name: "ACME" },
  userId: "user-1",
  brief: DEFAULT_BRIEF,
  creativeControls: DEFAULT_CREATIVE_CONTROLS,
  qualityScore: buildMagicScore({ hasProduct: true, hasLogo: true, hasClient: true, hasTechnique: true, hasBrief: true, channel: DEFAULT_BRIEF.channel }),
  copyPack: buildCopyPack({ productName: "Caneta Metal", clientName: "ACME", cta: DEFAULT_BRIEF.cta, tone: DEFAULT_BRIEF.tone, channel: DEFAULT_BRIEF.channel }),
  fullPromptPreview: "Prompt completo",
  activeCampaign: null,
  brandKit: DEFAULT_BRAND_KIT,
  brandNotes: "Tom premium",
  activeRefinement: null,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertMock.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: "gen-1" }, error: null }) }) });
  mocks.updateMock.mockReturnValue({ eq: () => Promise.resolve({ data: null, error: null }) });
  mocks.selectMock.mockReturnValue({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { metadata: { previous: "kept" }, status: "draft" }, error: null }) }) });
});

describe("useMagicUpGeneration Onda 5", () => {
  it("gera imagem, chama Magic Score IA e persiste diagnóstico/metadados", async () => {
    mocks.invokeMock
      .mockResolvedValueOnce({ data: { imageUrl: "https://example.com/generated.png", model: "magic-up-pro" }, error: null })
      .mockResolvedValueOnce({ data: aiDiagnosis(93), error: null });

    const { result } = renderHook(() => useMagicUpGeneration(deps), { wrapper });
    await act(async () => { await result.current.handleGenerate(); });

    expect(mocks.invokeMock).toHaveBeenNthCalledWith(1, "generate-ad-image", expect.any(Object));
    expect(mocks.invokeMock).toHaveBeenNthCalledWith(2, "magic-up-score", expect.any(Object));
    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      quality_score: 93,
      status: "draft",
      metadata: expect.objectContaining({ qualitySource: "ai", qualityDiagnosis: expect.objectContaining({ total: 93 }), curation: expect.objectContaining({ status: "draft" }) }),
    }));
    expect(result.current.variations[0]).toMatchObject({ id: "gen-1", qualityScore: 93, curationStatus: "draft" });
  });

  it("mantém a geração salva com fallback heurístico quando o score IA falha", async () => {
    mocks.invokeMock
      .mockResolvedValueOnce({ data: { imageUrl: "https://example.com/generated.png" }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("score offline") });

    const { result } = renderHook(() => useMagicUpGeneration(deps), { wrapper });
    await act(async () => { await result.current.handleGenerate(); });

    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      generated_image_url: "https://example.com/generated.png",
      metadata: expect.objectContaining({ qualitySource: "heuristic", qualityDiagnosis: expect.objectContaining({ source: "heuristic" }) }),
    }));
    expect(result.current.variations[0].qualityDiagnosis?.source).toBe("heuristic");
  });

  it("reanálise atualiza quality_score e metadata.qualityDiagnosis sem perder metadados", async () => {
    mocks.invokeMock
      .mockResolvedValueOnce({ data: { imageUrl: "https://example.com/generated.png" }, error: null })
      .mockResolvedValueOnce({ data: aiDiagnosis(88), error: null });
    const { result } = renderHook(() => useMagicUpGeneration(deps), { wrapper });
    await act(async () => { await result.current.handleGenerate(); });
    await waitFor(() => expect(result.current.currentVariation?.id).toBe("gen-1"));

    mocks.invokeMock.mockResolvedValueOnce({ data: aiDiagnosis(96), error: null });
    await act(async () => { await result.current.handleRunQualityScore(); });

    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      quality_score: 96,
      metadata: expect.objectContaining({ previous: "kept", qualityScore: 96, qualityDiagnosis: expect.objectContaining({ total: 96 }), curation: expect.objectContaining({ status: "draft" }) }),
    }));
  });

  it("alteração de status atualiza estado local e metadata.curation", async () => {
    mocks.invokeMock
      .mockResolvedValueOnce({ data: { imageUrl: "https://example.com/generated.png" }, error: null })
      .mockResolvedValueOnce({ data: aiDiagnosis(90), error: null });
    const { result } = renderHook(() => useMagicUpGeneration(deps), { wrapper });
    await act(async () => { await result.current.handleGenerate(); });

    await act(async () => { await result.current.handleSetCurationStatus("sent-to-client"); });

    expect(result.current.curationStatus).toBe("sent-to-client");
    expect(mocks.updateMock).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "sent-to-client",
      metadata: expect.objectContaining({ previous: "kept", curation: expect.objectContaining({ status: "sent-to-client" }) }),
    }));
  });
});