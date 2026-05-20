import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "../a11y/axe-helper";
import { MagicUpVariationComparator } from "@/components/magic-up/MagicUpVariationComparator";
import { MagicUpQualityScore } from "@/components/magic-up/MagicUpQualityScore";
import { MagicUpQualityChecklist } from "@/components/magic-up/MagicUpQualityChecklist";
import { buildMagicScore, buildQualityDiagnosis } from "@/pages/magic-up/magicUpStrategy";
import type { VariationItem } from "@/hooks/intelligence/useMagicUpState";

const diagnosis = buildQualityDiagnosis(
  buildMagicScore({ hasProduct: true, hasLogo: true, hasClient: true, hasTechnique: true, hasBrief: true, channel: "whatsapp" })
);

const partialDiagnosis = buildQualityDiagnosis(
  buildMagicScore({ hasProduct: true, hasLogo: false, hasClient: true, hasTechnique: false, hasBrief: true, channel: "linkedin" })
);

function baseVariation(overrides: Partial<VariationItem> = {}): VariationItem {
  return {
    id: "var-1",
    imageUrl: "https://example.com/img.png",
    isFavorite: false,
    qualityScore: 80,
    qualityDiagnosis: diagnosis,
    curationStatus: "draft",
    isWinner: false,
    ...overrides,
  };
}

describe("Onda 5 — auditoria automatizada axe-core (WCAG 2.1 AA)", () => {
  describe("MagicUpVariationComparator", () => {
    it("não viola regras WCAG com 3 variações (button-name, aria-*, nested-interactive)", async () => {
      const variations = [
        baseVariation({ id: "v1", qualityScore: 92, isWinner: true }),
        baseVariation({ id: "v2", qualityScore: 78 }),
        baseVariation({ id: "v3", qualityScore: 65 }),
      ];
      const { container } = render(
        <MagicUpVariationComparator
          variations={variations}
          activeIndex={0}
          onSelect={() => {}}
          onSelectWinner={() => {}}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("não viola WCAG quando uma variação está ativa e outra é vencedora (aria-pressed/aria-current)", async () => {
      const variations = [
        baseVariation({ id: "v1", qualityScore: 70 }),
        baseVariation({ id: "v2", qualityScore: 95, isWinner: true }),
      ];
      const { container } = render(
        <MagicUpVariationComparator
          variations={variations}
          activeIndex={1}
          onSelect={() => {}}
          onSelectWinner={() => {}}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("MagicUpQualityScore", () => {
    it("não viola WCAG com diagnóstico completo (progressbar aria-valuenow/min/max)", async () => {
      const { container } = render(
        <MagicUpQualityScore diagnosis={diagnosis} aspectRatio="1:1" />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("não viola WCAG sem aspectRatio (rótulos opcionais)", async () => {
      const { container } = render(<MagicUpQualityScore diagnosis={partialDiagnosis} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("MagicUpQualityChecklist", () => {
    it("não viola WCAG quando todos os critérios passam (sr-only para status visual)", async () => {
      const { container } = render(<MagicUpQualityChecklist diagnosis={diagnosis} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("não viola WCAG com critérios reprovados (ícones aria-hidden + texto acessível)", async () => {
      const { container } = render(<MagicUpQualityChecklist diagnosis={partialDiagnosis} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
