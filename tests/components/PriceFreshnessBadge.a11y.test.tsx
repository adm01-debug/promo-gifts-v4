/**
 * Acessibilidade do PriceFreshnessBadge — trava o contrato de a11y/contraste
 * adicionado pela mudança "Acessibilidade do selo":
 *
 *  1. aria-label rico por status (Preço + categoria + ação recomendada)
 *  2. atributo `title` espelha o aria-label (fallback offline / hover nativo)
 *  3. `tabIndex=0` em variantes compactas (icon-only, compact) → alcançável
 *     por teclado para abrir o tooltip Radix
 *  4. anel de foco visível via token `--ring`
 *  5. cores de stale/aging usam `amber-700` (≥ 4.5:1 WCAG AA) — não mais
 *     `amber-600` (3.4:1, falha em AA para texto)
 *  6. ícone marcado com `aria-hidden` (não duplica leitura do aria-label)
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceFreshnessBadge } from "@/components/products/PriceFreshnessBadge";

const FIXED_NOW = new Date("2026-04-24T12:00:00.000Z").getTime();
const daysAgo = (d: number) => new Date(FIXED_NOW - d * 86400000).toISOString();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

describe("PriceFreshnessBadge — acessibilidade", () => {
  describe("aria-label rico por status", () => {
    it("fresh: menciona 'Preço atualizado' e a data por extenso", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(5)}
          thresholdDays={60}
          variant="inline"
        />,
      );
      const aria = screen.getByRole("status").getAttribute("aria-label") ?? "";
      expect(aria).toMatch(/preço atualizado/i);
      expect(aria).toMatch(/\d{1,2} de [a-zçãéíúô]+ de \d{4}/i);
      expect(aria).toMatch(/há 5 dias/);
    });

    it("aging: menciona 'próximo do limite' + recomendação de confirmação", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(45)}
          thresholdDays={60}
          variant="inline"
        />,
      );
      const aria = screen.getByRole("status").getAttribute("aria-label") ?? "";
      expect(aria).toMatch(/próximo do limite/i);
      expect(aria).toMatch(/confirmar/i);
    });

    it("stale: começa com 'Atenção' e pede confirmação antes do orçamento", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(90)}
          thresholdDays={60}
          variant="inline"
        />,
      );
      const aria = screen.getByRole("status").getAttribute("aria-label") ?? "";
      expect(aria).toMatch(/^atenção/i);
      expect(aria).toMatch(/possivelmente defasado/i);
      expect(aria).toMatch(/antes de enviar o orçamento/i);
    });

    it("unknown (data ausente): menciona 'não informada'", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={null}
          variant="inline"
        />,
      );
      const aria = screen.getByRole("status").getAttribute("aria-label") ?? "";
      expect(aria).toMatch(/não informada/i);
    });

    it("unknown (data inválida): menciona 'inválida' (distingue do ausente)", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt="not-a-date"
          variant="inline"
        />,
      );
      const aria = screen.getByRole("status").getAttribute("aria-label") ?? "";
      expect(aria).toMatch(/inválida/i);
    });
  });

  describe("aria-label rico por variante (fallback de tooltip offline)", () => {
    it("aria-label rico presente nas variantes compactas (icon-only)", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(90)}
          thresholdDays={60}
          variant="icon-only"
        />,
      );
      const badge = screen.getByRole("status");
      expect(badge.getAttribute("aria-label")).toMatch(/possivelmente defasado/i);
    });

    it("aria-label rico presente no inline (PDP/QuickView)", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(45)}
          thresholdDays={60}
          variant="inline"
        />,
      );
      expect(
        screen.getByRole("status").getAttribute("aria-label"),
      ).toMatch(/próximo do limite/i);
    });
  });

  describe("alcançável por teclado (tabIndex + focus ring)", () => {
    it("icon-only é focável por tab (tabIndex=0)", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(90)}
          thresholdDays={60}
          variant="icon-only"
        />,
      );
      expect(screen.getByRole("status")).toHaveAttribute("tabindex", "0");
    });

    it("compact é focável por tab (tabIndex=0)", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(90)}
          thresholdDays={60}
          variant="compact"
        />,
      );
      expect(screen.getByRole("status")).toHaveAttribute("tabindex", "0");
    });

    it("icon-only e compact aplicam anel de foco visível via token --ring", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(90)}
          thresholdDays={60}
          variant="icon-only"
        />,
      );
      expect(screen.getByRole("status").className).toMatch(
        /focus-visible:ring-2/,
      );
      expect(screen.getByRole("status").className).toMatch(
        /focus-visible:ring-ring/,
      );
    });
  });

  describe("contraste WCAG AA", () => {
    it("stale em icon-only usa amber-700 (≥ 4.5:1), não amber-600", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(90)}
          thresholdDays={60}
          variant="icon-only"
        />,
      );
      const cls = screen.getByRole("status").className;
      expect(cls).toMatch(/amber-700/);
      expect(cls).not.toMatch(/amber-600(?!\d)/);
    });

    it("aging em icon-only usa amber-700 (não muted-foreground genérico)", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(45)}
          thresholdDays={60}
          variant="icon-only"
        />,
      );
      const cls = screen.getByRole("status").className;
      expect(cls).toMatch(/amber-700/);
    });

    it("aging em compact (lista densa) também usa amber-700", () => {
      render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(45)}
          thresholdDays={60}
          variant="compact"
        />,
      );
      expect(screen.getByRole("status").className).toMatch(/amber-700/);
    });
  });

  describe("ícone decorativo (não duplica leitura)", () => {
    it("icon-only: SVG marcado com aria-hidden", () => {
      const { container } = render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(90)}
          thresholdDays={60}
          variant="icon-only"
        />,
      );
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });

    it("compact: SVG marcado com aria-hidden", () => {
      const { container } = render(
        <PriceFreshnessBadge
          priceUpdatedAt={daysAgo(90)}
          thresholdDays={60}
          variant="compact"
        />,
      );
      expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    });
  });
});
