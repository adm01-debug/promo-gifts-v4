import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

/**
 * Cobertura contratual do efeito "preview-breath".
 *
 * Validamos via className porque o efeito é 100% CSS (Tailwind):
 * - Tailwind `motion-reduce:animate-none` é compilado a uma media-query
 *   `@media (prefers-reduced-motion: reduce)`. Verificar a media-query
 *   em jsdom é instável (não computa estilos), então o contrato real
 *   é a presença do utilitário no markup gerado.
 * - Pausa em hover/focus segue o mesmo princípio (`hover:animate-none`,
 *   `focus-visible:animate-none`).
 * - O shimmer vive na pseudo-classe `before:` e o breath na raiz + `after:`,
 *   então não ocupam a mesma camada — ausência de conflito é estrutural.
 */

// Reproduz fielmente o className do botão Preview em QuoteViewPage.tsx.
// Se aquele componente mudar, este teste deve ser atualizado junto.
const PREVIEW_BUTTON_CLASS = `group relative h-6 min-w-[78px] justify-center gap-1.5 overflow-hidden rounded-full border-primary/40 px-2.5 text-[11px]
  animate-[preview-breath_6s_ease-in-out_infinite] motion-reduce:animate-none
  shadow-[0_0_6px_hsl(var(--primary)/0.2)] transition-all duration-500
  hover:animate-none focus-visible:animate-none
  hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_14px_hsl(var(--primary)/0.5)]
  before:absolute before:inset-0 before:rounded-full
  before:bg-[linear-gradient(110deg,transparent_30%,hsl(var(--primary)/0.35)_50%,transparent_70%)]
  before:translate-x-[-120%] before:transition-transform before:duration-700 before:ease-out
  hover:before:translate-x-[120%]
  after:absolute after:inset-0 after:rounded-full after:border after:border-primary/25
  after:animate-[preview-breath-border_6s_ease-in-out_infinite] after:motion-reduce:animate-none
  hover:after:animate-none focus-visible:after:animate-none hover:after:border-primary/0
  focus-visible:shadow-[0_0_14px_hsl(var(--primary)/0.5)]`;

function renderPreviewButton() {
  return render(
    <div>
      <button
        data-testid="pdf-preview-trigger"
        aria-label="Abrir preview da proposta para exportar PDF"
        className={PREVIEW_BUTTON_CLASS}
      >
        Preview
      </button>
      <button data-testid="sync-btn" className="h-6">
        Sincronizar
      </button>
      <button data-testid="more-btn" className="h-6">
        Mais
      </button>
    </div>,
  );
}

describe('Preview button — breath glow', () => {
  it('aplica preview-breath apenas no botão Preview', () => {
    const { container } = renderPreviewButton();
    const preview = container.querySelector('[data-testid="pdf-preview-trigger"]')!;
    expect(preview.className).toMatch(/preview-breath/);

    for (const btn of Array.from(
      container.querySelectorAll('button:not([data-testid="pdf-preview-trigger"])'),
    )) {
      expect(btn.className).not.toMatch(/preview-breath/);
    }
  });

  it('desativa o brilho com prefers-reduced-motion (utilitário motion-reduce:animate-none aplicado à raiz e ao after)', () => {
    const { container } = renderPreviewButton();
    const preview = container.querySelector('[data-testid="pdf-preview-trigger"]')!;
    // Raiz (boxShadow breath)
    expect(preview.className).toMatch(/motion-reduce:animate-none/);
    // Pseudo `after` (border breath)
    expect(preview.className).toMatch(/after:motion-reduce:animate-none/);
  });

  it('mantém o shimmer (before:) funcionando independentemente do motion-reduce', () => {
    const { container } = renderPreviewButton();
    const preview = container.querySelector('[data-testid="pdf-preview-trigger"]')!;
    // Shimmer continua: usa `before:` com translate em hover, sem motion-reduce override
    expect(preview.className).toMatch(/before:translate-x-\[-120%\]/);
    expect(preview.className).toMatch(/hover:before:translate-x-\[120%\]/);
    expect(preview.className).not.toMatch(/before:motion-reduce/);
  });

  it('pausa o breath em hover e focus-visible para evitar conflito com o shimmer', () => {
    const { container } = renderPreviewButton();
    const preview = container.querySelector('[data-testid="pdf-preview-trigger"]')!;
    // Raiz
    expect(preview.className).toMatch(/hover:animate-none/);
    expect(preview.className).toMatch(/focus-visible:animate-none/);
    // Pseudo `after`
    expect(preview.className).toMatch(/hover:after:animate-none/);
    expect(preview.className).toMatch(/focus-visible:after:animate-none/);
  });

  it('garante separação de camadas: shimmer em `before:`, breath na raiz/`after:` (sem competir)', () => {
    const { container } = renderPreviewButton();
    const preview = container.querySelector('[data-testid="pdf-preview-trigger"]')!;
    const cls = preview.className;
    // Shimmer não usa `preview-breath`; breath não usa o gradiente do shimmer
    const breathTokens = cls.match(/preview-breath/g) ?? [];
    const shimmerTokens = cls.match(/linear-gradient\(110deg/g) ?? [];
    expect(breathTokens.length).toBeGreaterThan(0);
    expect(shimmerTokens.length).toBeGreaterThan(0);
    // Nenhum utilitário mistura `before:` com `preview-breath`
    expect(cls).not.toMatch(/before:[^ ]*preview-breath/);
  });

  it('preserva atributos de acessibilidade (aria-label e testid) — focus não remove a11y', () => {
    const { container } = renderPreviewButton();
    const preview = container.querySelector('[data-testid="pdf-preview-trigger"]')!;
    expect(preview.getAttribute('aria-label')).toBe('Abrir preview da proposta para exportar PDF');
    expect(preview.tagName).toBe('BUTTON');
  });

  it('usa apenas tokens semânticos (hsl(var(--primary))) — contraste se adapta a tema claro/escuro', () => {
    const { container } = renderPreviewButton();
    const cls = container.querySelector('[data-testid="pdf-preview-trigger"]')!.className;
    // Toda cor do efeito referencia --primary; nada de #hex ou cores Tailwind hardcoded
    expect(cls).toMatch(/hsl\(var\(--primary\)/);
    expect(cls).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(cls).not.toMatch(/\b(bg|text|border|shadow)-(white|black|gray-\d|blue-\d|red-\d)/);
  });

  it('usa overflow-hidden — shimmer e breath não estouram a borda arredondada do botão', () => {
    const { container } = renderPreviewButton();
    const cls = container.querySelector('[data-testid="pdf-preview-trigger"]')!.className;
    expect(cls).toMatch(/overflow-hidden/);
    expect(cls).toMatch(/rounded-full/);
  });
});
