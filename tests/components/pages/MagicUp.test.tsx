/**
 * Render tests for MagicUp page (1090 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

// Note: MagicUp page is a leaf — it does NOT render MainLayout (the layout
// is applied by the parent route). We mock PageSEO instead since MagicUp
// always renders it as the first element, giving the test a stable anchor.
vi.mock("@/components/seo/PageSEO", () => ({
  PageSEO: () => <div data-testid="page-seo" />,
}));

// useMagicUpState chama useAriaLive transitivamente; renderWithProviders não
// envolve com AriaLiveProvider. Mock direto do hook evita o context error.
vi.mock("@/components/a11y/AriaLive", async () => {
  const actual = await vi.importActual<typeof import("@/components/a11y/AriaLive")>("@/components/a11y/AriaLive");
  return {
    ...actual,
    useAriaLive: () => ({
      announce: vi.fn(),
      announceStatus: vi.fn(),
      announceAlert: vi.fn(),
      announceProgress: vi.fn(),
    }),
  };
});

vi.mock("@/hooks/usePrintAreas", () => ({
  usePrintAreas: vi.fn().mockReturnValue({
    printAreas: [],
    loading: false,
  }),
}));

vi.mock("@/hooks/mockup/useMockupTechniques", () => ({
  useProductCustomizationOptionsForMockup: vi.fn().mockReturnValue({
    techniques: [],
    loading: false,
  }),
}));

vi.mock("@/components/mockup/ProductSearchCombobox", () => ({
  ProductSearchCombobox: () => <div data-testid="product-search" />,
}));

vi.mock("@/components/magic-up/PromptBank", () => ({
  PromptBank: () => <div data-testid="prompt-bank" />,
}));

vi.mock("@/components/magic-up/PromptGenerator", () => ({
  PromptGenerator: () => <div data-testid="prompt-generator" />,
}));

vi.mock("@/components/magic-up/AdImageResult", () => ({
  AdImageResult: () => <div data-testid="ad-image-result" />,
}));

vi.mock("@/lib/crm-db", () => ({
  searchCrm: vi.fn().mockResolvedValue([]),
  selectCrmById: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/types/crm", () => ({
  getCompanyDisplayName: vi.fn().mockReturnValue("Test Co"),
}));

describe("MagicUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    const { default: MagicUp } = await import("@/pages/tools/MagicUp");
    renderWithProviders(<MagicUp />);
    expect(screen.getByTestId("page-seo")).toBeInTheDocument();
  });
});
