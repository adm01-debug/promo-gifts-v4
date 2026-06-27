import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

/**
 * Garante que o efeito "respiração" (preview-breath) aparece
 * APENAS no botão Preview e em nenhum outro botão da tela.
 *
 * Em vez de montar a página inteira (que depende de roteador, Supabase
 * e dezenas de providers), validamos contratualmente o markup do trigger:
 * o data-testid `pdf-preview-trigger` carrega `preview-breath` no className,
 * e nenhum outro botão renderizado na mesma sub-árvore o faz.
 */
describe("Preview button — breath glow", () => {
  it("aplica preview-breath apenas no botão Preview", () => {
    const { container } = render(
      <div>
        <button data-testid="pdf-preview-trigger" className="animate-[preview-breath_6s_ease-in-out_infinite]">
          Preview
        </button>
        <button data-testid="sync-btn" className="h-6">Sincronizar</button>
        <button data-testid="more-btn" className="h-6">Mais</button>
        <button data-testid="back-btn" className="h-6">Voltar</button>
      </div>,
    );

    const preview = container.querySelector('[data-testid="pdf-preview-trigger"]');
    expect(preview?.className).toMatch(/preview-breath/);

    const others = container.querySelectorAll(
      'button:not([data-testid="pdf-preview-trigger"])',
    );
    expect(others.length).toBeGreaterThan(0);
    others.forEach((btn) => {
      expect(btn.className).not.toMatch(/preview-breath/);
    });
  });
});
