import { render } from "@testing-library/react";
import ProductCustomizationOptions from "../ProductCustomizationOptions";
import { vi, describe, it, expect } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock das dependências
vi.mock("@/hooks/useQuoteItems", () => ({
  useQuoteItems: () => ({
    updateItemPersonalization: vi.fn(),
  }),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe("ProductCustomizationOptions Structural Test", () => {
  const mockProps = {
    productId: "prod-123",
    onClose: vi.fn(),
    initialPersonalizations: [],
  };

  it("should render without crashing and have balanced divs", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ProductCustomizationOptions {...mockProps} />
      </QueryClientProvider>
    );
    expect(container).toBeDefined();
    expect(container.firstChild).not.toBeNull();
  });
});
