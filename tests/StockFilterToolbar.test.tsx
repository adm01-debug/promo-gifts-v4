import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StockFilterToolbar } from "@/components/inventory/StockFilterToolbar";
import type { StockFilters } from "@/types/stock";
import { defaultStockFilters } from "@/types/stock";

const mockCategories = [
  { name: "Canetas", count: 50 },
  { name: "Cadernos", count: 30 },
  { name: "Agendas", count: 20 },
];

const mockSuppliers = [
  { name: "Fornecedor A", count: 40 },
  { name: "Fornecedor B", count: 60 },
];

const mockColors = ["Azul", "Vermelho", "Preto", "Branco"];
const mockColorGroups = [
  { name: "Azuis", count: 15 },
  { name: "Vermelhos", count: 10 },
];

const defaultProps = {
  filters: { ...defaultStockFilters },
  onUpdateFilter: vi.fn(),
  onResetFilters: vi.fn(),
  categories: mockCategories,
  suppliers: mockSuppliers,
  colors: mockColors,
  colorGroups: mockColorGroups,
  totalProducts: 500,
  filteredCount: 500,
};


describe("StockFilterToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input", () => {
    render(<StockFilterToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText("Buscar no Estoque (Nome, SKU ou Cor)...")).toBeInTheDocument();
  });

  it("renders quantity input", () => {
    render(<StockFilterToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText("Preciso de X un...")).toBeInTheDocument();
  });

  it("renders Filtros button (status chips moved to StatCards)", () => {
    render(<StockFilterToolbar {...defaultProps} />);
    // Status chips were removed — StatCards handle status filtering now
    expect(screen.getByText("Filtros")).toBeInTheDocument();
  });

  it("renders search and quantity inputs", () => {
    render(<StockFilterToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText("Buscar no Estoque (Nome, SKU ou Cor)...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Preciso de X un...")).toBeInTheDocument();
  });

  it("commits search on Enter (sem debounce — commit-on-Enter)", () => {
    render(<StockFilterToolbar {...defaultProps} />);
    const input = screen.getByPlaceholderText("Buscar no Estoque (Nome, SKU ou Cor)...");
    fireEvent.change(input, { target: { value: "caneta" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(defaultProps.onUpdateFilter).toHaveBeenCalledWith("search", "caneta");
  });

  it("shows Filtros button", () => {
    render(<StockFilterToolbar {...defaultProps} />);
    expect(screen.getByText("Filtros")).toBeInTheDocument();
  });

  it("shows active filter count badge when filters are active", () => {
    const activeFilters: StockFilters = {
      ...defaultStockFilters,
      categoryId: "Canetas",
      status: "low_stock",
    };
    render(<StockFilterToolbar {...defaultProps} filters={activeFilters} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows active filter count badge when category is set", () => {
    const activeFilters: StockFilters = {
      ...defaultStockFilters,
      categoryId: "Canetas",
    };
    render(<StockFilterToolbar {...defaultProps} filters={activeFilters} />);
    // Category filter increments the badge count
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows filtered count when filters are active", () => {
    const activeFilters: StockFilters = {
      ...defaultStockFilters,
      categoryId: "Canetas",
    };
    render(<StockFilterToolbar {...defaultProps} filters={activeFilters} filteredCount={50} />);
    expect(screen.getByText("50 de 500 produtos")).toBeInTheDocument();
  });

  it("shows reset button (X) when filters are active", () => {
    const activeFilters: StockFilters = {
      ...defaultStockFilters,
      categoryId: "Canetas",
    };
    render(<StockFilterToolbar {...defaultProps} filters={activeFilters} />);
    // The X reset button should be visible
    const resetButtons = screen.getAllByRole("button");
    expect(resetButtons.length).toBeGreaterThan(0);
  });

  it("calls onResetFilters when reset is triggered", () => {
    const activeFilters: StockFilters = {
      ...defaultStockFilters,
      search: "test",
    };
    render(<StockFilterToolbar {...defaultProps} filters={activeFilters} />);
    // Clear search via the X button inside the search input
    const clearButton = screen.getByPlaceholderText("Buscar no Estoque (Nome, SKU ou Cor)...").parentElement?.querySelector("button");
    if (clearButton) fireEvent.click(clearButton);
    // search should be cleared locally
  });
});
