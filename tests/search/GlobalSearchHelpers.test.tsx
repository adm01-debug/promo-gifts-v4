import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RankBadge, SectionHeader, staggerStyle } from "@/components/search/GlobalSearchHelpers";

describe("RankBadge", () => {
  it("renders Trophy icon for index 0", () => {
    const { container } = render(<RankBadge index={0} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector(".from-brand-primary")).toBeInTheDocument();
  });

  it("renders Medal for index 1", () => {
    const { container } = render(<RankBadge index={1} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders '3º' for index 2", () => {
    render(<RankBadge index={2} />);
    expect(screen.getByText("3º")).toBeInTheDocument();
  });

  it("renders Nth position for higher indices", () => {
    render(<RankBadge index={4} />);
    expect(screen.getByText("5º")).toBeInTheDocument();
  });
});

describe("SectionHeader", () => {
  it("renders label", () => {
    render(<SectionHeader icon={<span>🔍</span>} label="Produtos" />);
    expect(screen.getByText("Produtos")).toBeInTheDocument();
  });

  it("shows count badge when count > 0", () => {
    render(<SectionHeader icon={<span>🔍</span>} label="Test" count={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("hides count badge when count is 0", () => {
    const { container } = render(
      <SectionHeader icon={<span>🔍</span>} label="Test" count={0} />
    );
    expect(container.querySelector(".rounded-full")).not.toBeInTheDocument();
  });
});

describe("staggerStyle", () => {
  it("returns correct animation delay", () => {
    expect(staggerStyle(0)).toEqual({ animationDelay: "0ms" });
    expect(staggerStyle(2)).toEqual({ animationDelay: "100ms" });
    expect(staggerStyle(1, 200)).toEqual({ animationDelay: "250ms" });
  });
});
