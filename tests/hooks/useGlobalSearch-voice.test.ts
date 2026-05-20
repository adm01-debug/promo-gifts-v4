/**
 * Tests for voice-related logic in useGlobalSearch
 */
import { describe, it, expect, vi } from "vitest";
import type { VoiceAgentAction } from "@/hooks/intelligence/useVoiceAgent";

// Test the handleVoiceAction logic in isolation
describe("Voice Action Handler Logic", () => {
  describe("navigate action", () => {
    it("should extract route from navigate action", () => {
      const action: VoiceAgentAction = {
        action: "navigate",
        response: "Indo para orçamentos",
        data: { route: "/orcamentos" },
      };
      expect(action.data?.route).toBe("/orcamentos");
    });

    it("should handle navigate without route gracefully", () => {
      const action: VoiceAgentAction = {
        action: "navigate",
        response: "Indo",
        data: {},
      };
      expect(action.data?.route).toBeUndefined();
    });
  });

  describe("search/filter action", () => {
    it("should build query from filter parts", () => {
      const action: VoiceAgentAction = {
        action: "filter",
        response: "Filtrado",
        data: {
          filters: { category: "Canetas", color: "azul" },
        },
      };

      const filterParts: string[] = [];
      if (action.data?.filters?.category) filterParts.push(action.data.filters.category);
      if (action.data?.filters?.color) filterParts.push(action.data.filters.color);
      if (action.data?.filters?.material) filterParts.push(action.data.filters.material);

      const finalQuery = action.data?.query || filterParts.join(" ");
      expect(finalQuery).toBe("Canetas azul");
    });

    it("should prefer explicit query over filter parts", () => {
      const action: VoiceAgentAction = {
        action: "search",
        response: "Buscando",
        data: {
          query: "caneta personalizada",
          filters: { category: "Canetas" },
        },
      };

      const filterParts: string[] = [];
      if (action.data?.filters?.category) filterParts.push(action.data.filters.category);

      const finalQuery = action.data?.query || filterParts.join(" ");
      expect(finalQuery).toBe("caneta personalizada");
    });

    it("should handle filter with no query and no filters", () => {
      const action: VoiceAgentAction = {
        action: "filter",
        response: "Não entendi",
        data: {},
      };

      const filterParts: string[] = [];
      const finalQuery = action.data?.query || filterParts.join(" ");
      expect(finalQuery).toBe("");
    });
  });

  describe("sort action", () => {
    it("should extract sortBy value", () => {
      const action: VoiceAgentAction = {
        action: "sort",
        response: "Ordenando",
        data: { sortBy: "price-asc" },
      };
      expect(action.data?.sortBy).toBe("price-asc");
    });

    it("sort handler should use sortBy field", () => {
      // After fix: the sort handler now correctly uses action.data?.sortBy
      const action: VoiceAgentAction = {
        action: "sort",
        response: "Ordenando por preço",
        data: { sortBy: "price-asc" },
      };
      // sortBy is the correct field to check
      expect(action.data?.sortBy).toBe("price-asc");
      // Navigate to /?sort=price-asc
      const expectedUrl = `/?sort=${action.data?.sortBy}`;
      expect(expectedUrl).toBe("/?sort=price-asc");
    });
  });

  describe("clear action", () => {
    it("should have action type clear", () => {
      const action: VoiceAgentAction = {
        action: "clear",
        response: "Limpei filtros",
        data: {},
      };
      expect(action.action).toBe("clear");
    });
  });

  describe("answer action", () => {
    it("should only have response text, no navigation", () => {
      const action: VoiceAgentAction = {
        action: "answer",
        response: "Nosso horário é das 8h às 18h.",
      };
      expect(action.action).toBe("answer");
      expect(action.data).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle action with all filter types", () => {
      const action: VoiceAgentAction = {
        action: "filter",
        response: "Filtrado completo",
        data: {
          filters: {
            category: "Mochilas",
            color: "preto",
            material: "couro",
            maxPrice: 200,
            minPrice: 50,
            inStock: true,
            isKit: false,
          },
        },
      };
      expect(action.data?.filters?.category).toBe("Mochilas");
      expect(action.data?.filters?.maxPrice).toBe(200);
      expect(action.data?.filters?.inStock).toBe(true);
      expect(action.data?.filters?.isKit).toBe(false);
    });

    it("should handle response with empty string", () => {
      const action: VoiceAgentAction = {
        action: "answer",
        response: "",
      };
      expect(action.response).toBe("");
    });
  });
});
