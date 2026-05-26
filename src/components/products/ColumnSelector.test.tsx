import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ColumnSelector, STORAGE_KEY } from "./ColumnSelector";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock screen width
const setScreenWidth = (width: number) => {
  act(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event('resize'));
  });
};

describe("ColumnSelector", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setScreenWidth(1600); // Desktop size with all options
  });

  const renderSelector = (value: any = 5, onChange = vi.fn()) => {
    return render(
      <TooltipProvider>
        <ColumnSelector value={value} onChange={onChange} />
      </TooltipProvider>
    );
  };

  it("renders all column options on desktop with correct accessibility roles", () => {
    renderSelector();
    expect(screen.getByRole("radiogroup", { name: /Número de colunas/i })).toBeInTheDocument();
    
    const options = [3, 4, 5, 6, 8];
    options.forEach(cols => {
      expect(screen.getByRole("radio", { name: `${cols} colunas` })).toBeInTheDocument();
    });
  });

  it("calls onChange and updates localStorage when an option is clicked", () => {
    const onChange = vi.fn();
    renderSelector(5, onChange);

    const button3 = screen.getByRole("radio", { name: "3 colunas" });
    fireEvent.click(button3);

    expect(onChange).toHaveBeenCalledWith(3);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("3");
  });

  it("persists selection in localStorage across re-renders with aria-checked", () => {
    const { rerender } = renderSelector(5);
    const button8 = screen.getByRole("radio", { name: "8 colunas" });
    
    fireEvent.click(button8);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("8");

    rerender(
      <TooltipProvider>
        <ColumnSelector value={8} onChange={vi.fn()} />
      </TooltipProvider>
    );
    
    expect(screen.getByRole("radio", { name: "8 colunas" })).toHaveAttribute("aria-checked", "true");
  });

  it("filters options based on screen width", () => {
    // Tablet size
    setScreenWidth(800); 
    const { rerender } = renderSelector(3);
    
    // At 800px, only 3 and 4 columns should be available (minWidth: 0 and 768)
    expect(screen.getByRole("radio", { name: "3 colunas" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "4 colunas" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "5 colunas" })).not.toBeInTheDocument();

    // Mobile size
    setScreenWidth(375);
    rerender(
      <TooltipProvider>
        <ColumnSelector value={3} onChange={vi.fn()} />
      </TooltipProvider>
    );
    
    // Only 1 option available (3 columns) -> should return null
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("automatically clamps value if screen size shrinks", async () => {
    const onChange = vi.fn();
    const { rerender } = renderSelector(8, onChange);

    // Shrink to tablet (max 4 columns)
    setScreenWidth(800);
    
    rerender(
      <TooltipProvider>
        <ColumnSelector value={8} onChange={onChange} />
      </TooltipProvider>
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(4);
    });
  });

  it("supports keyboard navigation with Enter/Space", () => {
    const onChange = vi.fn();
    renderSelector(5, onChange);

    const button3 = screen.getByRole("radio", { name: "3 colunas" });
    
    fireEvent.keyDown(button3, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(3);

    fireEvent.keyDown(button3, { key: " " });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
