/**
 * Tests for src/utils/colorSorting.ts
 */
import { describe, it, expect } from "vitest";
import { sortByColorGroup, sortVariationsByColor, sortColorSummary } from "@/utils/colorSorting";

describe("colorSorting", () => {
  describe("sortByColorGroup", () => {
    it("sorts by color group order (preto > branco > cinza > azul)", () => {
      const items = [
        { name: "Azul Royal" },
        { name: "Preto" },
        { name: "Cinza" },
        { name: "Branco" },
      ];
      const sorted = sortByColorGroup(items, i => i.name);
      expect(sorted[0].name).toBe("Preto");
      expect(sorted[1].name).toBe("Branco");
      expect(sorted[2].name).toBe("Cinza");
      expect(sorted[3].name).toBe("Azul Royal");
    });

    it("sorts dark before light within same group", () => {
      const items = [
        { name: "Azul Claro" },
        { name: "Azul Escuro" },
        { name: "Azul Royal" },
      ];
      const sorted = sortByColorGroup(items, i => i.name);
      expect(sorted[0].name).toBe("Azul Escuro");
    });

    it("handles empty array", () => {
      expect(sortByColorGroup([], i => "")).toEqual([]);
    });

    it("uses hex luminance as tiebreaker", () => {
      const items = [
        { name: "Verde", hex: "#90EE90" }, // light green
        { name: "Verde", hex: "#006400" }, // dark green
      ];
      const sorted = sortByColorGroup(items, i => i.name, i => i.hex);
      expect(sorted[0].hex).toBe("#006400"); // darker first
    });

    it("puts unknown colors at end", () => {
      const items = [
        { name: "Xadrez" },
        { name: "Preto" },
      ];
      const sorted = sortByColorGroup(items, i => i.name);
      expect(sorted[0].name).toBe("Preto");
      expect(sorted[1].name).toBe("Xadrez");
    });
  });

  describe("sortVariationsByColor", () => {
    it("sorts product variations by color", () => {
      const variations = [
        { color: { name: "Vermelho", hex: "#FF0000" } },
        { color: { name: "Preto", hex: "#000000" } },
      ];
      const sorted = sortVariationsByColor(variations);
      expect(sorted[0].color.name).toBe("Preto");
    });

    it("handles empty array", () => {
      expect(sortVariationsByColor([])).toEqual([]);
    });
  });

  describe("sortColorSummary", () => {
    it("sorts color summary objects", () => {
      const colors = [
        { name: "Rosa", hex: "#FFC0CB" },
        { name: "Branco", hex: "#FFFFFF" },
      ];
      const sorted = sortColorSummary(colors);
      expect(sorted[0].name).toBe("Branco");
    });

    it("handles empty array", () => {
      expect(sortColorSummary([])).toEqual([]);
    });
  });
});
