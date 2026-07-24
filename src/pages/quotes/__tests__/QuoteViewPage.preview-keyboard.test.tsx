import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Teste de navegação por teclado no botão Preview.
 *
 * Reproduz o cluster real de QuoteViewPage (Preview → Sincronizar → Mais) para
 * validar Tab/Shift+Tab + focus-visible sem depender de auth/router/Supabase.
 */

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

function Cluster() {
  return (
    <div>
      <button data-testid="back-btn">Voltar</button>
      <button
        data-testid="pdf-preview-trigger"
        aria-label="Abrir preview da proposta para exportar PDF"
        className={PREVIEW_BUTTON_CLASS}
      >
        Preview
      </button>
      <button data-testid="sync-btn">Sincronizar</button>
      <button data-testid="more-btn" aria-label="Mais opções">⋯</button>
    </div>
  );
}

describe("Preview button — keyboard focus", () => {
  it("recebe foco via Tab a partir do botão anterior", async () => {
    const user = userEvent.setup();
    render(<Cluster />);

    screen.getByTestId("back-btn").focus();
    expect(screen.getByTestId("back-btn")).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId("pdf-preview-trigger")).toHaveFocus();
  });

  it("recebe foco via Shift+Tab a partir do próximo botão", async () => {
    const user = userEvent.setup();
    render(<Cluster />);

    screen.getByTestId("sync-btn").focus();
    await user.tab({ shift: true });
    expect(screen.getByTestId("pdf-preview-trigger")).toHaveFocus();
  });

  it("focus-visible suaviza o breath (raiz e after) sem remover a11y", () => {
    render(<Cluster />);
    const preview = screen.getByTestId("pdf-preview-trigger");
    // Contrato: utilitários focus-visible:* presentes
    expect(preview.className).toMatch(/focus-visible:animate-none/);
    expect(preview.className).toMatch(/focus-visible:after:animate-none/);
    expect(preview.className).toMatch(/focus-visible:shadow-\[/);
    // A11y preservada
    expect(preview.getAttribute("aria-label")).toBe(
      "Abrir preview da proposta para exportar PDF",
    );
    expect(preview).not.toHaveAttribute("tabindex", "-1");
  });

  it("focus-visible não ativa shimmer (shimmer só dispara em hover)", () => {
    render(<Cluster />);
    const cls = screen.getByTestId("pdf-preview-trigger").className;
    // Shimmer é controlado por hover:before:translate-x-[120%], não por focus
    expect(cls).not.toMatch(/focus-visible:before:translate-x/);
  });

  it("tokens do breath funcionam em tema claro e escuro (referência única a --primary)", () => {
    // Tema escuro
    document.documentElement.classList.add("dark");
    const { unmount } = render(<Cluster />);
    const darkCls = screen.getByTestId("pdf-preview-trigger").className;
    expect(darkCls).toMatch(/hsl\(var\(--primary\)/);
    // Nenhuma cor hardcoded que falharia ao alternar tema
    expect(darkCls).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(darkCls).not.toMatch(/\b(bg|text|border|shadow)-(white|black|gray-\d|blue-\d|slate-\d)/);
    unmount();
    document.documentElement.classList.remove("dark");

    // Tema claro — exatamente as mesmas classes (token semântico se adapta sozinho)
    render(<Cluster />);
    expect(screen.getByTestId("pdf-preview-trigger").className).toBe(darkCls);
  });
});
