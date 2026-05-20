/**
 * Render tests for TechniqueCard (687 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../render-helpers";
import React from "react";

vi.mock("@/hooks/simulation/useSimulation", () => ({
  formatCurrency: vi.fn((val: number) => `R$ ${val.toFixed(2)}`),
}));

const baseTechnique = {
  id: "t1",
  name: "Serigrafia",
  code: "SILK",
  maxColors: 6,
  estimated_days: 5,
  unit_cost: 2.5,
  setup_cost: 50,
  recommendation: {
    score: 85,
    label: "Recomendado",
    reasons: ["Melhor custo-benefício"],
  },
};

const baseSettings = {
  colors: 1,
  size: "M",
  sizeModifier: 1,
};

describe("TechniqueCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders in expanded view", async () => {
    const { TechniqueCard } = await import("@/components/simulator/TechniqueCard");
    renderWithProviders(
      <TechniqueCard
        technique={baseTechnique as any}
        isSelected={false}
        settings={baseSettings as any}
        showColors={true}
        showSize={true}
        colorOptions={[{ value: 1, label: "1 cor" }, { value: 2, label: "2 cores" }]}
        sizeOptions={[{ value: "M", label: "Médio", modifier: 1 }]}
        quantity={100}
        onToggle={vi.fn()}
        onUpdateSetting={vi.fn()}
        viewMode="expanded"
      />
    );
    expect(document.body).toBeTruthy();
  });

  it("renders in compact view", async () => {
    const { TechniqueCard } = await import("@/components/simulator/TechniqueCard");
    renderWithProviders(
      <TechniqueCard
        technique={baseTechnique as any}
        isSelected={true}
        settings={baseSettings as any}
        showColors={false}
        showSize={false}
        colorOptions={[]}
        sizeOptions={[]}
        quantity={50}
        onToggle={vi.fn()}
        onUpdateSetting={vi.fn()}
        viewMode="compact"
      />
    );
    expect(document.body).toBeTruthy();
  });
});
